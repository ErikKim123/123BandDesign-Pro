// 방문자 ↔ 회원 연결 기록 — 어드민 사용자별 행동 분석용(0060).
//
// 왜 별도 라우트인가: 로그인 경로가 여러 갈래다(이메일/비번, 소셜 OAuth 콜백, 휴대폰 OTP).
// 각 경로에 훅을 심는 대신, 비콘이 브라우저 세션당 1회만 여기를 두드리게 한다.
// /api/track 안에서 처리하지 않는 이유는 페이지뷰마다 인증 서버 왕복이 붙기 때문이다.
//
// 신뢰: user_id 를 클라이언트가 보내는 게 아니라 서버가 세션에서 직접 읽는다(위조 불가).
//
// ⚠️ 개인정보: 회원 개인의 열람 이력과 연결되는 데이터다. 개인정보처리방침 고지 대상.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { VISITOR_ID_COOKIE } from '@/lib/supabase/cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const visitorId = cookies().get(VISITOR_ID_COOKIE)?.value;
  if (!visitorId) return NextResponse.json({ ok: true }); // 미들웨어를 안 거친 드문 요청

  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user) return NextResponse.json({ ok: true }); // 비로그인 — 남길 게 없다

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: true }); // 키 미설정 로컬 환경

  // (visitor_id, user_id) 가 기본키 — 같은 쌍이면 마지막 목격 시각만 갱신한다.
  await admin
    .from('visitor_identities')
    .upsert(
      { visitor_id: visitorId, user_id: user.id, last_seen_at: new Date().toISOString() },
      { onConflict: 'visitor_id,user_id' },
    );

  return NextResponse.json({ ok: true });
}
