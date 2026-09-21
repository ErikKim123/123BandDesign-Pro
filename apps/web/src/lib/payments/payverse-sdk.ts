// Design Ref: §5 Phase 4 — PayVerse 결제창 SDK 로더 (브라우저 전용).
// SDK 는 npm 패키지가 없고 스크립트 태그로만 배포된다(window.payVerse 를 심는 UMD 스크립트).
// 샌드박스/운영 주소가 다르므로 URL 은 서버(/api/payments/checkout)가 내려준 값을 쓴다.

/** 결제창이 돌려주는 결과 — 상세는 서버 거래조회로 재확인하므로 식별자 위주로만 쓴다. */
export interface PayverseResult {
  /** SUCCESS | PROCESSING | PENDING | DECLINE | FAILED */
  resultStatus?: string;
  resultCode?: string;
  resultMessage?: string;
  tid?: string;
  orderId?: string;
  schemeGroup?: string;
  schemeCode?: string;
  paymentUrl?: string;
  mallReserved?: string;
}

/** 서버가 만들어 내려준 결제창 요청 파라미터(서명 포함). 클라이언트는 손대지 않고 그대로 전달한다. */
export type PayverseRequest = Record<string, string>;

export interface PayverseSdk {
  requestUI(req: PayverseRequest, callback: (result: PayverseResult) => void): void;
}

declare global {
  interface Window {
    payVerse?: PayverseSdk;
  }
}

// 같은 URL 을 두 번 붙이지 않도록 로딩 프로미스를 재사용한다.
const loading = new Map<string, Promise<PayverseSdk>>();

export function loadPayverseSdk(src: string): Promise<PayverseSdk> {
  if (typeof window === 'undefined') return Promise.reject(new Error('browser only'));
  if (window.payVerse) return Promise.resolve(window.payVerse);

  const cached = loading.get(src);
  if (cached) return cached;

  const p = new Promise<PayverseSdk>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    const script = existing ?? document.createElement('script');
    const onLoad = () => {
      if (window.payVerse) resolve(window.payVerse);
      else reject(new Error('payverse sdk loaded but window.payVerse is missing'));
    };
    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener(
      'error',
      () => {
        loading.delete(src); // 재시도 가능하도록 캐시를 비운다
        reject(new Error('payverse sdk load failed'));
      },
      { once: true },
    );
    if (!existing) {
      script.src = src;
      script.async = true;
      document.head.appendChild(script);
    } else if (window.payVerse) {
      onLoad();
    }
  });

  loading.set(src, p);
  return p;
}
