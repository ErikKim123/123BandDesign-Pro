// PayVerse 결제창 연동 라이브 클릭 검증.
// 전제: dev 서버(:3000) 기동 + customer@123band.test 로그인 + KRW 가격이 있는 active 티켓 상품.
// 확인 범위: 체크아웃 → 결제창(iframe) 오픈까지. 실제 카드 승인은 PayVerse UI 안에서 이어간다.
//   ⚠️ 서명(sign)이 틀리면 SDK 가 alert('Not valid sign')만 띄우고 결제창이 뜨지 않는다 → 이 테스트가 잡아낸다.
//
// 장바구니는 UI 클릭 대신 localStorage 로 직접 심는다(CartContext 저장 규약 그대로).
// 금액/할인은 어차피 서버가 DB 가격으로 재계산하므로, 이 테스트가 검증하려는 결제 경로에는 영향이 없다.
import { test, expect, type Dialog } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL ?? 'customer@123band.test';
const PASSWORD = process.env.E2E_PASSWORD ?? 'Band!2026';
const USER_ID = process.env.E2E_USER_ID ?? '00000000-0000-0000-0000-000000000003';
const PRODUCT_ID = process.env.E2E_PRODUCT_ID ?? '2ac1c005-3b90-4a1b-a970-9ede09078e89';
const TICKET_KEY = process.env.E2E_TICKET_KEY ?? 'c5abf9a3-e839-48d5-a1c1-c424df3de947';

const CART_ITEM = {
  id: PRODUCT_ID,
  ticketKey: TICKET_KEY,
  ticketName: { ko: '프리파티', en: 'Pre-Party' },
  name_i18n: { ko: 'MBF 멜버른 바차타 페스티벌', en: 'Melbourne Bachata Festival 2026' },
  prices: { KRW: 210000, USD: 15000 },
  seller_id: '00000000-0000-0000-0000-000000000002',
  is_partner_product: false,
  product_type: 'ticket',
  qty: 1,
};

test('PayVerse 통합결제창이 열린다', async ({ page }) => {
  // SDK 는 실패 시 alert 로만 알린다 → 다이얼로그를 모아 두었다가 실패 원인으로 보고한다.
  const dialogs: string[] = [];
  page.on('dialog', (d: Dialog) => {
    dialogs.push(d.message());
    void d.dismiss();
  });
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  // 1) 로그인 (?next 소프트네비 레이스를 피해 /ko/login 직접 접근)
  await page.goto('/ko/login');
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.getByRole('button', { name: '계속', exact: true }).click();
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60_000 });

  // 2) 장바구니 주입 후 체크아웃 진입
  await page.evaluate(
    ([key, item]) => localStorage.setItem(key as string, JSON.stringify([item])),
    [`band-cart:${USER_ID}`, CART_ITEM] as const,
  );
  await page.goto('/ko/checkout');
  await expect(page.getByRole('heading', { name: '결제' })).toBeVisible({ timeout: 60_000 });

  // 3) 결제 시작 — 서버가 내려주는 결제창 파라미터가 규격에 맞는지 응답으로 확인한다.
  const checkoutRes = page.waitForResponse(
    (r) => r.url().includes('/api/payments/checkout') && r.request().method() === 'POST',
    { timeout: 60_000 },
  );
  await page.getByRole('button', { name: /카드결제|결제하기/ }).last().click();

  const res = await checkoutRes;
  expect(res.status(), `checkout 응답 ${res.status()}`).toBe(200);
  const body = await res.json();
  const sign = String(body.params?.sign ?? '');
  console.log(
    'checkout 응답:',
    JSON.stringify({ ...body, params: { ...body.params, sign: `${sign.slice(0, 16)}…(${sign.length}자)` } }, null, 2),
  );

  expect(body.kind).toBe('payverse');
  expect(sign).toHaveLength(128);
  expect(body.params.requestCurrency).toBe('KRW');
  expect(body.params.returnUrl).toContain('/api/payments/payverse/return/ko');
  // order_no = ORD + yyyymmddhhmmss(14) + 난수 4자리. 하이픈/특수문자 없이 영숫자만.
  expect(body.params.orderId).toMatch(/^ORD\d{18}$/);

  // 4) 결제창(iframe) 오픈 확인 — SDK 는 /payment/ui/token 이 0000 을 준 뒤에만 iframe 을 붙인다.
  //    즉 iframe 이 뜬다는 것 자체가 mid/clientKey/sign/금액이 모두 통과했다는 뜻.
  const iframe = page.locator('iframe[title="Payverse 결제창"]');
  await expect(iframe).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(5000); // 결제수단 목록 렌더 대기

  await page.screenshot({ path: 'test-results/payverse-window.png', fullPage: true });
  const text = await page.frameLocator('iframe[title="Payverse 결제창"]').locator('body').innerText();
  console.log('결제창 내용:\n', text.slice(0, 1500));

  expect(dialogs, `SDK alert: ${dialogs.join(' | ')}`).toHaveLength(0);
  if (errors.length) console.log('콘솔 에러:', errors.slice(0, 10));
});
