// 선택 분석 쿠키 동의 — 동의한 사람에게만 Microsoft Clarity 를 싣는다.
//
// 왜 동의를 먼저 받나: 쿠키 정책 3항에 '제3자 분석 도구를 도입하면 정책을 사전에 개정해
// 공지하고 필요한 동의 절차를 마련한다'고 이미 공표해 두었다. Clarity 는 제3자이고 쿠키를
// 심으며 화면 조작을 녹화한다 — 동의 없이 켜면 우리가 쓴 약속을 우리가 어기는 것이 된다.
//
// 자체 집계(band_vid, page_views)는 이 동의와 무관하게 그대로 돈다. 그쪽은 제3자에게
// 나가지 않고 서버에만 쌓이는 필수 범위라 정책 2항에 따로 적혀 있다.
//
// 동의는 localStorage 에만 둔다. 서버에 보낼 이유가 없고(쿠키를 심을지 말지는 브라우저에서
// 결정된다), 지우면 다시 묻는 편이 사용자에게 유리하다.
'use client';
import { useEffect, useState } from 'react';
import Script from 'next/script';
import Link from 'next/link';
import type { Locale } from '@123band/shared';
import type { Dictionary } from '@/i18n/dictionaries';

const KEY = 'band_analytics_consent';
type Choice = 'granted' | 'denied';

function read(): Choice | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    // 프라이빗 모드 등 — 물어볼 수는 있지만 기억은 못 한다. 조용히 '아직 안 정함'으로 둔다.
    return null;
  }
}

function write(v: Choice) {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    // 기억하지 못해도 이번 방문에는 선택이 적용된다.
  }
  // 같은 탭의 다른 컴포넌트(쿠키 정책 화면의 설정)도 따라 바뀌게.
  window.dispatchEvent(new CustomEvent('band:consent', { detail: v }));
}

/** 다른 화면에서 동의를 바꿀 때 쓴다 — 쿠키 정책 화면의 '설정 바꾸기'. */
export function setAnalyticsConsent(v: Choice): void {
  write(v);
}

export function readAnalyticsConsent(): Choice | null {
  return read();
}

export function AnalyticsConsent({ locale, t }: { locale: Locale; t: Dictionary['consent'] }) {
  // 프로젝트 ID 가 없으면 실을 것이 없다 — 배너도 띄우지 않는다.
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID;
  const [choice, setChoice] = useState<Choice | null>(null);
  // 서버와 첫 렌더를 맞추려고 한 박자 뒤에 읽는다(localStorage 는 서버에 없다).
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setChoice(read());
    setReady(true);
    const onChange = (e: Event) => setChoice((e as CustomEvent<Choice>).detail);
    window.addEventListener('band:consent', onChange);
    return () => window.removeEventListener('band:consent', onChange);
  }, []);

  if (!clarityId) return null;

  const decide = (v: Choice) => {
    write(v);
    setChoice(v);
  };

  return (
    <>
      {/* 동의한 뒤에야 스크립트가 붙는다. 거부하면 아무것도 내려받지 않는다. */}
      {ready && choice === 'granted' && (
        <Script id="clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${clarityId}");`}
        </Script>
      )}

      {ready && choice === null && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-grey-200 bg-white/95 px-4 py-4 backdrop-blur">
          <div className="container-band flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center">
            <p className="flex-1 text-xs leading-relaxed text-grey-600">
              {t.body}{' '}
              <Link href={`/${locale}/cookies`} className="font-medium text-grey-800 underline">
                {t.policy}
              </Link>
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => decide('denied')}
                className="btn btn-secondary btn-sm"
              >
                {t.deny}
              </button>
              <button
                type="button"
                onClick={() => decide('granted')}
                className="btn btn-primary btn-sm"
              >
                {t.allow}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
