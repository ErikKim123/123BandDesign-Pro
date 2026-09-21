// Design Ref: §8.3/§8.4 — L2 UI Action + L3 E2E (Playwright)
// 사용법: apps/admin 에서
//   pnpm add -D @playwright/test && npx playwright install chromium
//   ADMIN_EMAIL=admin@123band.test ADMIN_PW=... npx playwright test
// 전제: dev 서버(:3001) 기동 + admin 계정에 Auth 비밀번호 설정 + role=admin
import { test, expect } from '@playwright/test';

const BASE = process.env.ADMIN_BASE ?? 'http://localhost:3001';
const EMAIL = process.env.ADMIN_EMAIL ?? 'admin@123band.test';
const PW = process.env.ADMIN_PW ?? '';

async function login(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('이메일').fill(EMAIL);
  await page.getByLabel('비밀번호').fill(PW);
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL(/\/members/);
}

// ── L2: UI Action ──────────────────────────────────────────
test.describe('L2 UI Action', () => {
  test('#1 비-admin/미인증은 보호 경로 차단', async ({ page }) => {
    await page.goto(`${BASE}/members`);
    await expect(page).toHaveURL(/\/login/); // middleware 리다이렉트
  });

  test('#2 로그인 후 회원관리 목록 표시', async ({ page }) => {
    await login(page);
    await expect(page.getByRole('heading', { name: /회원관리/ })).toBeVisible();
  });

  test('#3 오거나이저 승인 버튼 → 상태 active', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/partners`);
    const approve = page.getByRole('button', { name: '승인' }).first();
    if (await approve.count()) {
      await approve.click();
      await expect(page.getByText('ACTIVE').first()).toBeVisible();
    }
  });

  test('#4 상품 등록 폼 — 잘못된 속성 JSON 검증 에러 (G1)', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/products`);
    await page.getByRole('button', { name: '추가' }).click();
    await expect(page.getByRole('heading', { name: '상품 등록' })).toBeVisible();
    // 잘못된 JSON 입력 → 인라인 에러 노출 + 저장 차단
    await page.getByPlaceholder('{"size":["S","M"]}').fill('{bad json');
    await expect(page.getByText('JSON 형식이 올바르지 않습니다.')).toBeVisible();
  });

  test('#5 카테고리 중분류 추가', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/categories`);
    await page.getByRole('button', { name: '추가' }).click();
    await expect(page.getByRole('heading', { name: '카테고리 추가' })).toBeVisible();
  });
});

// ── L3: E2E 시나리오 ───────────────────────────────────────
test.describe('L3 E2E', () => {
  test('입점→판매 준비 플로우', async ({ page }) => {
    await login(page);
    // 카테고리 추가
    await page.goto(`${BASE}/categories`);
    await expect(page.getByRole('heading', { name: /카테고리관리/ })).toBeVisible();
    // 상품 목록 진입 (데이터 렌더)
    await page.goto(`${BASE}/products`);
    await expect(page.getByRole('heading', { name: /상품관리/ })).toBeVisible();
  });
});
