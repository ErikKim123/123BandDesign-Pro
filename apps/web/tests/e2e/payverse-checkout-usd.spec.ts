// PayVerse 해외(USD) 결제창 검증 — en 로케일은 USD 가맹점(202608009M)으로 분기된다.
// 이롬넷 제공 테스트카드(439229…)를 넣는 지점까지 확인한다.
// ⚠️ 마지막 인증 단계는 PayVerse Echo 앱으로 QR 을 스캔해야 해 자동화가 불가능 → 그 직전까지만 검증.
import { test, expect, type Dialog } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL ?? 'customer@123band.test';
const PASSWORD = process.env.E2E_PASSWORD ?? 'Band!2026';
const USER_ID = process.env.E2E_USER_ID ?? '00000000-0000-0000-0000-000000000003';

const CART_ITEM = {
  id: '2ac1c005-3b90-4a1b-a970-9ede09078e89',
  ticketKey: 'c5abf9a3-e839-48d5-a1c1-c424df3de947',
  ticketName: { ko: '프리파티', en: 'Pre-Party' },
  name_i18n: { ko: 'MBF 멜버른 바차타 페스티벌', en: 'Melbourne Bachata Festival 2026' },
  prices: { KRW: 210000, USD: 15000 },
  seller_id: '00000000-0000-0000-0000-000000000002',
  is_partner_product: false,
  product_type: 'ticket',
  qty: 1,
};

test('해외(USD) 결제창이 열리고 테스트카드 입력란까지 도달한다', async ({ page }) => {
  const dialogs: string[] = [];
  page.on('dialog', (d: Dialog) => {
    dialogs.push(d.message());
    void d.dismiss();
  });

  await page.goto('/en/login');
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  // 소셜 로그인 버튼("Continue with Google")과 헷갈리지 않도록 submit 버튼을 직접 고른다.
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60_000 });

  await page.evaluate(
    ([key, item]) => localStorage.setItem(key as string, JSON.stringify([item])),
    [`band-cart:${USER_ID}`, CART_ITEM] as const,
  );
  await page.goto('/en/checkout');

  const checkoutRes = page.waitForResponse(
    (r) => r.url().includes('/api/payments/checkout') && r.request().method() === 'POST',
    { timeout: 60_000 },
  );
  await page.getByRole('button', { name: 'Pay by card', exact: true }).click();

  const res = await checkoutRes;
  const body = await res.json();
  console.log('USD checkout params:', JSON.stringify({ ...body.params, sign: `…(${String(body.params?.sign).length}자)` }, null, 2));

  // USD 는 해외 가맹점으로 분기돼야 한다.
  expect(body.params.mid).toBe('202608009M');
  expect(body.params.requestCurrency).toBe('USD');
  expect(body.params.requestAmount).toBe('30'); // Pre-Party USD 3000센트 → "30"

  const frame = page.frameLocator('iframe[title="Payverse 결제창"]');
  await expect(page.locator('iframe[title="Payverse 결제창"]')).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'test-results/payverse-usd-window.png', fullPage: true });
  console.log('결제창 내용:\n', (await frame.locator('body').innerText()).slice(0, 1500));

  // 해외 결제 폼이 실제로 렌더됐는지까지 확인한다(카드번호 1칸 + MM/YY/CVC + 약관).
  //   ⚠️ 이 앞으로는 자동화하지 않는다 — MM/YY/CVC 는 readonly(자체 키패드)이고,
  //      마지막 인증은 이롬넷 안내대로 PayVerse Echo 앱으로 QR 을 스캔해야 해 헤드리스로 완주할 수 없다.
  //      테스트카드 439229… 로 승인까지 보려면 실기기에서 수동 진행.
  await expect(frame.locator('input[type="tel"]').first()).toBeVisible();
  await expect(frame.getByPlaceholder('MM')).toBeVisible();
  await expect(frame.getByPlaceholder('CVC/CVV')).toBeVisible();
  await expect(frame.getByRole('button', { name: '결제하기' })).toBeVisible();

  expect(dialogs, `SDK alert: ${dialogs.join(' | ')}`).toHaveLength(0);
});
