// Design Ref: §5.4 주문관리 — 환불(PG 취소 + 주문 상태 전이).
//
// 기존에는 '환불' 버튼이 orders.status 만 'refunded' 로 바꿨고, 실제 카드 취소는
// 가맹점관리자에서 손으로 해야 했다. 여기서 PayVerse 취소 API 까지 함께 처리한다.
//
// 순서가 중요하다 — 먼저 PG 취소를 호출하고, 성공했을 때만 주문 상태를 바꾼다.
// (반대로 하면 상태는 '환불'인데 돈은 안 돌아간 주문이 생긴다.)
import { NextResponse } from 'next/server';
import { cancelPayversePayment } from '@123band/shared/payments';
import type { Currency } from '@123band/shared';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface OrderRow {
  id: string;
  order_no: string;
  status: string;
  payment_method: string | null;
  payment_ref: string | null;
  currency: string;
  total_amount: number;
}

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: '인증이 필요합니다.', status: 401 as const };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin') {
    return { ok: false as const, error: '관리자 권한이 필요합니다.', status: 403 as const };
  }
  return { ok: true as const, supabase, adminId: user.id, email: user.email ?? '' };
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }

  const orderId = String(body.orderId ?? '');
  const reason = typeof body.reason === 'string' ? body.reason : '';
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
    return NextResponse.json({ error: '잘못된 주문 ID 입니다.' }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from('orders')
    .select('id, order_no, status, payment_method, payment_ref, currency, total_amount')
    .eq('id', orderId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const order = data as OrderRow | null;
  if (!order) return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });
  if (order.status === 'refunded') {
    return NextResponse.json({ ok: true, alreadyRefunded: true, orderNo: order.order_no });
  }
  if (order.status !== 'paid') {
    return NextResponse.json(
      { error: `결제완료 주문만 환불할 수 있습니다. (현재 상태: ${order.status})` },
      { status: 400 },
    );
  }

  // PG 취소가 필요 없는 주문(계좌이체·무료)은 상태만 바꾼다 — 송금 환불은 운영자가 직접 이체.
  const needsPgCancel = order.payment_method === 'payverse' && order.payment_ref !== 'free';

  // 자동 취소가 안 되는 이유를 구분해서 알려준다.
  //  legacy_pg: PortOne 시절 결제 — 연동이 제거돼 자동취소 불가, 해당 PG 관리자에서 수동 취소해야 한다.
  //  transfer : 계좌이체/무료 — 애초에 PG 를 안 탔으므로 직접 이체(또는 환급 불필요).
  const manual: 'none' | 'legacy_pg' | 'transfer' = needsPgCancel
    ? 'none'
    : order.payment_method && order.payment_method !== 'payverse' && order.payment_ref
      ? 'legacy_pg'
      : 'transfer';

  if (needsPgCancel) {
    if (!order.payment_ref) {
      return NextResponse.json(
        { error: '결제 식별자(TID)가 없어 PG 취소를 할 수 없습니다. 가맹점관리자에서 직접 취소해 주세요.' },
        { status: 409 },
      );
    }
    const result = await cancelPayversePayment({
      currency: order.currency as Currency,
      tid: order.payment_ref,
      amountMinor: Number(order.total_amount),
      reason: reason || `주문 ${order.order_no} 환불`,
      worker: auth.email || auth.adminId,
    });
    if (!result.ok) {
      // 주문 상태는 건드리지 않는다 — 돈이 안 돌아갔는데 '환불'로 보이면 안 된다.
      console.error('[orders:refund] PayVerse 취소 실패', {
        orderNo: order.order_no,
        resultCode: result.resultCode,
        resultMessage: result.resultMessage,
      });
      return NextResponse.json(
        {
          error: `PG 취소에 실패했습니다: ${result.resultMessage ?? '알 수 없는 오류'}`,
          resultCode: result.resultCode ?? null,
        },
        { status: 502 },
      );
    }
  }

  const { error: upErr } = await auth.supabase
    .from('orders')
    .update({ status: 'refunded' })
    .eq('id', order.id);
  if (upErr) {
    // PG 취소는 됐는데 상태 반영이 실패한 경우 — 재시도하면 alreadyRefunded 가 아니라
    // '취소된 거래 재취소' 가 되므로, 운영자가 알 수 있도록 분명히 알린다.
    return NextResponse.json(
      {
        error: `PG 취소는 완료됐지만 주문 상태 변경에 실패했습니다. 주문 ${order.order_no} 를 수동으로 '환불'로 바꿔 주세요. (${upErr.message})`,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    orderNo: order.order_no,
    pgCancelled: needsPgCancel,
    manual,
  });
}
