// Design Ref: §5 — 퍼널분석 (방문 → 상품조회 → 장바구니 → 결제시작 → 결제완료)
//
// 화면은 두 층으로 읽힌다.
//   위: 몇 명이 넘어갔나 — 단계별 전환·유입 경로별 매출 (0057/0060, queries/funnel.ts)
//   아래: 어디서 얼마나 머물다 나갔나 — 체류시간·단계 소요시간·방문별 여정 (0085, funnel-depth.ts)
// 전환율만 보면 "결제에서 샌다"까지는 알아도 왜 새는지는 모른다. 아래 층이 그 자리를 짚는다.
import {
  Eye,
  ShoppingBag,
  ShoppingCart,
  CreditCard,
  CheckCircle2,
  TrendingDown,
  Timer,
  Receipt,
  Coins,
  Hourglass,
  DoorOpen,
} from 'lucide-react';
import Link from 'next/link';
import { CalendarDays, X } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { cn } from '@/lib/utils';
import { getFunnelStats, type FunnelStep } from '@/lib/queries/funnel';
import {
  getFunnelDepth,
  isSessionSort,
  type SessionSort,
  type SortDir,
} from '@/lib/queries/funnel-depth';
import { FunnelSessions } from '@/components/funnel/FunnelSessions';
import {
  IntegrityPanel,
  PaymentSection,
  SegmentSection,
} from '@/components/funnel/FunnelInsight';
import {
  DIMENSIONS,
  getFunnelInsight,
  type FunnelDimension,
} from '@/lib/queries/funnel-insight';
import { STEP_LABEL, formatDur, formatDurLong, pct } from '@/components/funnel/format';

export const dynamic = 'force-dynamic';

const RANGE_OPTIONS = [7, 14, 30] as const;

const STEP_ICON: Record<FunnelStep, typeof Eye> = {
  visit: Eye,
  product_view: ShoppingBag,
  cart: ShoppingCart,
  checkout: CreditCard,
  purchase: CheckCircle2,
};

function Card({
  label,
  value,
  sub,
  icon: Icon,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: typeof Eye;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border border-grey-200 p-4', className)}>
      <span className="label-caps flex items-center gap-1.5 text-grey-400">
        {Icon && <Icon size={14} />} {tr(label)}
      </span>
      <p className="mt-2 truncate font-display text-2xl">{value}</p>
      {sub && <p className="mt-1 text-xs text-grey-500">{sub}</p>}
    </div>
  );
}

export default async function FunnelPage({
  searchParams,
}: {
  searchParams: { days?: string; sort?: string; dir?: string; end?: string; dim?: string };
}) {
  // 방문자수 화면의 일별 막대에서 넘어오면 end=YYYY-MM-DD 가 붙는다 — 그 하루(days=1)만 본다(0104).
  const end = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.end ?? '') ? (searchParams.end as string) : null;
  const days = end && searchParams.days === '1'
    ? 1
    : RANGE_OPTIONS.includes(Number(searchParams.days) as (typeof RANGE_OPTIONS)[number])
      ? Number(searchParams.days)
      : 14;
  // 방문 기록의 정렬은 주소에 담는다 — 새로고침·공유해도 같은 화면이 나오고,
  // 목록이 전체 중 일부만 내려오므로 정렬은 DB 가 해야 한다(0086).
  const sort: SessionSort = isSessionSort(searchParams.sort) ? searchParams.sort : 'started';
  const dir: SortDir = searchParams.dir === 'asc' ? 'asc' : 'desc';
  // 퍼널을 나눠 보는 축도 주소에 담는다 — 새로고침·공유해도 같은 화면이 나온다.
  const dim: FunnelDimension = DIMENSIONS.some((x) => x.key === searchParams.dim)
    ? (searchParams.dim as FunnelDimension)
    : 'device';
  // 세 층을 동시에 부른다 — 전부 같은 기간을 보게 한다.
  const [s, d, ins] = await Promise.all([
    getFunnelStats(days, end),
    getFunnelDepth(days, sort, dir, 50, end),
    getFunnelInsight(days, end, dim),
  ]);

  const top = s.steps[0]?.visitors ?? 0;
  const purchase = s.steps[s.steps.length - 1];
  // 이탈이 가장 큰 구간 — 어디를 먼저 손봐야 하는지 한 줄로 짚어준다.
  // 장바구니 같은 선택 분기는 제외한다. 건너뛰어도 되는 단계라 낙폭이 이탈이 아니다(0060).
  const worst = s.steps
    .slice(1)
    .filter((r) => !r.isBranch)
    .reduce<(typeof s.steps)[number] | null>(
      (acc, cur) => (acc == null || cur.rateFromPrev < acc.rateFromPrev ? cur : acc),
      null,
    );

  // 오래 붙잡지도 못하고 그대로 내보내는 화면 = 손볼 값어치가 가장 큰 곳.
  // 조회가 너무 적은 화면은 우연이라 제외한다.
  const leak = d.pages
    .filter((p) => p.pageviews >= 5)
    .reduce<(typeof d.pages)[number] | null>(
      (acc, cur) => (acc == null || cur.exitRate > acc.exitRate ? cur : acc),
      null,
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl uppercase tracking-tight">{tr('퍼널분석')}</h1>
        <div className="flex items-center gap-2">
        {end && (
          // 하루 보기 — 어느 날인지 늘 보이고, 한 번에 벗어날 수 있어야 한다.
          <Link
            href="/funnel"
            className="flex items-center gap-1.5 rounded-pill bg-black px-3 py-1 text-sm text-white"
            title={tr('기간으로 돌아가기')}
          >
            <CalendarDays size={14} /> {end} {tr('하루')} <X size={13} className="opacity-70" />
          </Link>
        )}
        <div className="flex gap-1 rounded-pill border border-grey-200 p-1">
          {RANGE_OPTIONS.map((n) => (
            <Link
              key={n}
              href={`/funnel?days=${n}&sort=${sort}&dir=${dir}`}
              className={cn(
                'whitespace-nowrap rounded-pill px-3 py-1 text-sm transition-colors',
                !end && n === days ? 'bg-black text-white' : 'text-grey-500 hover:bg-grey-100',
              )}
            >
              {tr(`${n}일`)}
            </Link>
          ))}
        </div>
        </div>
      </div>

      {/* ── 요약 ─────────────────────────────────────────────────────────── */}
      {/* 카드가 8장 — 6칸으로 두면 6+2 로 갈라져 뒤 두 장이 떨어져 나온 것처럼 보인다. */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card label="기간 방문자" value={top.toLocaleString()} />
        <Card label="구매 전환율" value={pct(purchase?.rateFromTop ?? 0)} />
        <Card
          label="최대 이탈 구간"
          icon={TrendingDown}
          value={worst ? tr(STEP_LABEL[worst.step]) : '—'}
          sub={worst ? `${tr('직전 단계 대비')} ${pct(worst.rateFromPrev)}` : undefined}
        />
        <Card
          label="평균 방문 시간"
          icon={Timer}
          value={formatDurLong(d.stats.avgDuration)}
          sub={`${tr('중앙값')} ${formatDur(d.stats.medianDuration)}`}
        />
        <Card
          label="방문당 화면"
          icon={Eye}
          value={d.stats.avgPageviews.toFixed(1)}
          sub={`${tr('총 방문 수')} ${d.stats.sessions.toLocaleString()}${tr('건')}`}
        />
        <Card
          label="이탈 방문"
          icon={DoorOpen}
          value={pct(d.stats.bounceRate)}
          sub={tr('화면 하나만 보고 종료')}
        />
        {/* 전환율만 보면 '싸게 많이 판 날'과 '비싸게 조금 판 날'이 구분되지 않는다. */}
        <Card
          label="객단가"
          icon={Receipt}
          value={ins.revenue.aov.toLocaleString()}
          sub={`${tr('결제완료')} ${ins.revenue.orders.toLocaleString()}${tr('건')}`}
        />
        <Card
          label="방문당 매출"
          icon={Coins}
          value={ins.revenue.rpv.toLocaleString()}
          sub={`${tr('기간 매출')} ${ins.revenue.revenue.toLocaleString()}`}
        />
      </div>

      {/* ── 데이터 신뢰도 — 수치를 읽기 전에 먼저 본다 ──────────────────── */}
      <IntegrityPanel rows={ins.integrity} />

      {/* ── 단계별 전환 (기존) ───────────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-lg uppercase tracking-tight">{tr('단계별 전환')}</h2>
        <div className="space-y-2 rounded-lg border border-grey-200 p-4">
          {s.steps.map((row, i) => {
            const Icon = STEP_ICON[row.step];
            // 막대 길이는 첫 단계 기준 — 단계가 좁아지는 모양이 그대로 보인다.
            const width = top > 0 ? Math.max(2, (row.visitors / top) * 100) : 2;
            // 이 단계로 넘어오는 데 걸린 시간 — 전환율 옆에 붙어야 '망설임'이 읽힌다.
            const leg = d.timings.find((t) => t.toStep === row.step);
            return (
              <div key={row.step} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Icon size={15} className="text-grey-400" />
                    {tr(STEP_LABEL[row.step])}
                    {row.isBranch && (
                      <span className="rounded-pill border border-grey-200 px-1.5 py-0.5 text-[10px] text-grey-400">
                        {tr('선택 단계')}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-medium">{row.visitors.toLocaleString()}</span>
                    {/* 순서를 무시하면 몇 명인지 — 순차 도달과 차이가 나면 건너뛴 유입이 있다는 뜻 */}
                    {row.reached !== row.visitors && (
                      <span className="text-xs text-grey-400">
                        {tr('도달')} {row.reached.toLocaleString()}
                      </span>
                    )}
                    <span className="w-14 text-right text-xs text-grey-400">
                      {pct(row.rateFromTop)}
                    </span>
                  </span>
                </div>
                <div className="h-7 w-full overflow-hidden rounded bg-grey-50">
                  <div
                    className="h-full rounded bg-info transition-all"
                    style={{ width: `${width}%` }}
                  />
                </div>
                {/* 단계 사이 낙폭 — 여기서 몇 %가 빠졌는지.
                    비교 대상은 바로 위 줄이 아니라 직전 '주 경로' 단계다(분기는 건너뛴다). */}
                {i > 0 &&
                  (() => {
                    const prevMain = s.steps
                      .slice(0, i)
                      .reverse()
                      .find((r) => !r.isBranch);
                    return (
                      <p className="flex flex-wrap items-center gap-x-1.5 pb-1 text-[11px] text-grey-400">
                        <span>
                          {tr('직전 대비')} {pct(row.rateFromPrev)}
                        </span>
                        <span>·</span>
                        <span>
                          {tr('이탈')}{' '}
                          {Math.max(0, (prevMain?.visitors ?? 0) - row.visitors).toLocaleString()}
                        </span>
                        {leg && leg.samples > 0 && (
                          <>
                            <span>·</span>
                            {/* 표본이 몇 명인지 같이 적는다 — 2명의 중앙값을 대표값처럼
                                읽으면 엉뚱한 결론이 난다. 이 사이트는 하위 단계 표본이 아주 적다. */}
                            <span className="flex items-center gap-1 text-grey-500">
                              <Hourglass size={10} />
                              {tr('넘어오는 데')} {formatDur(leg.medianSec)}
                              <span className="text-grey-400">
                                ({tr('상위10%')} {formatDur(leg.p90Sec)} · n={leg.samples})
                              </span>
                            </span>
                          </>
                        )}
                      </p>
                    );
                  })()}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 세그먼트별 퍼널 — 평균 하나로는 누수가 가려진다 ──────────────── */}
      <SegmentSection
        rows={ins.segments}
        dimension={dim}
        days={days}
        end={end}
        sort={sort}
        dir={dir}
      />

      {/* ── 결제수단별 성공률 ────────────────────────────────────────────── */}
      <PaymentSection rows={ins.payments} />

      {/* ── 화면별 체류시간 ──────────────────────────────────────────────── */}
      <div>
        <h2 className="mb-1 text-lg uppercase tracking-tight">{tr('화면별 체류시간')}</h2>
        <p className="mb-3 text-xs text-grey-500">
          {tr(
            '브라우저가 화면이 실제로 보이던 시간을 재서 보냅니다. 탭을 숨기면 시계가 멈춰, 열어두고 자리를 비운 시간은 빠집니다.',
          )}
          {leak && (
            <>
              {' '}
              <span className="text-grey-600">
                {tr('가장 많이 내보내는 화면')}: <span className="font-mono">{leak.path}</span> (
                {tr('이탈률')} {pct(leak.exitRate)})
              </span>
            </>
          )}
        </p>
        <div className="overflow-hidden rounded-lg border border-grey-200">
          {d.pages.length === 0 ? (
            <p className="px-4 py-10 text-center text-grey-500">{tr('데이터 없음.')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b border-grey-200 bg-grey-50 text-left">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">{tr('화면')}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{tr('조회수')}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{tr('방문자')}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{tr('평균 체류')}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{tr('중앙값')}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{tr('이탈률')}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{tr('측정 비율')}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.pages.map((row) => (
                    <tr key={row.path} className="border-b border-grey-100 last:border-0">
                      <td className="max-w-0 px-4 py-2.5">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate font-mono text-xs">{row.path}</span>
                          {row.step && (
                            <span className="shrink-0 rounded-pill bg-grey-100 px-1.5 py-0.5 text-[10px] text-grey-500">
                              {tr(STEP_LABEL[row.step])}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">{row.pageviews.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-grey-500">
                        {row.visitors.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium">
                        {row.avgSec > 0 ? formatDur(row.avgSec) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-grey-500">
                        {row.medianSec > 0 ? formatDur(row.medianSec) : '—'}
                      </td>
                      {/* 이탈률이 높은 화면은 붉게 — 표를 훑을 때 바로 걸리게 */}
                      <td
                        className={cn(
                          'px-4 py-2.5 text-right',
                          row.exitRate >= 0.6 ? 'font-medium text-danger' : 'text-grey-400',
                        )}
                      >
                        {pct(row.exitRate)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-grey-400">
                        {pct(row.measuredRate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── 방문 기록 ────────────────────────────────────────────────────── */}
      <div id="sessions" className="scroll-mt-4">
        <h2 className="mb-1 text-lg uppercase tracking-tight">{tr('방문 기록')}</h2>
        <p className="mb-3 text-xs text-grey-500">
          {tr(
            '줄을 누르면 그 방문의 화면 순서와 화면마다 머문 시간이 펼쳐집니다. 로그인한 적 있는 방문자는 회원 이름으로 보입니다.',
          )}
        </p>
        <FunnelSessions
          sessions={d.sessions}
          days={days}
          end={end}
          total={d.totalSessions}
          sort={sort}
          dir={dir}
        />
      </div>

      {/* ── 유입 경로별 전환 (기존) ──────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-lg uppercase tracking-tight">{tr('유입 경로별 전환')}</h2>
        <p className="-mt-2 mb-3 text-xs text-grey-500">
          {tr('방문자를 처음 데려온 출처(UTM 또는 referrer) 기준으로 실제 매출까지 잇습니다.')}
        </p>
        <div className="overflow-hidden rounded-lg border border-grey-200">
          {s.sources.length === 0 ? (
            <p className="px-4 py-10 text-center text-grey-500">{tr('데이터 없음.')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-grey-200 bg-grey-50 text-left">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{tr('출처')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr('방문자')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr('구매')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr('전환율')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr('매출')}</th>
                </tr>
              </thead>
              <tbody>
                {s.sources.map((row) => (
                  <tr key={row.source} className="border-b border-grey-100 last:border-0">
                    <td className="max-w-0 truncate px-4 py-2.5 text-xs">
                      {row.source === 'direct' ? tr('직접 접속') : row.source}
                    </td>
                    <td className="px-4 py-2.5 text-right">{row.visitors.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right">{row.purchases.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-grey-400">{pct(row.conversion)}</td>
                    <td className="px-4 py-2.5 text-right">{row.revenue.toLocaleString()}</td>
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
