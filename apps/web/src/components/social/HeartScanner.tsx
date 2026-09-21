// QR 스캔 — "하트 주기" 쪽. 상대의 QR 을 카메라로 찍어 그 자리에서 하트를 보낸다.
// 인식은 html5-qrcode(파트너 입장확인과 동일 라이브러리)로 한다. 브라우저 내장
// BarcodeDetector 는 iOS Safari 에 아직 없어서 실기기에서 전부 "미지원"으로 떨어졌다.
// 카메라 자체를 못 여는 경우(권한 거부·http 접속 등)에만 코드 직접 입력으로 폴백한다.
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Keyboard, QrCode, RotateCcw, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { CharacterAvatar } from '@/components/account/CharacterAvatar';
import { ReactionPicker } from '@/components/social/ReactionPicker';
import type { ReactionKind } from '@/lib/social/reactions';
import type { Dictionary } from '@/i18n/dictionaries';

// html5-qrcode 가 <video> 를 심을 컨테이너 id
const REGION_ID = 'band-heart-qr-reader';

interface ScannerLike {
  stop(): Promise<void>;
  clear(): void;
}

/** 카메라 자체가 불가능한 환경인지(https 아님 / getUserMedia 없음) 미리 판별. */
function cameraAvailable(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    window.isSecureContext
  );
}

interface ScannedProfile {
  name: string | null;
  avatar_seed: string | null;
  avatar_url: string | null;
  avatar_traits: unknown;
  social_code: string;
  hearts_received: number;
  blocked: boolean;
  is_me: boolean;
  /** 오늘 이 상대에게 이미 보낸 반응 종류 */
  sent_kinds: ReactionKind[] | null;
}

// gen_social_code() 알파벳(혼동문자 0/1/I/O 제외) 8자리
const CODE_RE = /^[2-9A-HJ-NP-Z]{8}$/;

/** QR 원문에서 소셜 코드만 뽑는다 — 전체 URL(/{locale}/u/{code})과 코드 단독 모두 허용. */
function extractCode(raw: string): string | null {
  const value = raw.trim();
  const direct = value.toUpperCase();
  if (CODE_RE.test(direct)) return direct;
  try {
    const seg = new URL(value).pathname.split('/').filter(Boolean).pop() ?? '';
    const upper = seg.toUpperCase();
    return CODE_RE.test(upper) ? upper : null;
  } catch {
    return null; // URL 이 아니고 코드 형식도 아님
  }
}

export function HeartScanner({ t }: { t: Dictionary['social'] }) {
  // 한 번 인식되면 이후 프레임 콜백은 무시(중복 조회 방지)
  const decodedRef = useRef(false);

  const [mode, setMode] = useState<'idle' | 'camera' | 'manual'>('idle');
  const [manual, setManual] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState<ScannedProfile | null>(null);

  const lookup = useCallback(
    async (code: string) => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await createClient().rpc('social_profile_by_code', { p_code: code });
        const profile = (data ?? null) as ScannedProfile | null;
        if (!profile) {
          setError(t.notFound);
          return false;
        }
        if (profile.is_me) {
          setError(t.errSelf);
          return false;
        }
        setFound(profile);
        return true;
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  function startCamera() {
    setError(null);
    setFound(null);
    decodedRef.current = false;

    if (!cameraAvailable()) {
      // http 접속이나 카메라 API 자체가 없는 환경 — 코드 직접 입력으로 전환
      setMode('manual');
      setError(t.cameraUnsupported);
      return;
    }
    setMode('camera');
  }

  // 실제 카메라 기동은 컨테이너(#REGION_ID)가 DOM 에 올라온 뒤에야 가능하므로 effect 로 분리.
  // 라이브러리는 스캔을 시작할 때만 동적 import 해서 초기 번들에 싣지 않는다.
  useEffect(() => {
    if (mode !== 'camera') return;
    let cancelled = false;
    let scanner: ScannerLike | null = null;

    const stopScanner = (s: ScannerLike) =>
      s
        .stop()
        .then(() => s.clear())
        .catch(() => {}); // 아직 시작 전이면 stop 이 throw — 무시

    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;
        const instance = new Html5Qrcode(REGION_ID, { verbose: false });
        scanner = instance;
        await instance.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            // 뷰파인더 크기에 맞춰 스캔 박스를 잡는다(컨테이너보다 크면 라이브러리가 경고).
            qrbox: (w: number, h: number) => {
              const side = Math.max(120, Math.floor(Math.min(w, h) * 0.75));
              return { width: side, height: side };
            },
          },
          (text: string) => {
            if (decodedRef.current) return;
            const code = extractCode(text);
            if (!code) return; // 우리 QR 이 아니면 계속 스캔
            decodedRef.current = true;
            setMode('idle'); // cleanup 이 카메라를 정리한다
            void lookup(code);
          },
          () => {}, // 프레임별 디코드 실패는 정상 — 무시
        );
        if (cancelled) await stopScanner(instance);
      } catch {
        if (cancelled) return;
        setMode('manual');
        setError(t.cameraDenied);
      }
    })();

    return () => {
      cancelled = true;
      if (scanner) void stopScanner(scanner);
    };
  }, [mode, lookup, t]);

  function close() {
    setMode('idle');
    setError(null);
  }

  async function submitManual() {
    const code = extractCode(manual);
    if (!code) {
      setError(t.manualInvalid);
      return;
    }
    if (await lookup(code)) {
      setMode('idle');
      setManual('');
    }
  }

  function reset() {
    setFound(null);
    setError(null);
    setManual('');
  }

  // ── 스캔 결과: 상대 확인 후 하트 전송 ──
  if (found) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-grey-200 bg-white p-5 text-center">
        <h3 className="font-display text-lg">{t.scanTitle}</h3>
        <div className="mt-4">
          <CharacterAvatar
            seed={found.avatar_seed}
            photoUrl={found.avatar_url}
            traits={found.avatar_traits}
            size={72}
            label={found.name ?? ''}
          />
        </div>
        <p className="mt-2 font-medium">{found.name || t.anonymous}</p>
        <p className="font-mono text-xs tracking-[0.2em] text-grey-400">{found.social_code}</p>

        <div className="mt-4 w-full">
          {found.blocked ? (
            <p className="rounded-lg border border-grey-200 p-4 text-sm text-grey-500">
              {t.errBlocked}
            </p>
          ) : (
            <ReactionPicker
              code={found.social_code}
              sentKinds={found.sent_kinds ?? []}
              t={t}
            />
          )}
        </div>

        <button type="button" onClick={reset} className="btn btn-secondary btn-sm mt-3">
          <RotateCcw size={15} aria-hidden /> {t.scanAgain}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center rounded-xl border border-grey-200 bg-white p-5 text-center">
      <h3 className="font-display text-lg">{t.scanTitle}</h3>
      <p className="mt-1 text-xs text-grey-500">{t.scanHint}</p>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {mode === 'camera' && (
        <div className="mt-4 w-full">
          {/* 뷰파인더 — html5-qrcode 가 이 안에 <video> 와 스캔 박스를 그린다 */}
          <div
            id={REGION_ID}
            aria-label={t.scanning}
            className="mx-auto w-full max-w-[260px] overflow-hidden rounded-lg bg-black [&_video]:w-full"
          />
          <p className="mt-2 text-xs text-grey-500">{t.scanning}</p>
          <button type="button" onClick={close} className="btn btn-secondary btn-sm mt-3">
            <X size={15} aria-hidden /> {t.scanStop}
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode('manual');
            }}
            className="btn btn-secondary btn-sm mt-2 w-full"
          >
            <Keyboard size={15} aria-hidden /> {t.manualTitle}
          </button>
        </div>
      )}

      {mode === 'manual' && (
        <div className="mt-4 w-full space-y-2">
          <input
            className="input text-center font-mono tracking-[0.2em]"
            maxLength={80}
            placeholder={t.manualPlaceholder}
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submitManual();
            }}
          />
          <button
            type="button"
            onClick={submitManual}
            disabled={loading || !manual.trim()}
            className="btn btn-primary btn-sm w-full"
          >
            <QrCode size={15} aria-hidden /> {loading ? t.sending : t.manualSubmit}
          </button>
          <button type="button" onClick={close} className="btn btn-secondary btn-sm w-full">
            {t.cancel}
          </button>
        </div>
      )}

      {mode === 'idle' && (
        <div className="mt-4 w-full space-y-2">
          <button
            type="button"
            onClick={startCamera}
            disabled={loading}
            className="btn btn-primary btn-sm w-full"
          >
            <Camera size={15} aria-hidden /> {t.scanStart}
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode('manual');
            }}
            className="btn btn-secondary btn-sm w-full"
          >
            <Keyboard size={15} aria-hidden /> {t.manualTitle}
          </button>
        </div>
      )}
    </div>
  );
}
