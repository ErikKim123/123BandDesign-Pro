// 선물 보내기 API — 로그인 세션 기반. 검증/생성은 send_gift RPC(SECURITY DEFINER)가 수행.
// RPC 예외 메시지를 알려진 코드로 정규화해 프론트에서 안내 문구로 매핑한다.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const KNOWN_ERRORS = [
  'recipient_not_found',
  'cannot_gift_self',
  'not_enough_available',
  'not_a_pass',
  'order_not_active',
  'recipient_required',
  'invalid_qty',
  'forbidden',
  'item_not_found',
];

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { orderItemId?: string; email?: string; qty?: number; message?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const orderItemId = (body.orderItemId ?? '').trim();
  const email = (body.email ?? '').trim();
  const qty = Math.max(1, Math.round(Number(body.qty ?? 1)) || 1);
  const message = (body.message ?? '').trim().slice(0, 500);
  if (!orderItemId || !email) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const { data, error } = await supabase.rpc('send_gift', {
    p_order_item_id: orderItemId,
    p_recipient_email: email,
    p_qty: qty,
    p_message: message || null,
  });

  if (error) {
    const msg = error.message || 'error';
    const code = KNOWN_ERRORS.find((k) => msg.includes(k)) ?? 'error';
    return NextResponse.json({ error: code }, { status: 400 });
  }
  return NextResponse.json({ ok: true, gift: data });
}
