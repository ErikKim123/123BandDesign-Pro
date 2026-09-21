// Design Ref: §5 Phase 4 — PayVerse(이롬넷) 결제 서버 모듈. 서버 전용.
//
// 흐름
//   1) 서버가 결제창 파라미터 + sign(위변조 서명)을 만들어 브라우저에 내려준다.
//   2) 브라우저 SDK 가 window.payVerse.requestUI() 로 통합결제창을 띄운다.
//   3) 결제 결과는 (데스크톱) 콜백 · (모바일) returnUrl 리다이렉트 · webhook 세 경로로 돌아온다.
//   4) 어느 경로든 결과 자체는 신뢰하지 않고, 거래조회 API 로 재조회해 금액/통화/상태를 확인한 뒤 확정한다.
//
// 서명/조회/취소 구현은 @123band/shared/payments 에 있다(어드민 환불이 같은 로직을 쓴다).
// 여기서는 web 전용 진입점으로 재노출하고, 웹훅 검증만 담당한다.
import 'server-only';
import { payverseSign } from '@123band/shared/payments';

export type {
  PayverseTransaction,
  CancelResult,
} from '@123band/shared/payments';
export {
  payverseSign,
  payverseReqDate,
  payverseReqDay,
  payverseAmount,
  payverseAmountToMinor,
  getPayverseTransaction,
  getPayverseTransactionByOrderId,
  isPaidTransaction,
  cancelPayversePayment,
} from '@123band/shared/payments';

// ── 웹훅 ────────────────────────────────────────────────────

/** 승인/취소 성공 알림 페이로드(사용하는 필드만). */
export interface PayverseWebhook {
  type?: string; // 'Sale'(승인) | 'Refund'(취소)
  mid?: string;
  tid?: string;
  orderId?: string;
  requestCurrency?: string;
  requestAmount?: string | number;
  resultStatus?: string;
  approvalDay?: string;
  cancelDay?: string;
  sign?: string;
}

/**
 * 웹훅 서명 검증. 승인/취소에 따라 마지막 필드(approvalDay/cancelDay)가 다르다.
 * 서명이 맞아도 금액 확정은 거래조회로 다시 확인한다(서명은 발신자 확인용).
 */
export function verifyWebhookSign(hook: PayverseWebhook, secretKey: string): boolean {
  if (!hook.sign || !hook.mid || !hook.orderId || hook.requestAmount == null) return false;
  const day = hook.type === 'Refund' ? hook.cancelDay : hook.approvalDay;
  if (!day) return false;
  const expected = payverseSign([
    secretKey,
    hook.mid,
    hook.orderId,
    String(hook.requestAmount),
    day,
  ]);
  return expected === hook.sign;
}
