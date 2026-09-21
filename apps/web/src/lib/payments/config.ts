// Design Ref: §5 Phase 4 — 결제 프로바이더 = PayVerse(이롬넷) 단일. 통화별 가맹점(mid) 분기.
// ko/KRW → KRW 가맹점, en/USD → USD 가맹점. 가맹점마다 mid/clientKey/secretKey 가 따로 발급된다.
//
// PayVerse 는 '통합결제창'이라 카드/간편결제 선택은 결제창 자체가 담당한다.
// → 가맹점 쪽에서 수단별 채널키를 관리할 필요가 없다(구 PortOne 방식과 다름).
//
// 실제 구현은 @123band/shared/payments 로 옮겼다(어드민 환불이 같은 서명/가맹점 로직을 써야 해서).
// 이 파일은 web 쪽 import 경로를 유지하기 위한 재노출 + web 전용 헬퍼만 남긴다.
import 'server-only';
import type { Currency } from '@123band/shared';
import { payverseMerchant } from '@123band/shared/payments';

export type {
  PayverseEnv,
  PayverseMerchant,
} from '@123band/shared/payments';
export {
  payverseEnv,
  payverseSdkUrl,
  payverseApiBase,
  payverseMerchant,
  payverseMerchantByMid,
} from '@123band/shared/payments';

export type Provider = 'payverse';

/** 결제 가능 여부(통화 기준) — 해당 통화의 가맹점 env 가 갖춰졌는지. */
export function isPaymentAvailable(currency: Currency): boolean {
  return payverseMerchant(currency) != null;
}

/** 결제 후 복귀 기준 URL. 배포 도메인 우선, 없으면 요청 origin 사용. */
export function siteOrigin(reqOrigin?: string): string {
  return process.env.NEXT_PUBLIC_SITE_URL || reqOrigin || 'http://localhost:3000';
}
