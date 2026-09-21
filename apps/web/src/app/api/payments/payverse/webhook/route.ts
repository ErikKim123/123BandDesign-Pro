// Design Ref: §5 Phase 4 — PayVerse 웹훅(서버 권위 확정 보강).
// 승인/취소 성공 시 PayVerse 가 POST(JSON)로 알린다. 수신 실패하면 1분 후부터 10분 간격으로 총 10회 재전송.
// 정상 처리했으면 receiveResult='SUCCESS' 로 응답해야 재전송이 멈춘다.
//
// 페이로드는 sign 으로 발신자만 확인하고, 금액/상태 확정은 거래조회 API 재조회에 맡긴다.
import { NextResponse } from 'next/server';
import { payverseMerchantByMid } from '@/lib/payments/config';
import { verifyWebhookSign, type PayverseWebhook } from '@/lib/payments/payverse';
import { confirmPayverseOrder } from '@/lib/payments/payverse-confirm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ack = () => NextResponse.json({ receiveResult: 'SUCCESS' });

export async function POST(req: Request) {
  let hook: PayverseWebhook;
  try {
    hook = (await req.json()) as PayverseWebhook;
  } catch {
    return ack(); // 파싱 불가 페이로드로 재전송을 유발하지 않는다.
  }

  const merchant = hook.mid ? payverseMerchantByMid(hook.mid) : null;
  if (!merchant) {
    console.warn('[payverse:webhook] 알 수 없는 mid', hook.mid);
    return ack();
  }
  if (!verifyWebhookSign(hook, merchant.secretKey)) {
    // 서명 불일치 = 우리 가맹점 발신이 아님. 확정하지 않고 로그만 남긴다.
    console.warn('[payverse:webhook] 서명 불일치', { mid: hook.mid, orderId: hook.orderId });
    return ack();
  }

  // 취소 알림은 주문 확정 대상이 아니다(환불 처리는 어드민 주문관리에서 수행).
  if (hook.type === 'Refund') return ack();

  if (hook.orderId) {
    try {
      const result = await confirmPayverseOrder({ orderNo: hook.orderId, tid: hook.tid ?? null });
      if (!result.ok) {
        console.warn('[payverse:webhook] 확정 보류', { orderId: hook.orderId, reason: result.reason });
      }
    } catch (e) {
      // 우리 쪽 일시 오류 — 실패로 응답해 PayVerse 재전송을 받는다.
      console.error('[payverse:webhook] 확정 실패', e);
      return NextResponse.json({ receiveResult: 'FAILED' }, { status: 500 });
    }
  }
  return ack();
}
