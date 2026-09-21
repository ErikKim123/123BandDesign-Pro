// Design Ref: QA — 운영자 알림 배너 라이브 E2E
// 확인 범위:
//   1) 배너가 화면 '위'에 온전히 뜬다 — 헤더의 backdrop-blur 가 fixed 의 기준을 헤더 박스로
//      바꿔 배너가 화면 밖으로 잘려 나가던 버그(닫기 버튼이 화면 밖이라 닫을 수도 없었다).
//   2) 제목만 보여준다(본문은 알림함에서).
//   3) 8초 뒤 스스로 사라지고, 마우스를 올려 두면 사라지지 않는다.
//   4) 알림함에 들어가면 헤더 종의 숫자가 그 자리에서 사라진다.
//   5) 받은 알림을 회원이 지울 수 있다 — 한 건씩도, 모두 지우기로도(0081 삭제 정책).
// 알림은 어드민 UI 대신 service_role 로 직접 INSERT 한다 — 보는 쪽(웹) 동작이 확인 대상이라
// 보내는 쪽 화면까지 거칠 이유가 없다. 넣은 행은 끝나고 지운다.
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const EMAIL = process.env.WEB_EMAIL ?? 'customer@123band.test';
const PW = process.env.WEB_PW ?? 'Band!2026';

/** 자동 사라짐(8초)보다 넉넉히 — "안 사라졌다"를 판정할 대기. */
const OVER_DISMISS_MS = 12_000;

function envVar(key: string): string {
  const file = path.join(__dirname, '..', '..', '.env.local');
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(new RegExp(`^${key}\s*=\s*"?([^"\n\r]+)"?`, 'm'));
  if (!m) throw new Error(`${key} 없음: ${file}`);
  return m[1].trim();
}

const SUPA_URL = envVar('NEXT_PUBLIC_SUPABASE_URL');
const ANON = envVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const SERVICE = envVar('SUPABASE_SERVICE_ROLE_KEY');

const svcHeaders = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  'Content-Type': 'application/json',
};

async function userId(): Promise<string> {
  const r = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PW }),
  });
  const j = (await r.json()) as { user?: { id?: string } };
  const id = j.user?.id;
  expect(id, `${EMAIL} 로그인/유저ID`).toBeTruthy();
  return id!;
}

async function login(page: Page) {
  await page.goto('/ko/login');
  await page.waitForLoadState('networkidle');
  // 푸터에도 이메일 입력(구독)이 있어 본문으로 좁힌다
  const form = page.getByRole('main');
  const email = form.locator('input[type="email"]');
  const pw = form.locator('input[type="password"]');
  // 하이드레이션 전 입력 레이스 방지: 값이 React 상태에 실제로 박힐 때까지 재시도
  await expect(async () => {
    await email.fill(EMAIL);
    await pw.fill(PW);
    expect(await email.inputValue()).toBe(EMAIL);
    expect(await pw.inputValue()).toBe(PW);
  }).toPass({ timeout: 8000 });
  await form.getByRole('button', { name: '계속', exact: true }).click();
  await page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 25_000 });
}

test('운영자 알림 배너: 상단에 제목만 · 8초 뒤 사라짐 · 읽으면 배지 0 · 삭제', async ({
  page,
}) => {
  const marker = `E2E-알림-${Date.now()}`;
  const bodyText = `본문-${Date.now()}`;
  const uid = await userId();
  let noticeId: string | null = null;

  try {
    await login(page);
    await page.goto('/ko');
    await page.waitForLoadState('networkidle');

    // 1) 알림 발송 — 사이트를 열어둔 상태에서 INSERT
    const res = await fetch(`${SUPA_URL}/rest/v1/member_notices`, {
      method: 'POST',
      headers: { ...svcHeaders, Prefer: 'return=representation' },
      body: JSON.stringify({ user_id: uid, title: marker, body: bodyText }),
    });
    expect(res.ok, `알림 INSERT (${res.status})`).toBeTruthy();
    noticeId = (await res.json())[0].id as string;

    // 2) 카드가 뜬다 — Realtime 이 막혀도 폴백 폴링(25초) 안에는 뜬다
    const card = page.locator('article[role="status"]', { hasText: marker });
    await expect(card).toBeVisible({ timeout: 45_000 });

    // 곧바로 마우스를 올려 시계를 멈춘다 — 아래 기하 검사 도중 8초가 지나가지 않게
    await card.hover();

    // 3) 화면 '위'에 온전히 — 잘려 나가던 버그의 회귀 검사
    const vp = page.viewportSize()!;
    const box = (await card.boundingBox())!;
    expect(box, '배너 위치').toBeTruthy();
    expect(box.y, '배너 위쪽이 화면 밖으로 잘리지 않는다').toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, '배너 아래쪽이 화면을 넘지 않는다').toBeLessThanOrEqual(vp.height + 1);
    expect(box.y, '배너는 화면 위쪽에 뜬다').toBeLessThan(vp.height / 2);

    // 4) 제목만 — 본문은 배너에 없다(알림함에서 본다)
    await expect(card).toContainText(marker);
    await expect(card, '본문은 배너에 나오지 않는다').not.toContainText(bodyText);

    // 닫기 버튼도 눌릴 수 있는 자리에 있어야 한다(잘렸을 때 못 닫던 지점)
    const closeBtn = card.getByRole('button', { name: '닫기' });
    await expect(closeBtn).toBeVisible();
    const cb = (await closeBtn.boundingBox())!;
    expect(cb.y, '닫기 버튼이 화면 안에 있다').toBeGreaterThanOrEqual(0);

    // 5) 마우스를 올려둔 동안은 사라지지 않는다
    await page.waitForTimeout(OVER_DISMISS_MS);
    await expect(card, '읽는 중(hover)에는 남아 있다').toBeVisible();

    // 6) 치우면 8초 뒤 스스로 사라진다
    await page.mouse.move(2, 2);
    await expect(card).toBeHidden({ timeout: OVER_DISMISS_MS });

    // 7) 사라져도 알림함에는 남는다 — 본문까지 여기서 보인다
    await page.goto('/ko/account/notices');
    await expect(page.getByText(marker)).toBeVisible({ timeout: 25_000 });
    await expect(page.getByText(bodyText)).toBeVisible();

    // 8) 읽음 확인 — 알림함에 들어왔으면 헤더 종의 숫자가 그 자리에서 사라진다
    const bell = page.getByRole('link', { name: '알림' }).first();
    await expect(bell.locator('span').first(), '종 배지가 사라진다').toBeHidden({ timeout: 20_000 });

    // 9) 한 건 지우기 — 지우면 새로고침 뒤에도 없다
    const item = page.locator('li', { hasText: marker }).last();
    await item.getByRole('button', { name: '삭제', exact: true }).click();
    await expect(page.getByText(marker)).toBeHidden({ timeout: 15_000 });
    await page.reload();
    await expect(page.getByText(marker), '지운 알림은 되살아나지 않는다').toBeHidden({
      timeout: 25_000,
    });
    noticeId = null; // 이미 지웠다

    // 10) 모두 지우기 — 확인창을 받고, 목록이 비고, 새로고침해도 비어 있다
    const second = `E2E-전체삭제-${Date.now()}`;
    const res2 = await fetch(`${SUPA_URL}/rest/v1/member_notices`, {
      method: 'POST',
      headers: { ...svcHeaders, Prefer: 'return=representation' },
      body: JSON.stringify({ user_id: uid, title: second, body: '전체 삭제 확인용' }),
    });
    expect(res2.ok, `두 번째 알림 INSERT (${res2.status})`).toBeTruthy();
    noticeId = (await res2.json())[0].id as string;

    await page.reload();
    await expect(page.getByText(second)).toBeVisible({ timeout: 25_000 });
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: '모두 지우기' }).click();
    await expect(page.getByText(second)).toBeHidden({ timeout: 15_000 });
    await page.reload();
    await expect(page.getByText(second), '모두 지우기 뒤에도 비어 있다').toBeHidden({
      timeout: 25_000,
    });
    noticeId = null;
  } finally {
    if (noticeId) {
      await fetch(`${SUPA_URL}/rest/v1/member_notices?id=eq.${noticeId}`, {
        method: 'DELETE',
        headers: svcHeaders,
      });
    }
  }
});
