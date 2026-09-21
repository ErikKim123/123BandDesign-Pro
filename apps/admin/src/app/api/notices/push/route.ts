// 회원 알림 웹푸시 트리거 — 어드민이 알림을 보낸 직후 브라우저가 이 라우트를 부른다.
//
// 여기서 직접 푸시를 쏘지 않는 이유: 웹푸시 서명키(VAPID)와 암호화 코드는 고객몰(web)에만 있다.
// 어드민에도 한 벌 두면 키가 두 곳에 흩어진다 — 그래서 고객몰의 웹훅으로 넘긴다.
// 시크릿은 서버에만 있으므로 브라우저가 고객몰을 직접 부를 수는 없다(이 라우트가 그 다리다).
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WEB_BASE = process.env.NEXT_PUBLIC_WEB_URL ?? 'https://123band-web.vercel.app';

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: '인증이 필요합니다.', status: 401 as const };
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!profile || profile.role !== 'admin') {
    return { ok: false as const, error: '관리자 권한이 필요합니다.', status: 403 as const };
  }
  return { ok: true as const, supabase };
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { supabase } = auth;

  let body: { batchId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }
  const batchId = String(body.batchId ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(batchId)) {
    return NextResponse.json({ error: '잘못된 발송 ID 입니다.' }, { status: 400 });
  }

  // 시크릿과 고객몰 주소는 쿠폰 웹훅(0064)이 쓰는 app_settings 설정을 그대로 읽는다 —
  // 어드민에 같은 값을 환경변수로 한 벌 더 두면 둘이 어긋날 때 조용히 안 나간다.
  // app_settings 는 어드민 전용 RLS 라 이 세션(관리자)에서만 읽힌다. 없으면 env 로 폴백.
  const { data: cfgRow } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'notify.webhook')
    .maybeSingle();
  const cfg = (cfgRow?.value ?? {}) as { url?: string; secret?: string };
  const secret = (cfg.secret ?? '').trim() || (process.env.NOTIFY_WEBHOOK_SECRET ?? '');
  // 설정에 든 주소는 /api/notify/coupon 이다 — 같은 앱의 다른 경로를 쓰므로 도메인만 가져온다.
  let base = WEB_BASE;
  try {
    if (cfg.url) base = new URL(cfg.url).origin;
  } catch {
    // 주소가 깨져 있으면 env/기본값을 쓴다
  }

  // 시크릿이 없으면 푸시만 건너뛴다 — 알림은 이미 DB 에 들어가 사이트에서 보인다.
  if (!secret) return NextResponse.json({ ok: true, sent: null, reason: 'no_secret' });

  try {
    const r = await fetch(`${base}/api/notify/member-notice`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-notify-secret': secret },
      body: JSON.stringify({ batchId }),
    });
    const j = (await r.json().catch(() => ({}))) as { sent?: number; error?: string };
    if (!r.ok) return NextResponse.json({ ok: true, sent: null, reason: j.error ?? 'push_failed' });
    return NextResponse.json({ ok: true, sent: Number(j.sent ?? 0) });
  } catch {
    return NextResponse.json({ ok: true, sent: null, reason: 'push_unreachable' });
  }
}
