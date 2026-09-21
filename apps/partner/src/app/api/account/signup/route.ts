// 오거나이저 가입 — service_role 을 보유한 web 의 /api/account/signup 으로 서버-서버 프록시.
// web 라우트가 admin.createUser(email_confirm)로 즉시 활성 계정 생성 → Supabase 확인메일 미발송.
// (파트너 앱은 service_role 미보유. 브라우저 직접 호출은 CORS 차단 → 서버 프록시.)
import { NextResponse } from 'next/server';

const WEB_BASE = process.env.NEXT_PUBLIC_WEB_URL ?? 'https://123band-web.vercel.app';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }
  try {
    const r = await fetch(`${WEB_BASE}/api/account/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json(j, { status: r.status });
  } catch {
    // web 도달 실패 → 클라가 일반 signUp 으로 폴백하도록 신호
    return NextResponse.json({ ok: false, noAdmin: true });
  }
}
