// 카메라 QR 스캐너 (html5-qrcode) — 파트너 입장확인(apps/partner checkin/QrScanner.tsx)과 같은 구현.
// 스캔되면 onDecode(text) 1회 호출. 콜백은 ref 로 잡아 effect 는 최초 1회만 실행(부모 리렌더로 재시작 방지).
'use client';
import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const REGION_ID = 'band-admin-qr-reader';

export function QrScanner({
  onDecode,
  onError,
}: {
  onDecode: (text: string) => void;
  onError?: (msg: string) => void;
}) {
  const onDecodeRef = useRef(onDecode);
  const onErrorRef = useRef(onError);
  onDecodeRef.current = onDecode;
  onErrorRef.current = onError;
  const decodedOnce = useRef(false);

  useEffect(() => {
    const scanner = new Html5Qrcode(REGION_ID, { verbose: false });
    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text) => {
          if (decodedOnce.current) return;
          decodedOnce.current = true;
          onDecodeRef.current(text);
        },
        () => {}, // 프레임별 디코드 실패는 무시(정상)
      )
      .catch((e: unknown) => {
        onErrorRef.current?.(e instanceof Error ? e.message : String(e));
      });
    return () => {
      scanner
        .stop()
        .then(() => scanner.clear())
        .catch(() => {});
    };
  }, []);

  return <div id={REGION_ID} className="w-full max-w-sm overflow-hidden rounded-lg border border-grey-200" />;
}
