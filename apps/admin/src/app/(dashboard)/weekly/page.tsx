// Design Ref: §5 — 주간리포트 (주차별 트래픽·퍼널·매출 추세 + 결제수단 성공률, 0058 RPC 기반)
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { tr } from '@/i18n/tr';
import { cn } from '@/lib/utils';
import { getWeeklyStats } from '@/lib/queries/weekly';

export const dynamic = 'force-dynamic';

const RANGE_OPTIONS = [4, 8, 12] as const;

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
/** 2026-08-17 → 08/17 — 표가 좁아 연도는 버린다. */
const fmtWeek = (d: string) => d.slice(5).replace('-', '/');

/** 전주 대비 증감 배지 — 오르면 초록, 내리면 빨강. */
function Delta({ value }: { value: number | null }) {
  if (value == null) return <span className="text-grey-300">—</span>;
  const flat = Math.abs(value) < 0.005;
  const Icon = flat ? Minus : value > 0 ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs',
        flat ? 'text-grey-400' : value > 0 ? 'text-success' : 'text-danger',
      )}
    >
      <Icon size={12} />
      {flat ? '0%' : `${value > 0 ? '+' : ''}${(value * 100).toFixed(0)}%`}
    </span>
  );
}

export default async function WeeklyPage({
  searchParams,
}: {
  searchParams: { weeks?: string };
}) {
  const weeks = RANGE_OPTIONS.includes(Number(searchParams.weeks) as (typeof RANGE_OPTIONS)[number])
    ? Number(searchParams.weeks)
    : 8;
  const s = await getWeeklyStats(weeks);

  const latest = s.rows[s.rows.length - 1];
  const maxVisitors = Math.max(1, ...s.rows.map((r) => r.visitors));
  // 시도는 있는데 한 번도 성공 못 한 결제수단 = 연동을 의심해야 하는 신호
  const brokenPayments = s.payments.filter((p) => p.attempts >= 5 && p.paid === 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl uppercase tracking-tight">{tr('주간리포트')}</h1>
        <div className="flex gap-1 rounded-pill border border-grey-200 p-1">
          {RANGE_OPTIONS.map((n) => (
            <Link
              key={n}
              href={`/weekly?weeks=${n}`}
              className={cn(
                'whitespace-nowrap rounded-pill px-3 py-1 text-sm transition-colors',
                n === weeks ? 'bg-black text-white' : 'text-grey-500 hover:bg-grey-100',
              )}
            >
              {tr(`${n}주`)}
            </Link>
          ))}
        </div>
      </div>

      {/* 연동이 죽은 결제수단이 있으면 제일 위에서 경고 — 가장 비싼 누수다 */}
      {brokenPayments.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" />
          <div className="text-sm">
            <p className="font-medium text-danger">{tr('결제 연동 점검 필요')}</p>
            <p className="mt-1 text-grey-600">
              {brokenPayments.map((p) => `${p.method} (${p.attempts})`).join(', ')}
              {' — '}
              {tr('결제 시도는 있었으나 확정된 건이 하나도 없습니다.')}
            </p>
          </div>
        </div>
      )}

      {latest && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-grey-200 p-4">
            <span className="label-caps text-grey-400">{tr('이번 주 방문자')}</span>
            <p className="mt-2 font-display text-2xl">{latest.visitors.toLocaleString()}</p>
            <div className="mt-1"><Delta value={latest.visitorDelta} /></div>
          </div>
          <div className="rounded-lg border border-grey-200 p-4">
            <span className="label-caps text-grey-400">{tr('이번 주 페이지뷰')}</span>
            <p className="mt-2 font-display text-2xl">{latest.pageviews.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-grey-200 p-4">
            <span className="label-caps text-grey-400">{tr('이번 주 결제확정')}</span>
            <p className="mt-2 font-display text-2xl">{latest.paid.toLocaleString()}</p>
            <p className="mt-1 text-xs text-grey-500">
              {tr('주문')} {latest.orders.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border border-grey-200 p-4">
            <span className="label-caps text-grey-400">{tr('이번 주 매출')}</span>
            <p className="mt-2 truncate font-display text-2xl">{latest.revenue.toLocaleString()}</p>
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg uppercase tracking-tight">{tr('주차별 방문자 추이')}</h2>
        <div className="rounded-lg border border-grey-200 p-4">
          {s.rows.length === 0 ? (
            <p className="py-10 text-center text-grey-500">{tr('데이터 없음.')}</p>
          ) : (
            <div className="flex h-40 items-end gap-2">
              {s.rows.map((r) => (
                <div key={r.weekStart} className="group relative flex h-full flex-1 flex-col items-end justify-end gap-1">
                  <div className="pointer-events-none absolute -top-9 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-black px-2 py-1 text-xs text-white group-hover:block">
                    {fmtWeek(r.weekStart)} · {tr('방문')} {r.visitors} · {tr('조회')} {r.pageviews}
                  </div>
                  <div
                    className="w-full rounded-t bg-info transition-colors group-hover:bg-black"
                    style={{ height: `${Math.max(4, (r.visitors / maxVisitors) * 100)}%` }}
                  />
                  <span className="w-full text-center text-[10px] text-grey-400">{fmtWeek(r.weekStart)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg uppercase tracking-tight">{tr('주차별 상세')}</h2>
        <div className="overflow-x-auto rounded-lg border border-grey-200">
          {s.rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-grey-500">{tr('데이터 없음.')}</p>
          ) : (
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-grey-200 bg-grey-50 text-left">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{tr('주차')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr('방문자')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr('전주 대비')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr('상품조회')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr('장바구니')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr('결제시작')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr('결제확정')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr('매출')}</th>
                </tr>
              </thead>
              <tbody>
                {s.rows.map((r) => (
                  <tr key={r.weekStart} className="border-b border-grey-100 last:border-0">
                    <td className="px-4 py-2.5 font-mono text-xs">{fmtWeek(r.weekStart)}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{r.visitors.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right"><Delta value={r.visitorDelta} /></td>
                    <td className="px-4 py-2.5 text-right text-grey-500">{r.productView.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-grey-500">{r.cart.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-grey-500">{r.checkout.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right">{r.paid.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right">{r.revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg uppercase tracking-tight">{tr('결제수단별 성공률')}</h2>
        <p className="-mt-2 mb-3 text-xs text-grey-500">
          {tr('시도 대비 확정 비율입니다. 시도가 쌓이는데 확정이 0이면 연동을 점검해야 합니다.')}
        </p>
        <div className="overflow-hidden rounded-lg border border-grey-200">
          {s.payments.length === 0 ? (
            <p className="px-4 py-10 text-center text-grey-500">{tr('데이터 없음.')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-grey-200 bg-grey-50 text-left">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{tr('결제수단')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr('시도')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr('확정')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr('성공률')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr('매출')}</th>
                </tr>
              </thead>
              <tbody>
                {s.payments.map((p) => (
                  <tr key={p.method} className="border-b border-grey-100 last:border-0">
                    <td className="px-4 py-2.5">{p.method}</td>
                    <td className="px-4 py-2.5 text-right">{p.attempts.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right">{p.paid.toLocaleString()}</td>
                    <td
                      className={cn(
                        'px-4 py-2.5 text-right font-medium',
                        p.attempts >= 5 && p.paid === 0 ? 'text-danger' : 'text-grey-500',
                      )}
                    >
                      {pct(p.successRate)}
                    </td>
                    <td className="px-4 py-2.5 text-right">{p.revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
