// 쿠키 정책 화면의 '분석 쿠키 설정' — 지금 상태를 보여 주고 언제든 바꾸게 한다.
//
// 동의를 받는 배너만 만들고 철회할 길을 안 두면 동의 절차를 갖췄다고 할 수 없다.
// 정책 문서 안에 두는 이유도 같다 — 무엇에 동의했는지 읽은 자리에서 바로 바꿀 수 있어야 한다.
'use client';
import { useEffect, useState } from 'react';
import type { Dictionary } from '@/i18n/dictionaries';
import { readAnalyticsConsent, setAnalyticsConsent } from './AnalyticsConsent';

export function ConsentPreference({ t }: { t: Dictionary['consent'] }) {
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID;
  const [choice, setChoice] = useState<'granted' | 'denied' | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setChoice(readAnalyticsConsent());
    setReady(true);
  }, []);

  // 도구를 안 쓰는 동안에는 고를 것이 없다 — 있지도 않은 설정을 보여 주지 않는다.
  if (!clarityId) return null;

  const pick = (v: 'granted' | 'denied') => {
    setAnalyticsConsent(v);
    setChoice(v);
    // 거부로 바꾸면 이미 실린 스크립트가 남아 있다 — 새로 그려야 완전히 떨어진다.
    if (v === 'denied') window.location.reload();
  };

  return (
    <div className="mt-8 rounded-lg border border-grey-200 bg-grey-50 p-5">
      <h3 className="text-sm font-semibold text-ink">{t.prefTitle}</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-grey-600">{t.prefBody}</p>
      <p className="mt-3 text-xs text-grey-500">
        {t.prefCurrent}{' '}
        <span className="font-medium text-ink">
          {!ready ? '—' : choice === 'granted' ? t.stateAllowed : choice === 'denied' ? t.stateDenied : t.stateUnset}
        </span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => pick('granted')}
          disabled={!ready || choice === 'granted'}
          className="btn btn-secondary btn-sm disabled:opacity-40"
        >
          {t.allow}
        </button>
        <button
          type="button"
          onClick={() => pick('denied')}
          disabled={!ready || choice === 'denied'}
          className="btn btn-secondary btn-sm disabled:opacity-40"
        >
          {t.deny}
        </button>
      </div>
    </div>
  );
}
