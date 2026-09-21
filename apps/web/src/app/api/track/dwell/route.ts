// 체류시간 기록 — 어드민 퍼널분석의 '화면별 체류시간'(0085)용.
//
// 왜 별도 라우트인가: 체류시간은 화면을 '떠날 때'라야 알 수 있다. 그 순간 fetch 는
// 문서가 사라지며 취소될 수 있어서, 브라우저가 뒤에서 보내주는 sendBeacon 으로 받는다.
// sendBeacon 은 POST 만 가능해서 PATCH 가 아니라 POST 다.
//
// 보내는 값은 '화면이 실제로 보이던 시간'이다(탭을 숨기면 시계가 멈춘다) — 자세한 건
// components/analytics/TrafficBeacon.tsx 참고.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { VISITOR_ID_COOKIE } from '@/lib/supabase/cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 1시간 초과는 집계에서 어차피 잘린다(0085) — 여기서 먼저 막아 이상값을 안 쌓는다. */
const MAX_DWELL_MS = 3600_000;

export async function POST(req: Request) {
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: true }); // 키 미설정 로컬 환경 — 조용히 무시

  const visitorId = cookies().get(VISITOR_ID_COOKIE)?.value;
  if (!visitorId) return NextResponse.json({ ok: true });

  let body: { id?: number; dwellMs?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const id = Number(body.id);
  const dwellMs = Math.round(Number(body.dwellMs));
  if (!Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }
  if (!Number.isFinite(dwellMs) || dwellMs <= 0) {
    return NextResponse.json({ error: 'invalid_dwell' }, { status: 400 });
  }

  // 남의 행을 못 고치게 방문자 쿠키를 대조한다. service_role 이라 RLS 가 안 걸리므로
  // 이 확인이 유일한 방어선이다. 같은 조회에서 기존 값도 읽어 온다(아래 참고).
  const { data: row } = await admin
    .from('page_views')
    .select('id, visitor_id, dwell_ms')
    .eq('id', id)
    .maybeSingle();
  if (!row || row.visitor_id !== visitorId) return NextResponse.json({ ok: true });

  // 한 화면에서 비콘이 여러 번 날아온다(탭 숨김 → 복귀 → 이동). 누적값을 보내므로
  // 나중 것이 항상 더 크다 → 큰 값만 남긴다. 순서가 뒤집혀 도착해도 값이 줄지 않는다.
  const next = Math.min(dwellMs, MAX_DWELL_MS);
  if ((row.dwell_ms ?? 0) >= next) return NextResponse.json({ ok: true });

  await admin.from('page_views').update({ dwell_ms: next }).eq('id', id);

  return NextResponse.json({ ok: true });
}
