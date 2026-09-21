// Design Ref: §5 — 방문자수/트래픽수 (web 공개 사이트 페이지뷰 집계, 0056 RPC 기반)
import { Users, Eye, TrendingUp, Link2, Smartphone, Bookmark } from 'lucide-react';
import Link from 'next/link';
import { tr } from '@/i18n/tr';
import { cn } from '@/lib/utils';
import { getTrafficStats, type TrafficSourceKind } from '@/lib/queries/traffic';
import { AnalyticsExclusions } from '@/components/traffic/AnalyticsExclusions';

export const dynamic = 'force-dynamic';

const RANGE_OPTIONS = [7, 14, 30] as const;

// 외부 referrer 가 아닌 유입(설치형 앱 / 북마크·직접입력)의 표기.
// 북마크는 브라우저가 알려주는 수단이 없어 주소창 직접입력과 한 덩어리로 센다.
const SOURCE_LABEL: Record<Exclude<TrafficSourceKind, 'referrer'>, { text: string; icon: typeof Link2 }> = {
  app: { text: '설치형 앱(홈화면)', icon: Smartphone },
  direct: { text: '북마크/직접입력', icon: Bookmark },
};

function fmtDay(day: string): string {
  const [, m, d] = day.split('-');
  return `${m}/${d}`;
}

export default async function TrafficPage({
  searchParams,
}: {
  searchParams: { days?: string };
}) {
  const days = RANGE_OPTIONS.includes(Number(searchParams.days) as (typeof RANGE_OPTIONS)[number])
    ? Number(searchParams.days)
    : 14;
  const s = await getTrafficStats(days);

  const cards = [
    { label: tr('오늘 방문자'), value: String(s.today?.visitors ?? 0), icon: Users },
    { label: tr('오늘 페이지뷰'), value: String(s.today?.pageviews ?? 0), icon: Eye },
    { label: tr('기간 방문자(일별 합)'), value: String(s.totalVisitors), icon: TrendingUp },
    { label: tr('기간 페이지뷰'), value: String(s.totalPageviews), icon: Eye },
  ];

  const maxPageviews = Math.max(1, ...s.daily.map((d) => d.pageviews));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl uppercase tracking-tight">{tr('방문자수/트래픽수')}</h1>
        <div className="flex gap-1 rounded-pill border border-grey-200 p-1">
          {RANGE_OPTIONS.map((n) => (
            <Link
              key={n}
              href={`/traffic?days=${n}`}
              className={cn(
                'whitespace-nowrap rounded-pill px-3 py-1 text-sm transition-colors',
                n === days ? 'bg-black text-white' : 'text-grey-500 hover:bg-grey-100',
              )}
            >
              {tr(`${n}일`)}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-lg border border-grey-200 p-4">
            <div className="flex items-center gap-2 text-grey-400">
              <Icon size={16} />
              <span className="label-caps">{label}</span>
            </div>
            <p className="mt-2 truncate font-display text-2xl">{value}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-lg uppercase tracking-tight">{tr('일별 추이')}</h2>
        <div className="rounded-lg border border-grey-200 p-4">
          {s.daily.length === 0 ? (
            <p className="py-10 text-center text-grey-500">{tr('데이터 없음.')}</p>
          ) : (
            <div className="flex h-40 items-end gap-1">
              {s.daily.map((d, i) => (
                // 막대를 누르면 그 하루의 퍼널분석으로 — "이날 왜 많았나"를 바로 파고들 수 있게(0104).
                <Link
                  key={d.day}
                  href={`/funnel?days=1&end=${d.day}`}
                  title={`${fmtDay(d.day)} ${tr('퍼널분석 보기')}`}
                  className="group relative flex h-full flex-1 flex-col items-center justify-end gap-1"
                >
                  <div className="pointer-events-none absolute -top-8 hidden whitespace-nowrap rounded bg-black px-2 py-1 text-xs text-white group-hover:block">
                    {fmtDay(d.day)} · {tr('방문')} {d.visitors} · {tr('조회')} {d.pageviews} · {tr('퍼널 →')}
                  </div>
                  <div
                    className="w-full rounded-t bg-info transition-colors group-hover:bg-black"
                    style={{ height: `${Math.max(4, (d.pageviews / maxPageviews) * 100)}%` }}
                  />
                  {/* 폰에서 30개 날짜를 다 적으면 글자가 겹친다 — 5일마다만 적고 나머지는 툴팁으로. */}
                  <span
                    className={cn(
                      'text-[10px] text-grey-400',
                      s.daily.length > 10 && i % 5 !== s.daily.length % 5 - 1 && i !== s.daily.length - 1 && 'hidden sm:inline',
                    )}
                  >
                    {fmtDay(d.day)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg uppercase tracking-tight">{tr('인기 페이지')}</h2>
          <div className="overflow-hidden rounded-lg border border-grey-200">
            {s.topPaths.length === 0 ? (
              <p className="px-4 py-10 text-center text-grey-500">{tr('데이터 없음.')}</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-grey-200 bg-grey-50 text-left">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">{tr('경로')}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{tr('조회수')}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{tr('방문자')}</th>
                  </tr>
                </thead>
                <tbody>
                  {s.topPaths.map((p) => (
                    <tr key={p.path} className="border-b border-grey-100 last:border-0">
                      <td className="max-w-0 truncate px-4 py-2.5 font-mono text-xs">{p.path}</td>
                      <td className="px-4 py-2.5 text-right">{p.pageviews}</td>
                      <td className="px-4 py-2.5 text-right text-grey-400">{p.visitors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-lg uppercase tracking-tight">{tr('유입 경로')}</h2>
          <div className="overflow-hidden rounded-lg border border-grey-200">
            {s.topReferrers.length === 0 ? (
              <p className="px-4 py-10 text-center text-grey-500">{tr('데이터 없음.')}</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-grey-200 bg-grey-50 text-left">
                  <tr>
                    <th className="flex items-center gap-1.5 px-4 py-2.5 font-medium">
                      <Link2 size={13} /> {tr('출처')}
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium">{tr('방문자')}</th>
                  </tr>
                </thead>
                <tbody>
                  {s.topReferrers.map((r) => {
                    const label = r.kind === 'referrer' ? null : SOURCE_LABEL[r.kind];
                    const Icon = label?.icon;
                    return (
                      <tr key={r.source ?? r.kind} className="border-b border-grey-100 last:border-0">
                        <td className="max-w-0 truncate px-4 py-2.5 text-xs">
                          {label && Icon ? (
                            <span className="flex items-center gap-1.5 text-grey-600">
                              <Icon size={13} className="shrink-0" />
                              {tr(label.text)}
                            </span>
                          ) : (
                            r.source
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right text-grey-400">{r.visitors}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <AnalyticsExclusions />
    </div>
  );
}
