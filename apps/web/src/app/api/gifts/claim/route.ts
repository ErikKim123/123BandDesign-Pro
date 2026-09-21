// 선물 받기(내 주문으로 이동) — 로그인 세션 기반. claim_gift RPC(SECURITY DEFINER)가 받는이 검증 후
// 패스 소유권 이전 + 시크릿 회전 + 활성화(valid)를 원자적으로 수행한다. 이동 후 주문내역에 QR 이 뜬다.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const KNOWN_ERRORS = ['gift_not_found', 'forbidden', 'unauthorized'];

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { giftId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const giftId = (body.giftId ?? '').trim();
  if (!giftId) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const { data, error } = await supabase.rpc('claim_gift', { p_gift_id: giftId });
  if (error) {
    const msg = error.message || 'error';
    const code = KNOWN_ERRORS.find((k) => msg.includes(k)) ?? 'error';
    return NextResponse.json({ error: code }, { status: 400 });
  }
  // moved=0 이면 이동할 유효 패스가 없었던 경우(보낸 사람이 이미 사용 등). 그래도 이력은 claimed 처리됨.
  return NextResponse.json({ ok: true, moved: (data as number) ?? 0 });
}
