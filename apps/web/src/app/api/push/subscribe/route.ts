// 웹푸시 구독 등록/해제. 로그인 고객만.
// 구독 정보(endpoint/p256dh/auth)는 브라우저의 PushManager 가 만들어 준 값을 그대로 넘긴다.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { endpoint?: string; p256dh?: string; auth?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const endpoint = String(body.endpoint ?? '').trim();
  const p256dh = String(body.p256dh ?? '').trim();
  const auth = String(body.auth ?? '').trim();
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'invalid_subscription' }, { status: 400 });
  }
  // 푸시 서비스 endpoint 는 항상 https — 임의 URL 이 들어오면 서버가 그리로 POST 하게 된다(SSRF).
  if (!/^https:\/\//i.test(endpoint)) {
    return NextResponse.json({ error: 'invalid_endpoint' }, { status: 400 });
  }

  const { error } = await supabase.rpc('upsert_push_subscription', {
    p_endpoint: endpoint,
    p_p256dh: p256dh,
    p_auth: auth,
    p_user_agent: req.headers.get('user-agent') ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const endpoint = String(body.endpoint ?? '').trim();
  if (!endpoint) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  await supabase.rpc('delete_push_subscription', { p_endpoint: endpoint });
  return NextResponse.json({ ok: true });
}
