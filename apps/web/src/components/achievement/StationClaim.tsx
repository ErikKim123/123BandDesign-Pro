// 현장 QR 결과 화면. 로그인한 참가자는 열리는 순간 claim_station 으로 뱃지를 받는다.
//
// 자동으로 부르는 이유: QR 을 찍는 사람은 '찍으면 받는다' 를 기대한다. 버튼을 한 번 더 누르게 하면
// 사람이 몰린 현장에서 그대로 창을 닫고 가 버린다. 같은 QR 은 한 번만 세므로 다시 열어도 해가 없다.
'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Award, Check, Clock, Lock, MapPin, QrCode } from 'lucide-react';
import type { Locale } from '@123band/shared';
import type { Dictionary } from '@/i18n/dictionaries';
import { createClient } from '@/lib/supabase/client';
import { intlLocale } from '@/lib/locale';

export interface StationInfo {
  code: string;
  name: string;
  description: string;
  badge: string | null;
  points: number;
  eventName: string;
  open: boolean;
  validFrom: string | null;
  validUntil: string | null;
}

type Result =
  | { status: 'granted'; point_reward?: number }
  | { status: 'progress' | 'scanned'; scanned: number; required: number }
  | { status: 'already' | 'not_open' | 'closed' | 'not_customer' | 'not_found' | 'login' | 'error' };

const cn = (...p: (string | false | null | undefined)[]) => p.filter(Boolean).join(' ');

export function StationClaim({
  locale,
  dict,
  info,
  signedIn,
}: {
  locale: Locale;
  dict: Dictionary;
  info: StationInfo | null;
  signedIn: boolean;
}) {
  const t = dict.station;
  const [result, setResult] = useState<Result | null>(null);
  const fired = useRef(false);
  // 시각은 폰의 현지 시간대로 적는다(참가자는 행사장에 있다). 서버는 시간대가 달라 같은 글자를
  // 못 만드므로, 브라우저에 올라온 뒤에만 그린다 — 안 그러면 하이드레이션이 어긋난다.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!info || !signedIn || fired.current) return;
    fired.current = true; // 개발 모드 이중 실행에도 한 번만
    createClient()
      .rpc('claim_station', { p_code: info.code })
      .then(({ data, error }) => setResult(error ? { status: 'error' } : (data as Result)));
  }, [info, signedIn]);

  const fmt = (iso: string | null) =>
    iso && mounted
      ? new Intl.DateTimeFormat(intlLocale(locale), {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(iso))
      : '';

  // ── 없는 QR ──
  if (!info) {
    return (
      <Shell>
        <Icon tone="muted">
          <QrCode size={28} />
        </Icon>
        <h1 className="mt-5 text-xl font-bold">{t.notFoundTitle}</h1>
        <p className="mt-2 text-sm text-grey-500">{t.notFoundBody}</p>
      </Shell>
    );
  }

  const granted = result?.status === 'granted';
  const already = result?.status === 'already';
  const progress = result && (result.status === 'progress' || result.status === 'scanned') ? result : null;
  const earned = granted || already;
  const loginNext = encodeURIComponent(`qr/${info.code}`);

  let headline = '';
  let body = '';
  if (!signedIn) {
    headline = t.loginTitle;
    body = t.loginBody;
  } else if (!result) {
    headline = t.checking;
  } else if (granted) {
    headline = t.grantedTitle;
    body = info.points > 0 ? t.grantedPoints.replace('{n}', info.points.toLocaleString()) : t.grantedBody;
  } else if (already) {
    headline = t.alreadyTitle;
    body = t.alreadyBody;
  } else if (progress) {
    headline = progress.status === 'scanned' ? t.scannedTitle : t.progressTitle;
    body = t.progressBody.replace('{n}', String(Math.max(0, progress.required - progress.scanned)));
  } else if (result.status === 'not_open') {
    headline = t.notOpenTitle;
    body = info.validFrom ? t.opensAt.replace('{t}', fmt(info.validFrom)) : '';
  } else if (result.status === 'closed') {
    headline = t.closedTitle;
    body = t.closedBody;
  } else if (result.status === 'not_customer') {
    headline = t.notCustomerTitle;
    body = t.notCustomerBody;
  } else {
    headline = t.errorTitle;
    body = t.errorBody;
  }

  return (
    <Shell>
      {info.eventName && (
        <p className="label-caps flex items-center justify-center gap-1 !text-primary">
          <MapPin size={12} /> {info.eventName}
        </p>
      )}

      {/* 뱃지 — 받기 전에는 흑백, 받는 순간 컬러로 튀어 오른다. */}
      <div
        className={cn(
          'mx-auto mt-5 flex h-40 w-40 items-center justify-center',
          granted && 'fb-done-pop',
        )}
      >
        {info.badge ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={info.badge}
            alt={info.name}
            className={cn(
              'h-full w-full object-contain transition-all duration-500',
              !earned && 'opacity-50 grayscale',
            )}
          />
        ) : (
          <span
            className={cn(
              'flex h-32 w-32 items-center justify-center rounded-full',
              earned ? 'bg-primary text-white shadow-3' : 'border border-grey-200 bg-grey-50 text-grey-400',
            )}
          >
            {earned ? <Award size={56} /> : <Lock size={40} />}
          </span>
        )}
      </div>

      <p className="mt-4 text-sm font-medium text-grey-500">{info.name}</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight [word-break:keep-all]">{headline}</h1>
      {body && <p className="mt-2 text-sm leading-relaxed text-grey-600 [word-break:keep-all]">{body}</p>}
      {!signedIn && info.description && (
        <p className="mt-3 rounded-md bg-grey-50 px-3 py-2 text-xs text-grey-500 [word-break:keep-all]">
          {info.description}
        </p>
      )}

      {/* 여러 곳을 찍는 업적 — 몇 곳 남았는지 칸으로 */}
      {progress && progress.required > 1 && (
        <div className="mx-auto mt-5 flex max-w-[14rem] gap-1.5" aria-hidden>
          {Array.from({ length: progress.required }, (_, i) => (
            <span
              key={i}
              className={cn('h-1.5 flex-1 rounded-pill', i < progress.scanned ? 'bg-primary' : 'bg-grey-100')}
            />
          ))}
        </div>
      )}

      {mounted && info.validUntil && !earned && (
        <p className="mt-4 flex items-center justify-center gap-1 text-xs text-grey-400">
          <Clock size={12} /> {t.validUntil.replace('{t}', fmt(info.validUntil))}
        </p>
      )}

      <div className="mt-7 flex flex-col gap-2">
        {!signedIn ? (
          <>
            <Link href={`/${locale}/login?next=${loginNext}`} className="btn btn-primary">
              {t.loginCta}
            </Link>
            <Link href={`/${locale}/signup?next=${loginNext}`} className="btn btn-secondary">
              {t.signupCta}
            </Link>
          </>
        ) : (
          result && (
            <Link href={`/${locale}/account/badges`} className={cn('btn', earned ? 'btn-primary' : 'btn-secondary')}>
              {earned && <Check size={16} />} {t.myBadges}
            </Link>
          )
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-band flex min-h-[70vh] items-center justify-center py-10">
      <div className="w-full max-w-sm overflow-hidden rounded-xl border border-beige bg-cream-light text-center shadow-2">
        {/* 시그니처 선셋 띠 — '123Band가 주는 뱃지' 임을 한눈에 */}
        <div className="sunset-stripe" aria-hidden />
        <div className="px-6 pb-8 pt-7">{children}</div>
      </div>
    </div>
  );
}

function Icon({ children, tone }: { children: React.ReactNode; tone: 'muted' }) {
  return (
    <span
      className={cn(
        'mx-auto flex h-16 w-16 items-center justify-center rounded-full',
        tone === 'muted' && 'bg-grey-100 text-grey-400',
      )}
    >
      {children}
    </span>
  );
}
