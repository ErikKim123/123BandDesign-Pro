// PayVerse 결제수단 허용 정책 — 클라이언트(체크아웃 안내)·서버(확정 차단)가 같이 본다.
//
// 결제창에서 수단을 숨기는 요청 파라미터는 없다(SDK ALLOWED_PARAMS 에 수단 항목이 없음).
// 결제창 탭은 가맹점 설정(methodList)이 정하므로, 우리는 '확정 단계'에서 거른다.
// 결제창 번들(ui.payverseglobal.com/puzzle)에서 확인한 schemeGroup 값:
//   CARD   = 국내/해외 카드 탭      GLOBAL = 해외카드 브랜드 목록
//   PVKR   = 카드번호 직접입력(schemeCode KEYIN)
//   APM    = 간편결제                BANK   = 계좌이체
//
// 카드 결제를 다시 열려면 CARD_PAYMENTS_ENABLED 를 true 로 바꾸면 된다.

export const CARD_PAYMENTS_ENABLED = false;

const CARD_SCHEME_GROUPS = new Set(['CARD', 'GLOBAL', 'PVKR']);

/** 이 거래가 지금 받지 않는 결제수단(카드)으로 승인됐는지. */
export function isBlockedScheme(schemeGroup: string | null | undefined): boolean {
  if (CARD_PAYMENTS_ENABLED) return false;
  return CARD_SCHEME_GROUPS.has((schemeGroup ?? '').trim().toUpperCase());
}
