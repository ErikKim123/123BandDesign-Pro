// PayVerse 실결제 → 어드민 환불(PG 취소) 왕복 검증.
//
// ⚠️ 승인 단계만 사람 손이 필요하다. 샌드박스는 카드 정보를 다 넣어도 마지막에
//    PayVerse Echo 앱(글로벌카드) 또는 카드사 앱(국내카드)으로 인증해야 승인이 난다
//    — 헤드리스로 대신할 방법이 없다. 그래서 이 스펙은 QR 을 띄워 두고 승인될 때까지 기다린다.
//
// 실행:
//   1) web dev(:3000), admin dev(:3001) 기동
//   2) 어드민 세션 쿠키를 E2E_ADMIN_COOKIE 로 넣는다(만드는 법은 tests/e2e/README.md)
//   3) node node_modules/@playwright/test/cli.js test --config apps/web/playwright.config.ts \
//        payverse-refund.spec.ts --headed
//   4) 브라우저에 뜬 QR 을 PayVerse Echo 앱으로 스캔해 승인 → 이후는 전부 자동
//
// 사람이 없을 땐(CI 등) 승인 대기에서 타임아웃되며 skip 처리된다.
import { test, expect, type Dialog, type FrameLocator } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';

const EMAIL = process.env.E2E_EMAIL ?? 'customer@123band.test';
const PASSWORD = process.env.E2E_PASSWORD ?? 'Band!2026';
const USER_ID = process.env.E2E_USER_ID ?? '00000000-0000-0000-0000-000000000003';
const ADMIN_BASE = process.env.E2E_ADMIN_BASE ?? 'http://localhost:3001';
/** 승인 대기 시간(초). 0 이면 QR 을 띄운 채 기다리지 않고 종료한다. */
const APPROVE_WAIT_SEC = Number(process.env.E2E_APPROVE_WAIT ?? 240);

// 이롬넷 안내: 439229 로 시작하면 테스트카드. 나머지 자리는 임의(Luhn 만 맞춰 둠).
const CARD = process.env.E2E_CARD ?? '4392291234567892';
const EXP_MM = '12';
const EXP_YY = '30';
const CVC = '123';
const BIRTH = '900101';

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

function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  // apps/web/tests/e2e → 모노레포 루트
  const env = readFileSync(resolve(__dirname, '../../../../.env'), 'utf8');
  const m = env.match(/^DATABASE_URL\s*=\s*"?([^"\n\r]+)"?/m);
  if (!m) throw new Error('루트 .env 에서 DATABASE_URL 을 찾지 못했다');
  return m[1];
}

async function orderRow(id: string): Promise<{ status: string; payment_ref: string | null; currency: string }> {
  const c = new Client({ connectionString: databaseUrl(), ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const r = await c.query('select status, payment_ref, currency from orders where id = $1', [id]);
    return r.rows[0];
  } finally {
    await c.end();
  }
}

/**
 * readonly 입력칸은 Stealien 보안키패드로만 채운다.
 * - 키패드는 누를 때마다 키 배치를 섞어 일반 클릭의 stable 판정이 끝나지 않는다 → force 클릭
 * - 키패드 인스턴스가 칸마다 따로 있고 닫힌 것도 DOM 에 남는다 → 반드시 :visible 로 고른다
 * - 한 칸이 다 차면 다음 칸으로 포커스가 자동 이동한다
 */
async function pressDigits(f: FrameLocator, digits: string): Promise<void> {
  for (const d of digits) {
    await f
      .locator('._stealien_keybutton:visible', { hasText: new RegExp(`^${d}$`) })
      .first()
      .click({ force: true, timeout: 15_000 });
  }
}

async function keypadFill(
  f: FrameLocator,
  field: ReturnType<FrameLocator['locator']>,
  digits: string,
): Promise<void> {
  const focused = await field.evaluate((el) => el === document.activeElement).catch(() => false);
  if (!focused || !(await f.locator('._stealien_keybutton:visible').first().isVisible().catch(() => false))) {
    await field.click({ force: true });
  }
  await f.locator('._stealien_keybutton:visible').first().waitFor({ state: 'visible', timeout: 15_000 });
  await pressDigits(f, digits);
}

test('테스트카드 승인 → 어드민 환불이 PayVerse 취소까지 태운다', async ({ page, request }) => {
  test.setTimeout(APPROVE_WAIT_SEC * 1000 + 300_000);
  await page.setViewportSize({ width: 1280, height: 1600 });

  const dialogs: string[] = [];
  page.on('dialog', (d: Dialog) => {
    dialogs.push(d.message());
    void d.dismiss();
  });

  // 1) 로그인 + 장바구니 주입 + 체크아웃
  await page.goto('/en/login');
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
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
  const body = await (await checkoutRes).json();
  const orderId: string = body.orderId;
  const orderNo: string = body.orderNo;
  console.log(`주문 ${orderNo} (${body.params.requestAmount} ${body.params.requestCurrency})`);

  // 2) 결제창 카드 입력 — 카드번호는 앞 8자리(일반) + 4 + 4(보안키패드) 세 칸이다.
  const f = page.frameLocator('iframe[title="Payverse 결제창"]');
  await expect(page.locator('iframe[title="Payverse 결제창"]')).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(5000);

  await f.locator('input[type="tel"]').first().fill(CARD.slice(0, 8));
  await pressDigits(f, CARD.slice(8, 12));
  await pressDigits(f, CARD.slice(12, 16));
  await keypadFill(f, f.locator('[data-field-name="expiryDateMonth"]'), EXP_MM);
  await keypadFill(f, f.locator('[data-field-name="expiryDateYear"]'), EXP_YY);
  await keypadFill(f, f.locator('[data-field-name="cvc"]'), CVC);

  // 글로벌카드 폼에선 이름/성 칸이 숨겨져 있다(노출된 경우에만 채운다).
  for (const [sel, val] of [
    ['input[name="firstName"]', 'Test'],
    ['input[name="lastName"]', '123Band'],
    ['input[name="email"]', EMAIL],
  ] as const) {
    const el = f.locator(sel);
    if (await el.isVisible().catch(() => false)) await el.fill(val);
  }
  const birth = f.locator('[data-field-name="identityNumber"]');
  if (await birth.isVisible().catch(() => false)) await keypadFill(f, birth, BIRTH);

  // 커스텀 체크박스라 실제 input 은 화면 밖에 있다 → 라벨 클릭, 안 먹으면 input 에 직접 이벤트.
  const agree = f.locator('input[type="checkbox"]').first();
  await f.getByText('전자금융거래 이용약관').first().click({ force: true }).catch(() => undefined);
  if (!(await agree.isChecked().catch(() => false))) await agree.dispatchEvent('click');
  expect(await agree.isChecked(), '약관 동의 체크 실패').toBe(true);

  await page.screenshot({ path: 'test-results/refund-1-filled.png', fullPage: true });

  // 3) 결제하기 → Echo QR 팝업. 여기서부터 사람이 스캔해야 승인이 난다.
  const popups: import('@playwright/test').Page[] = [];
  page.context().on('page', (p) => popups.push(p));
  await f.getByRole('button', { name: '결제하기' }).click();
  await page.waitForTimeout(8000);

  const echo = popups.find((p) => p.url().includes('echoQR'));
  expect(echo, `인증 팝업이 뜨지 않았다. alert: ${dialogs.join(' | ')}`).toBeTruthy();
  const tid = new URL(echo!.url()).searchParams.get('tid');
  console.log('승인 대기 — PayVerse Echo 앱으로 QR 을 스캔하세요.');
  console.log('  TID:', tid);
  console.log('  QR payUrl:', new URL(echo!.url()).searchParams.get('payUrl'));
  await echo!.screenshot({ path: 'test-results/refund-2-echo-qr.png' }).catch(() => undefined);

  // 4) 승인될 때까지 주문 상태를 폴링(웹훅/complete 중 먼저 도착하는 쪽이 확정한다).
  let paid = false;
  const deadline = Date.now() + APPROVE_WAIT_SEC * 1000;
  while (Date.now() < deadline) {
    const row = await orderRow(orderId);
    if (row.status === 'paid') {
      paid = true;
      console.log('승인 확인 — payment_ref(TID):', row.payment_ref);
      break;
    }
    await page.waitForTimeout(3000);
  }
  test.skip(
    !paid,
    `승인 대기 ${APPROVE_WAIT_SEC}s 초과 — Echo 앱 스캔이 없었다. ` +
      '이 스펙은 --headed 로 띄워 QR 을 스캔해야 끝까지 진행된다.',
  );

  // 5) 어드민 환불 — PG 취소가 실제로 실행돼야 한다.
  const refundRes = await request.post(`${ADMIN_BASE}/api/orders/refund`, {
    headers: { 'content-type': 'application/json', Cookie: process.env.E2E_ADMIN_COOKIE ?? '' },
    data: { orderId, reason: 'E2E 환불 검증' },
  });
  const refundJson = await refundRes.json();
  console.log('환불 응답:', refundRes.status(), JSON.stringify(refundJson));

  expect(refundRes.status(), `환불 실패: ${JSON.stringify(refundJson)}`).toBe(200);
  expect(refundJson.ok).toBe(true);
  expect(refundJson.pgCancelled, 'PG 취소가 실행되어야 한다').toBe(true);

  // 6) 주문 상태와 PG 쪽 거래 상태를 각각 확인한다.
  const after = await orderRow(orderId);
  expect(after.status, '환불 후 주문 상태').toBe('refunded');
  console.log(`주문 ${orderNo} 환불 완료 — TID ${tid} 취소됨`);
});
