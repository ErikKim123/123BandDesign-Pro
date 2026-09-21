// Design Ref: §6 — 언어 전환 (현재 경로에서 locale 세그먼트만 교체, 쿼리스트링 유지)
'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { activeLocales } from '@/i18n/config';
import type { Locale } from '@123band/shared';

const LABEL: Record<string, string> = { en: 'EN', ko: 'KO', ja: 'JA', 'zh-TW': 'TW' };

/** locale 세그먼트만 교체하고 전달받은 쿼리스트링을 뒤에 붙인 링크 목록 */
function LocaleLinks({ current, query }: { current: Locale; query: string }) {
  const pathname = usePathname();

  function swap(to: Locale): string {
    const parts = pathname.split('/');
    parts[1] = to; // /[locale]/... 의 첫 세그먼트 교체
    return (parts.join('/') || `/${to}`) + query;
  }

  return (
    <>
      {activeLocales.map((l) => (
        <Link
          key={l}
          href={swap(l)}
          className={`rounded-pill px-1.5 py-1 text-xs font-medium uppercase tracking-tight transition-colors md:px-2.5 ${
            l === current ? 'bg-black text-white' : 'text-grey-500 hover:text-black'
          }`}
        >
          {LABEL[l] ?? l}
        </Link>
      ))}
    </>
  );
}

/**
 * usePathname 은 쿼리스트링을 포함하지 않아, 그대로 교체하면 shop 의 ?type=ticket
 * (페스티벌 패스) 같은 필터가 유실된다. useSearchParams 로 현재 쿼리를 보존한다.
 */
function LocaleLinksWithQuery({ current }: { current: Locale }) {
  const qs = useSearchParams().toString();
  return <LocaleLinks current={current} query={qs ? `?${qs}` : ''} />;
}

export function LocaleSwitcher({ current }: { current: Locale }) {
  return (
    <div className="flex items-center gap-0.5 md:gap-1">
      {/* useSearchParams 는 force-static 페이지에서 Suspense 경계를 요구(Next 14).
          정적 렌더 시엔 쿼리 없는 링크로 폴백하고, 클라이언트에서 쿼리를 채운다. */}
      <Suspense fallback={<LocaleLinks current={current} query="" />}>
        <LocaleLinksWithQuery current={current} />
      </Suspense>
    </div>
  );
}
