// Design Ref: §5 Phase 4 — PayVerse 결제 확정 공통 경로.
// 결제 결과는 (데스크톱)콜백 · (모바일)복귀 · 웹훅 세 갈래로 들어오는데, 어느 쪽이든
// 전달값을 그대로 믿지 않고 여기서 거래조회 API 로 재확인한 뒤 주문을 확정한다. 멱등.
import 'server-only';
import { createAdminClient, type Currency } from '@123band/shared';
import {
  cancelPayversePayment,
  getPayverseTransaction,
  getPayverseTransactionByOrderId,
  isPaidTransaction,
  payverseReqDay,
  type PayverseTransaction,
} from './payverse';
import { finalizeOrder } from './finalize';
import { isBlockedScheme } from './methods';

export type ConfirmResult =
  | { ok: true; orderNo: string; already: boolean }
  /** 아직 승인 전(가상계좌 발급·인증 진행 중 등) — 주문은 pending 유지, 웹훅으로 추후 확정. */
  | { ok: false; reason: 'pending'; orderNo: string; status: string | null }
  /** 받지 않는 수단(카드)으로 승인됨 — 확정하지 않고 PG 취소. refunded=false 면 취소 실패(수동 환불 필요). */
  | { ok: false; reason: 'card_blocked'; orderNo: string; refunded: boolean }
  | { ok: false; reason: 'not_found' | 'not_paid' | 'amount_mismatch' | 'finalize_failed' };

interface OrderRow {
  id: string;
  order_no: string;
  status: string;
  total_amount: number;
  currency: string;
}

const PENDING_STATUSES = new Set(['PROCESSING', 'PENDING']);

/**
 * 주문(UUID 또는 order_no)과 TID 로 결제를 확정한다.
 * tid 가 없으면 주문번호+요청일자로 거래를 되찾는다(복귀 파라미터 유실 대비).
 */
export async function confirmPayverseOrder(params: {
  orderId?: string | null;
  orderNo?: string | null;
  tid?: string | null;
}): Promise<ConfirmResult> {
  const admin = createAdminClient();

  const query = admin.from('orders').select('id, order_no, status, total_amount, currency');
  const { data: row } = params.orderId
    ? await query.eq('id', params.orderId).maybeSingle()
    : await query.eq('order_no', params.orderNo ?? '').maybeSingle();
  const order = row as OrderRow | null;
  if (!order) return { ok: false, reason: 'not_found' };

  // 이미 확정된 주문 — 재조회 없이 성공 반환(웹훅 재전송/중복 복귀 대비).
  if (['paid', 'shipped', 'done'].includes(order.status)) {
    return { ok: true, orderNo: order.order_no, already: true };
  }

  const currency = order.currency as Currency;

  let tx: PayverseTransaction | null = null;
  if (params.tid) {
    tx = await getPayverseTransaction(currency, params.tid);
  }
  if (!tx || tx.resultStatus !== 'SUCCESS') {
    // TID 경로가 비었으면 주문번호로 재시도. 요청일자는 오늘/어제(자정 전후 결제) 둘 다 본다.
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    for (const day of [payverseReqDay(now), payverseReqDay(yesterday)]) {
      const found = await getPayverseTransactionByOrderId(currency, order.order_no, day);
      if (found?.resultStatus === 'SUCCESS') {
        tx = found;
        break;
      }
    }
  }

  if (!tx || tx.resultStatus !== 'SUCCESS') {
    return { ok: false, reason: 'not_paid' };
  }
  if (PENDING_STATUSES.has(tx.transactionStatus ?? '')) {
    return { ok: false, reason: 'pending', orderNo: order.order_no, status: tx.transactionStatus };
  }
  if (!isPaidTransaction(tx, { currency, totalMinor: order.total_amount })) {
    // 승인 실패(DECLINE/FAILED)와 금액 불일치를 구분해 남긴다 — 후자는 수동 점검 대상.
    return {
      ok: false,
      reason: tx.transactionStatus === 'SUCCESS' ? 'amount_mismatch' : 'not_paid',
    };
  }

  // 카드 결제는 당분간 받지 않는다 — 결제창에서 탭을 숨길 수 없어 확정 단계에서 되돌린다.
  if (isBlockedScheme(tx.schemeGroup)) {
    return rejectBlockedPayment(admin, order, tx);
  }

  const result = await finalizeOrder({
    orderId: order.id,
    provider: 'payverse',
    paymentRef: tx.tid,
    paidAmount: order.total_amount,
    paidCurrency: currency,
  });
  if (!result.ok) return { ok: false, reason: 'finalize_failed' };
  return { ok: true, orderNo: result.orderNo, already: result.already };
}

/**
 * 카드로 승인된 거래를 취소하고 주문을 cancelled 로 닫는다(패스도 무효 처리됨).
 * 콜백·복귀·웹훅이 동시에 들어오면 두 번째 취소는 실패한다 → 주문이 이미 닫혔으면 성공으로 본다.
 */
async function rejectBlockedPayment(
  admin: ReturnType<typeof createAdminClient>,
  order: OrderRow,
  tx: PayverseTransaction,
): Promise<ConfirmResult> {
  const cancel = await cancelPayversePayment({
    currency: order.currency as Currency,
    tid: tx.tid,
    amountMinor: order.total_amount,
    reason: '카드 결제 미운영(간편결제만 허용) — 자동 취소',
    worker: 'band-auto',
  });

  if (cancel.ok) {
    await admin
      .from('orders')
      .update({ status: 'cancelled', payment_ref: tx.tid })
      .eq('id', order.id)
      .eq('status', 'pending');
    console.warn('[payverse] 카드 결제 자동 취소', { orderNo: order.order_no, tid: tx.tid, schemeGroup: tx.schemeGroup });
    return { ok: false, reason: 'card_blocked', orderNo: order.order_no, refunded: true };
  }

  const { data: now } = await admin.from('orders').select('status').eq('id', order.id).maybeSingle();
  if ((now as { status?: string } | null)?.status === 'cancelled') {
    return { ok: false, reason: 'card_blocked', orderNo: order.order_no, refunded: true };
  }

  // 취소 실패 — 고객은 결제된 상태. 주문은 pending 으로 두고 TID 를 남겨 수동 환불할 수 있게 한다.
  await admin.from('orders').update({ payment_ref: tx.tid }).eq('id', order.id).eq('status', 'pending');
  console.error('[payverse] 카드 결제 자동 취소 실패 — 수동 환불 필요', {
    orderNo: order.order_no,
    tid: tx.tid,
    result: cancel,
  });
  return { ok: false, reason: 'card_blocked', orderNo: order.order_no, refunded: false };
}
