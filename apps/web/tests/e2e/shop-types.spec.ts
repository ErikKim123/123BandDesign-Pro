// Design Ref: QA — 상품 타입(티켓/구독) 탐색·구매 플로우 E2E
// 타입 필터 정확성 + 티켓+구독 장바구니 → 단일 주문 검증
import { test, expect, type Page } from '@playwright/test';

const EMAIL = process.env.WEB_EMAIL ?? 'customer@123band.test';
const PW = process.env.WEB_PW ?? 'Band!2026';

const TICKET = '123Band 라이브 콘서트'; // d2
const SUB = 'JNJ SaaS 월간'; // d3
const PHYSICAL = '123Band 티셔츠'; // d1
const SUB_ID = '00000000-0000-0000-0000-0000000000d3';

async function login(page: Page) {
  await page.goto('/ko/login');
  await page.waitForLoadState('networkidle');
  const email = page.locator('input[type="email"]');
  const pw = page.locator('input[type="password"]');
  await expect(async () => {
    await email.fill(EMAIL);
    await pw.fill(PW);
    expect(await email.inputValue()).toBe(EMAIL);
    expect(await pw.inputValue()).toBe(PW);
  }).toPass({ timeout: 8000 });
  await page.getByRole('button', { name: '계속' }).click();
  await page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 25_000 });
}

test('티켓/구독 타입: 필터 정확성 + 구매', async ({ page }) => {
  await login(page);

  // 1) 타입 필터 정확성 — 티켓 탭
  await page.goto('/ko/shop?type=ticket');
  await expect(page.getByText(TICKET)).toBeVisible();
  await expect(page.getByText(PHYSICAL)).toHaveCount(0);
  await expect(page.getByText(SUB)).toHaveCount(0);

  // 2) 타입 필터 정확성 — 구독 탭
  await page.goto('/ko/shop?type=subscription');
  await expect(page.getByText(SUB)).toBeVisible();
  await expect(page.getByText(TICKET)).toHaveCount(0);

  // 3) 티켓 상세 → 담기
  await page.goto('/ko/shop?type=ticket');
  // 상세 URL 은 유형별로 다르다: 티켓=/ko/events/{slug} · 그 외=/ko/shop/{slug} (레거시=/ko/products/{uuid})
  await page.locator('a.product-card').first().click();
  await expect(page).toHaveURL(/\/ko\/(events|shop|products)\/[^/]+$/);
  await expect(page.getByRole('heading', { name: TICKET })).toBeVisible();
  await page.getByRole('button', { name: /장바구니 담기/ }).click();
  await expect(page.getByText('담겼습니다')).toBeVisible();

  // 4) 구독 상세 → 담기
  await page.goto(`/ko/products/${SUB_ID}`);
  await expect(page.getByRole('heading', { name: SUB })).toBeVisible();
  await page.getByRole('button', { name: /장바구니 담기/ }).click();
  await expect(page.getByText('담겼습니다')).toBeVisible();

  // 5) 장바구니 2건 확인 → 주문
  await page.goto('/ko/cart');
  await expect(page.getByText(TICKET)).toBeVisible();
  await expect(page.getByText(SUB)).toBeVisible();
  await page.getByRole('link', { name: '결제하기' }).click();
  await expect(page).toHaveURL(/\/ko\/checkout/, { timeout: 25_000 });

  await page.getByRole('button', { name: '결제하기' }).click();
  await expect(page.getByText('주문 완료')).toBeVisible({ timeout: 25_000 });
  const noText = await page.getByText(/ORD\d{18}/).first().textContent();
  const orderNo = noText?.match(/ORD\d{18}/)?.[0];
  expect(orderNo, '주문번호 캡처').toBeTruthy();
  console.log('  [E2E] 티켓+구독 주문번호:', orderNo);

  // 6) 주문내역 노출
  await page.goto('/ko/account/orders');
  await expect(page.getByText(orderNo!)).toBeVisible();
});
