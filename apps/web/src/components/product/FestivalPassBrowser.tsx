// Design Ref: 페스티벌 패스 — 전체 보기 + 월 단위 필터(행사 시작월 기준).
'use client';
import { useMemo, useState } from 'react';
import type { Locale } from '@123band/shared';
import { intlLocale } from '@/lib/locale';
import { ProductGrid } from './ProductGrid';
import type { TicketPass } from '@/lib/queries/products';
import type { Dictionary } from '@/i18n/dictionaries';

export function FestivalPassBrowser({
  passes,
  locale,
  dict,
}: {
  passes: TicketPass[];
  locale: Locale;
  dict: Dictionary;
}) {
  const intl = intlLocale(locale);
  const [month, setMonth] = useState<string>(''); // '' = 전체

  // 행사 시작월(YYYY-MM) 목록 (오름차순)
  const months = useMemo(() => {
    const set = new Set<string>();
    for (const p of passes) if (p.startAt) set.add(p.startAt.slice(0, 7));
    return Array.from(set).sort();
  }, [passes]);

  // 라벨: 연도는 "바뀔 때(각 연도의 첫 칩)"만 붙인다 — 같은 연도 반복(2026, 2026…)을 줄여
  // 모바일에서도 깔끔하게. 2027·2028이 생기면 그 연도 시작 칩에서만 연도가 다시 표출된다.
  const monthLabel = (key: string, showYear: boolean) => {
    const [y, m] = key.split('-').map(Number);
    const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, 1));
    const opts: Intl.DateTimeFormatOptions = showYear
      ? { year: 'numeric', month: 'long', timeZone: 'UTC' }
      : { month: 'long', timeZone: 'UTC' };
    return new Intl.DateTimeFormat(intl, opts).format(date);
  };

  const filtered = month ? passes.filter((p) => p.startAt?.slice(0, 7) === month) : passes;
  // 행사 시작일이 가까운 순(오름차순). 날짜 없는 패스는 뒤로.
  const sorted = [...filtered].sort((a, b) => {
    const sa = a.startAt ?? '';
    const sb = b.startAt ?? '';
    if (!sa && !sb) return 0;
    if (!sa) return 1;
    if (!sb) return -1;
    return sa < sb ? -1 : sa > sb ? 1 : 0;
  });

  const chip = (active: boolean) =>
    `whitespace-nowrap rounded-pill border px-4 py-1.5 text-sm font-medium transition-colors ${
      active ? 'border-black bg-black text-white' : 'border-grey-300 text-grey-600 hover:border-black'
    }`;

  return (
    <div className="space-y-6">
      {/* 필터: 전체 + 월별 */}
      <div className="flex flex-wrap gap-2">
        <button className={chip(month === '')} onClick={() => setMonth('')}>
          {dict.shop.all}
        </button>
        {months.map((k, i) => {
          // 첫 칩이거나 직전 칩과 연도가 다르면 연도를 표시
          const showYear = i === 0 || k.slice(0, 4) !== months[i - 1]?.slice(0, 4);
          return (
            <button key={k} className={chip(month === k)} onClick={() => setMonth(k)}>
              {monthLabel(k, showYear)}
            </button>
          );
        })}
      </div>

      <ProductGrid products={sorted} locale={locale} dict={dict} />
    </div>
  );
}
