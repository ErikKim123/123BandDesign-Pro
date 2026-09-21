// 오거나이저 가입 직후 프로필/오거나이저(partners) 신청을 보장 생성.
// 파트너 앱은 service_role 을 두지 않으므로(설계 §10.3), service_role 을 보유한
// 웹의 /api/account/ensure 로 서버-서버 프록시한다(브라우저 직접 호출은 CORS 차단).
// 웹 ensure 가 이메일 자동확인 + profiles/partners(pending) 생성 + 운영자 알림(승인 링크)까지 처리.
import { NextResponse } from 'next/server';

const WEB_BASE = process.env.NEXT_PUBLIC_WEB_URL ?? 'https://123band-web.vercel.app';

export async function POST(req: Request) {
  let userId = '';
  try {
    const body = (await req.json()) as { userId?: string };
    userId = (body.userId ?? '').trim();
  } catch {
    /* ignore */
  }
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  try {
    const r = await fetch(`${WEB_BASE}/api/account/ensure`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json(j, { status: r.status });
  } catch {
    // 웹 도달 실패해도 가입 흐름은 막지 않음 → 이메일 확인 폴백으로 진행
    return NextResponse.json({ ok: false, skipped: true });
  }
}
