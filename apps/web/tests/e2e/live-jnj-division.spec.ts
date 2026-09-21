// Design Ref: QA — 라이브 ↔ J&J 부문 연결(0082) 표시 확인
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

async function rest(path: string, init?: RequestInit) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...svcHeaders, ...(init?.headers ?? {}) },
  });
  return r;
}

// 이 검사는 실제로 status='live' 행을 잠깐 만든다 — 그 동안 실사이트 전 페이지 상단에
// LIVE 배너가 뜬다(글로벌 배너는 대회·부문을 가리지 않는다). 그래서 기본은 건너뛰고,
// 확인이 필요할 때만 E2E_LIVE=1 로 켠다. 행은 finally 에서 지운다(노출 10초 내외).
test.skip(!process.env.E2E_LIVE, 'E2E_LIVE=1 일 때만 — 실사이트에 LIVE 배너가 잠깐 뜬다');

test('라이브 표시 3곳(섬네일·타이틀 하단·섹션) + 다른 부문에는 안 뜸', async ({ page }) => {
  const ed = await (await rest('jnj_editions?slug=eq.bohohl-2026&select=id,slug,event_product_id')).json();
  const editionId = ed[0].id as string;
  const divs = await (
    await rest(`jnj_divisions?edition_id=eq.${editionId}&select=id,code,title_i18n&order=sort_order`)
  ).json();
  console.log('  [E2E] 부문:', divs.map((d: {code: string}) => d.code).join(', '));
  const mine = divs[0];
  const other = divs[1];

  let liveId: string | null = null;
  try {
    const res = await rest('live_broadcasts', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        slug: `e2e-live-${Date.now()}`,
        title_i18n: { ko: 'E2E 방송 확인', en: 'E2E live check' },
        notice_i18n: { ko: '테스트 중입니다', en: 'Testing' },
        status: 'live',
        jnj_edition_id: editionId,
        jnj_division_id: mine.id,
        yt_video_id: 'dQw4w9WgXcQ',
      }),
    });
    expect(res.ok, `방송 INSERT (${res.status}) ${await res.clone().text()}`).toBeTruthy();
    liveId = (await res.json())[0].id as string;

    // 1) 방송이 걸린 부문 — 섬네일 LIVE · 타이틀 하단 '라이브 중' · 섹션 칩 · 섹션
    await page.setViewportSize({ width: 1280, height: 1400 });
    await page.goto(`/ko/jnj?year=2026&e=bohohl-2026&d=${mine.code}`);
    await page.waitForLoadState('networkidle');
    const section = page.locator('#live');
    await expect(section).toBeVisible({ timeout: 25_000 });
    // 섹션 안에서 바로 재생된다 — 시청 페이지로 보내는 'Watch live' 버튼은 없앴다.
    await expect(
      section.locator('iframe[src*="youtube.com/embed/"]'),
      '섹션 안에 플레이어',
    ).toBeVisible({ timeout: 25_000 });
    await expect(
      section.locator('iframe[src*="live_chat"]'),
      '섹션 안에 채팅(유튜브 소스일 때)',
    ).toHaveCount(1);
    await expect(
      section.getByRole('link', { name: /watch live|라이브 시청/i }),
      '시청 페이지로 보내는 버튼은 없다',
    ).toHaveCount(0);
    await section.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'z:/tmp/live-on.png', fullPage: false });

    // 2) 상단 글로벌 배너 — 시청 페이지가 아니라 라이브 섹션(#live)으로 보낸다
    const banner = page.getByRole('link', { name: /live now|지금 방송 중/i }).first();
    await expect(banner, '상단 배너').toBeVisible({ timeout: 25_000 });
    const bannerHref = await banner.getAttribute('href');
    console.log('  [E2E] 배너 목적지:', bannerHref);
    expect(bannerHref, '배너는 #live 로 보낸다').toContain('#live');
    expect(bannerHref, '더 이상 /live/{slug} 로 보내지 않는다').not.toMatch(/\/live\/[^#]/);

    // 3) 다른 부문 — 이 방송은 안 보여야 한다(0082 의 핵심)
    if (other) {
      await page.goto(`/ko/jnj?year=2026&e=bohohl-2026&d=${other.code}`);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('#live'), '다른 부문에는 안 뜬다').toHaveCount(0);
      console.log('  [E2E] 다른 부문(', other.code, ')에는 라이브 섹션 없음 — 확인');
    }
  } finally {
    if (liveId) {
      await rest(`live_broadcasts?id=eq.${liveId}`, { method: 'DELETE' });
      console.log('  [E2E] 테스트 방송 삭제 완료');
    }
  }
});
