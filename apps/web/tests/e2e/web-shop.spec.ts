// Design Ref: QA — web 고객 구매 플로우 라이브 클릭 E2E
// 로그인 → 담기 → 장바구니 → 체크아웃 → 쿠폰 적용 → 주문 생성 → 주문내역 확인
import { test, expect, type Page } from '@playwright/test';

const EMAIL = process.env.WEB_EMAIL ?? 'customer@123band.test';
const PW = process.env.WEB_PW ?? 'Band!2026';
const COUPON = process.env.WEB_COUPON ?? 'QAWELCOME10';

async function login(page: Page) {
  await page.goto('/ko/login');
  await page.waitForLoadState('networkidle');
  const email = page.locator('input[type="email"]');
  const pw = page.locator('input[type="password"]');
  // 하이드레이션 전 입력 레이스 방지: 값이 React 상태에 실제로 박힐 때까지 재시도
  await expect(async () => {
    await email.fill(EMAIL);
    await pw.fill(PW);
    expect(await email.inputValue()).toBe(EMAIL);
    expect(await pw.inputValue()).toBe(PW);
  }).toPass({ timeout: 8000 });
  await page.getByRole('button', { name: '계속' }).click();
  // 로그인 처리 후 /login 을 벗어날 때까지 대기
  await page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 25_000 });
}

test('고객 구매 플로우: 로그인→담기→쿠폰→주문→내역', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });

  // 0) 로그인 (검증된 정상 경로)
  await login(page);

  // 1) 상점 → 상품 상세 (실제 카드 클릭)
  await page.goto('/ko/shop');
  // 상세 URL 은 유형별로 다르다: 티켓=/ko/events/{slug} · 그 외=/ko/shop/{slug} (레거시=/ko/products/{uuid})
  const firstProduct = page.locator('a.product-card').first();
  await expect(firstProduct).toBeVisible();
  await firstProduct.click();
  await expect(page).toHaveURL(/\/ko\/(events|shop|products)\/[^/]+$/);

  // 2) 장바구니 담기
  const addBtn = page.getByRole('button', { name: /장바구니 담기/ });
  await expect(addBtn).toBeVisible();
  await addBtn.click();
  await expect(page.getByText('담겼습니다')).toBeVisible();

  // 3) 장바구니 → 결제하기 (이미 인증 → 체크아웃 직행)
  await page.goto('/ko/cart');
  await expect(page.getByRole('heading', { name: '장바구니' })).toBeVisible();
  await page.getByRole('link', { name: '결제하기' }).click();
  await expect(page).toHaveURL(/\/ko\/checkout/, { timeout: 25_000 });
  await expect(page.getByRole('heading', { name: '결제하기' })).toBeVisible();

  // 4) 쿠폰 적용 → 할인 반영 확인
  await page.getByPlaceholder('코드 입력').fill(COUPON);
  await page.getByRole('button', { name: '적용' }).click();
  await expect(page.getByText('쿠폰 적용됨')).toBeVisible();
  await expect(page.getByText(new RegExp(`할인 \\(${COUPON}\\)`))).toBeVisible();

  // 5) 주문 생성 → 주문번호 캡처
  await page.getByRole('button', { name: '결제하기' }).click();
  await expect(page.getByText('주문 완료')).toBeVisible({ timeout: 25_000 });
  const noText = await page.getByText(/ORD\d{18}/).first().textContent();
  const orderNo = noText?.match(/ORD\d{18}/)?.[0];
  expect(orderNo, '주문번호(ORD...) 캡처').toBeTruthy();
  console.log('  [E2E] 생성된 주문번호:', orderNo);

  // 6) 주문내역에 노출 확인
  await page.goto('/ko/account/orders');
  await expect(page.getByRole('heading', { name: '주문내역' })).toBeVisible();
  await expect(page.getByText(orderNo!)).toBeVisible();

  // 7) 콘솔 치명적 에러 없어야 함
  const fatal = consoleErrors.filter(
    (e) => !/favicon|Download the React DevTools|hydrat/i.test(e),
  );
  expect(fatal, `콘솔 에러: ${fatal.join(' | ')}`).toEqual([]);
});
