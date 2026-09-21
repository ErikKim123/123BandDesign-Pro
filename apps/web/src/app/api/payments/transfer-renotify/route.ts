// 재요청(입금 확인) — 이미 생성된 송금 주문(awaiting_payment)에 대해 고객이 "다시 알림"을 누르면:
//   운영자에게 입금 확인 요청 메일을 다시 발송한다. (주문을 새로 만들지 않는다 → 중복 주문 방지)
// 결제완료 전 주문내역 화면에서 재결제/재요청 버튼이 호출한다.
import { NextResponse } from 'next/server';
import { notifyAdminTransfer, pickI18n, type Locale } from '@123band/shared';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeLocale(v: unknown): Locale {
  return v === 'ko' ? 'ko' : 'en';
}

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { orderId?: string; locale?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const orderId = String(body.orderId ?? '').trim();
  if (!orderId) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const locale = normalizeLocale(body.locale);

  // 본인 주문만(RLS: orders_buyer_own). 입금 확인 대기 상태에서만 재요청 허용.
  const { data: order } = await supabase
    .from('orders')
    .select(
      'id, order_no, status, total_amount, currency, order_items(qty, products(name_i18n))',
    )
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (order.status !== 'awaiting_payment') {
    // 이미 확인(결제완료)됐거나 취소된 주문 — 재요청 불필요/불가.
    return NextResponse.json({ error: 'not_awaiting', status: order.status }, { status: 409 });
  }

  const items = ((order.order_items ?? []) as Array<{ qty: number; products: { name_i18n?: Record<string, string> } | null }>)
    .map((i) => ({ name: pickI18n(i.products?.name_i18n ?? {}, locale) || '123Band', qty: Number(i.qty) || 1 }))
    .slice(0, 50);

  const meta = (user.user_metadata ?? {}) as { name?: string; phone?: string };
  await notifyAdminTransfer({
    method: `재요청 · 주문 ${order.order_no}`,
    customerEmail: user.email ?? '(unknown)',
    customerName: meta.name ?? null,
    customerPhone: meta.phone ?? null,
    amountText: `${order.currency} ${order.total_amount}`,
    items,
  });

  return NextResponse.json({ ok: true, orderNo: order.order_no });
}
