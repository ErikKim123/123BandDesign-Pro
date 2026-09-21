// Design Ref: QA — J&J 섹션 칩 활성 표시(스크롤 추적 + 클릭)
// 데이터를 만들지 않는 읽기 전용 검사다 — 실사이트에 아무 영향이 없다.
import { test, expect } from '@playwright/test';

test('섹션 칩 활성 표시', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/en/jnj?year=2026&e=cebu-2026');
  await page.waitForLoadState('networkidle');

  const chip = (id: string) => page.locator(`[data-chip="${id}"]`);
  await expect(chip('judges')).toBeVisible({ timeout: 25_000 });

  // 1) 손으로 스크롤 — 지나간 섹션의 칩이 켜진다
  await page.locator('#judges').scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 120);
  await expect(chip('judges')).toHaveAttribute('aria-current', 'true', { timeout: 5000 });
  await page.screenshot({ path: 'z:/tmp/nav-judges.png', clip: { x: 0, y: 0, width: 1280, height: 260 } });

  // 다른 칩은 꺼져 있다
  await expect(chip('format')).not.toHaveAttribute('aria-current', 'true');

  // 2) 눌러서 이동 — 누른 칩이 켜진다
  await chip('videos').click();
  await expect(chip('videos')).toHaveAttribute('aria-current', 'true', { timeout: 5000 });
  await page.waitForTimeout(600);
  await expect(chip('judges')).not.toHaveAttribute('aria-current', 'true');
  await page.screenshot({ path: 'z:/tmp/nav-videos.png', clip: { x: 0, y: 0, width: 1280, height: 260 } });
});
