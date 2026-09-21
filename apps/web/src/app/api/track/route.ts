// 페이지뷰 기록 — 어드민 방문자수/트래픽수 메뉴용. 로그인 여부 무관, 미들웨어가 발급한
// 익명 visitor_id 쿠키로 순 방문자를 센다. service_role 로만 쓴다(RLS insert 정책 없음).
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { VISITOR_ID_COOKIE } from '@/lib/supabase/cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 홈화면에 설치된 앱으로 실행되면 browser 이외의 값이 온다(0058 유입 경로 구분용).
const LAUNCH_MODES = ['browser', 'standalone', 'fullscreen', 'minimal-ui'] as const;

// Vercel 이 모든 요청에 무료로 붙여주는 위치 헤더(0060).
// Vercel Web Analytics 로도 국가를 볼 수 있지만 그쪽은 orders 와 조인이 안 된다 —
// 우리 테이블에 넣어야 '어느 나라 방문이 실매출로 이어졌는지'가 나온다.
// 도시는 URL 인코딩되어 오므로 디코딩한다(예: Ho%20Chi%20Minh%20City).
function geo(req: Request, header: string): string | null {
  const raw = req.headers.get(header);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw).slice(0, 100) || null;
  } catch {
    return raw.slice(0, 100) || null;
  }
}

function detectDevice(ua: string): string {
  if (/ipad|tablet|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|iphone|android/i.test(ua)) return 'mobile';
  return 'desktop';
}

export async function POST(req: Request) {
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: true }); // 키 미설정 로컬 환경 — 조용히 무시

  const visitorId = cookies().get(VISITOR_ID_COOKIE)?.value;
  if (!visitorId) return NextResponse.json({ ok: true }); // 미들웨어를 안 거친 드문 요청

  let body: {
    path?: string;
    referrer?: string;
    launchMode?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const path = String(body.path ?? '').slice(0, 500);
  if (!path.startsWith('/')) return NextResponse.json({ error: 'invalid_path' }, { status: 400 });

  const referrer = String(body.referrer ?? '').slice(0, 500) || null;
  // 브라우저가 주는 display-mode 값만 허용 — 임의 문자열이 집계에 섞이지 않게 한다.
  const launchMode = LAUNCH_MODES.includes(body.launchMode as (typeof LAUNCH_MODES)[number])
    ? (body.launchMode as string)
    : 'browser';
  const userAgent = (req.headers.get('user-agent') ?? '').slice(0, 300);
  // UTM 은 캠페인별 전환 집계(0057 admin_funnel_by_source)의 first-touch 출처가 된다.
  const utm = (v: unknown) => String(v ?? '').slice(0, 200) || null;

  // 삽입한 행의 id 를 돌려준다 — 화면을 떠날 때 이 행에 체류시간을 채워 넣는다
  // (0085 · /api/track/dwell). 체류시간은 '떠날 때'라야 알 수 있어서 두 번에 나눠 쓴다.
  const { data } = await admin
    .from('page_views')
    .insert({
      visitor_id: visitorId,
      path,
      referrer,
      user_agent: userAgent,
      device: detectDevice(userAgent),
      launch_mode: launchMode,
      country: geo(req, 'x-vercel-ip-country'),
      region: geo(req, 'x-vercel-ip-country-region'),
      city: geo(req, 'x-vercel-ip-city'),
      utm_source: utm(body.utmSource),
      utm_medium: utm(body.utmMedium),
      utm_campaign: utm(body.utmCampaign),
    })
    .select('id')
    .single();

  return NextResponse.json({ ok: true, id: data?.id ?? null });
}
