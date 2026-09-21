// 송금(계좌이체/카카오페이/Wise/SWIFT) 계좌·링크 상수 — 체크아웃과 주문내역(재결제)에서 공용.
// ⚠️ 실제 입금 계좌 정보 — 한 곳에서만 관리해 두 화면이 어긋나지 않게 한다. 변경 시 여기만 수정.

// 국내(원화) 무통장입금 계좌 — 원화 결제에서 계좌이체 옵션으로 노출.
export const KRW_BANK = {
  bank: '우리은행',
  holder: '(주)123솔루션',
  accountName: '우리CUBE기업자유예금',
  accountNo: '1005-603-973225',
};

// 카카오페이 송금 링크 — QR/버튼 모두 이 URL 로 연결(스캔·클릭 시 카카오페이 송금).
export const KAKAOPAY_URL = 'https://qr.kakaopay.com/FcKquStUp';

// 위챗페이 수취 QR — 중화권 고객용. Wise 아래에 노출.
// ⚠️ 위챗 수취 QR 은 wxp:// 페이로드라 URL 로 재생성할 수 없다. 실제 QR 이미지를 public/ 에 두고 경로만 여기서 관리.
// 비우면(''), 이미지가 없거나 로드에 실패하면 체크아웃에서 위챗 블록이 통째로 숨겨진다.
// payUrl: QR 에서 디코딩한 wxp:// 값. 위챗 앱이 등록한 스킴이라 '모바일에서만' 열린다
// (데스크톱 브라우저는 핸들러가 없어 무반응). 비우면 '위챗으로 열기' 버튼이 숨겨진다.
// ⚠️ 개인 수취 QR 이라 가맹점 결제가 아니다 — 입금은 여전히 팀이 수동 확인한다.
export const WECHAT_PAY = {
  qrSrc: '/wechat-pay-qr.png',
  payUrl: 'wxp://f2f019aPOnoGA2_Kec8bm8Etx4ScbmridtLTi6Q62cnzYSI',
  payee: 'Noble(***K)',
};

// 외화(USD) 계좌 — 해외 고객 SWIFT 국제송금용. Wise 아래에 노출.
// ⚠️ SWIFT/BIC(HVBKKRSEXXX)는 우리은행 공통 코드 — 운영 전 반드시 재확인.
export const FX_BANK = {
  bank: 'Woori Bank',
  swift: 'HVBKKRSEXXX',
  accountNo: '1081-701-692135',
  holder: '123 Solution Co., Ltd.',
  currency: 'USD',
};
