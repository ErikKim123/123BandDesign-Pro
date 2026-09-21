// Design Ref: QA — web 고객 플로우 라이브 클릭 E2E (헤드리스 chromium)
// 전제: dev 서버(:3000) 기동 + customer@123band.test 로그인 가능 + 테스트 쿠폰 존재
// 실행: cd apps/web && npx playwright test
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 150_000, // dev 모드 라우트 컴파일이 느려 넉넉히
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.WEB_BASE ?? 'http://localhost:3000',
    headless: true,
    trace: 'retain-on-failure',
    locale: 'ko-KR',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
