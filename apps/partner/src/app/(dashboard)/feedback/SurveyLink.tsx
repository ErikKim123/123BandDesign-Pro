// 설문 링크 — 참가자에게 보낼 '설문만 있는 페이지' 주소를 고르고 복사한다.
//
// 끝난 행사는 대개 비전시라 상세페이지가 열리지 않는다. 그래서 설문은 전용 주소(/{언어}/feedback/{slug})로
// 보낸다. 주소에 언어가 박히므로(없으면 영어로 간다) 보낼 대상에 맞춰 고르게 한다 — 기본은 영어.
'use client';
import { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/utils';

const WEB_BASE = (process.env.NEXT_PUBLIC_WEB_URL ?? 'https://123band-web.vercel.app').replace(/\/$/, '');
const LANGS = ['en', 'ko'] as const;

export function surveyUrl(slug: string, lang: (typeof LANGS)[number]) {
  return `${WEB_BASE}/${lang}/feedback/${slug}`;
}

export function SurveyLink({ slug, open }: { slug: string; open: boolean }) {
  const f = useT().feedback;
  const [lang, setLang] = useState<(typeof LANGS)[number]>('en');
  const [copied, setCopied] = useState(false);
  const url = surveyUrl(slug, lang);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // 클립보드 권한이 막힌 브라우저 — 주소 칸을 선택해 두면 사용자가 직접 복사할 수 있다.
      (document.getElementById(`survey-url-${slug}`) as HTMLInputElement | null)?.select();
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="rounded-lg border border-grey-200 bg-grey-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* 언어 — 주소에 박히는 값이라 먼저 고른다. */}
        <div className="flex overflow-hidden rounded-pill border border-grey-200 bg-white">
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={cn(
                'px-2.5 py-1 text-[11px] font-semibold uppercase transition-colors',
                lang === l ? 'bg-black text-white' : 'text-grey-500 hover:text-grey-900',
              )}
            >
              {l}
            </button>
          ))}
        </div>
        <input
          id={`survey-url-${slug}`}
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-md border border-grey-200 bg-white px-2.5 py-1.5 font-mono text-xs text-grey-700 outline-none"
        />
        <button
          type="button"
          onClick={copy}
          disabled={!open}
          className="flex items-center gap-1 rounded-pill bg-black px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-30"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? f.copied : f.copyLink}
        </button>
        <a
          href={open ? url : undefined}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!open}
          className={cn(
            'flex items-center gap-1 rounded-pill border border-grey-300 px-3 py-1.5 text-xs text-grey-700 transition-colors',
            open ? 'hover:bg-white' : 'pointer-events-none opacity-30',
          )}
        >
          <ExternalLink size={13} />
          {f.openLink}
        </a>
      </div>
      {/* 꺼진 설문의 주소는 열어도 없는 페이지다 — 보내기 전에 켜야 한다는 걸 알려 준다. */}
      {!open && <p className="mt-2 text-xs text-amber-700">{f.linkClosedHint}</p>}
    </div>
  );
}
