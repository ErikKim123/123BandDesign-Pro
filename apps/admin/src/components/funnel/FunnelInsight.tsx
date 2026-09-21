// 퍼널 — 신뢰도 점검 · 세그먼트 분해 · 결제수단 성공률 (0119).
//
// 순서에 뜻이 있다. 신뢰도가 맨 위인 이유는, 숫자가 틀린 채로 아래를 읽으면 엉뚱한 데를
// 고치게 되기 때문이다. 그다음이 세그먼트 — 전체 평균 하나로는 '모바일 결제에서 샌다' 같은
// 누수가 데스크톱 전환에 가려 보이지 않는다.
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, CreditCard, Info, Layers } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { cn } from '@/lib/utils';
import { pct } from '@/components/funnel/format';
import {
  DIMENSIONS,
  type FunnelDimension,
  type IntegrityKey,
  type IntegrityRow,
  type PaymentRow,
  type SegmentRow,
} from '@/lib/queries/funnel-insight';

/** 점검 항목마다 '무엇을 세었나'와 '문제면 무슨 뜻인가'. 코드만 보면 아무도 모른다. */
const CHECK_TEXT: Record<IntegrityKey, { label: string; hint: string }> = {
  purchase_vs_orders: {
    label: '결제완료 수 대조',
    hint: '주문 DB 의 결제완료 건수와 퍼널이 세는 구매 방문자 수의 차이입니다. 한 사람이 두 번 사면 원래 다르지만, 크게 벌어지면 계측이 빠지고 있다는 뜻입니다.',
  },
  orders_without_visitor: {
    label: '방문자가 안 붙은 주문',
    hint: '결제됐지만 어느 방문에서 왔는지 모르는 주문입니다. 결제 리다이렉트에서 세션이 끊기면 이렇게 되고, 그 매출은 어떤 유입 채널에도 잡히지 않습니다.',
  },
  utm_rule_violations: {
    label: 'UTM 규칙 위반',
    hint: 'utm_source 는 붙였는데 medium 이 없거나 대소문자가 섞인 조회수입니다. 같은 캠페인이 여러 줄로 갈라지고 광고와 자연검색을 못 가릅니다.',
  },
  bot_traffic: {
    label: '봇으로 보이는 조회',
    hint: 'user agent 에 bot·crawler 같은 말이 든 조회수입니다. 지금은 집계에서 빼지 않고 있어, 비율이 높으면 전환율이 실제보다 낮게 나옵니다.',
  },
  excluded_pageviews: {
    label: '제외된 조회 (테스트 계정)',
    hint: '분석 제외로 등록한 계정의 기록이라 집계에서 빠진 조회수입니다. 정상 동작이며, 참고용으로만 보여 줍니다.',
  },
  stale_pending_orders: {
    label: '하루 넘게 묵은 미결제 주문',
    hint: '결제를 시작했지만 하루가 지나도 결론이 나지 않은 주문입니다. 결제 구간에서 새는 양의 하한선입니다.',
  },
};

const TONE = {
  ok: { box: 'border-grey-200', text: 'text-grey-500', icon: CheckCircle2 },
  warn: { box: 'border-amber-300 bg-amber-50/50', text: 'text-amber-700', icon: AlertTriangle },
  bad: { box: 'border-danger/40 bg-danger/5', text: 'text-danger', icon: AlertTriangle },
} as const;

export function IntegrityPanel({ rows }: { rows: IntegrityRow[] }) {
  if (rows.length === 0) return null;
  // 문제가 있는 것부터 — 훑다가 멈출 자리를 위에 둔다.
  const order = { bad: 0, warn: 1, ok: 2 } as const;
  const sorted = [...rows].sort((a, b) => order[a.severity] - order[b.severity]);
  const bad = sorted.filter((r) => r.severity !== 'ok').length;

  return (
    <div>
      <h2 className="mb-1 text-lg uppercase tracking-tight">{tr('데이터 신뢰도')}</h2>
      <p className="mb-3 text-xs text-grey-500">
        {bad === 0
          ? tr('아래 수치를 그대로 믿어도 됩니다.')
          : tr('아래 수치를 읽기 전에 먼저 확인하세요. 계측이 틀리면 엉뚱한 곳을 고치게 됩니다.')}
      </p>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((r) => {
          const t = TONE[r.severity];
          const text = CHECK_TEXT[r.key] ?? { label: r.key, hint: '' };
          const Icon = r.severity === 'ok' ? Info : t.icon;
          return (
            <div key={r.key} className={cn('rounded-lg border p-3.5', t.box)}>
              <div className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                  <Icon size={14} className={t.text} />
                  {tr(text.label)}
                </span>
                <span className={cn('shrink-0 text-sm font-medium', t.text)}>
                  {r.value.toLocaleString()}
                  {r.total > 0 && (
                    <span className="ml-1 text-xs font-normal text-grey-400">
                      / {r.total.toLocaleString()}
                    </span>
                  )}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-grey-500">{tr(text.hint)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SegmentSection({
  rows,
  dimension,
  days,
  end,
  sort,
  dir,
}: {
  rows: SegmentRow[];
  dimension: FunnelDimension;
  days: number;
  end: string | null;
  sort: string;
  dir: string;
}) {
  // 결제시작이 이만큼은 돼야 비율을 말할 수 있다. 2명 중 1명을 '50%' 라고 적으면 오독한다.
  const MIN_SAMPLE = 5;
  const href = (d: FunnelDimension) =>
    `/funnel?days=${days}&sort=${sort}&dir=${dir}&dim=${d}${end ? `&end=${end}` : ''}#segments`;

  return (
    <div id="segments" className="scroll-mt-4">
      <h2 className="mb-1 text-lg uppercase tracking-tight">{tr('세그먼트별 퍼널')}</h2>
      <p className="mb-3 text-xs text-grey-500">
        {tr(
          '같은 퍼널을 나눠서 다시 셉니다. 전체 평균 하나로는 한쪽에서 새는 것이 다른 쪽 전환에 가려 보이지 않습니다. 각 칸의 숫자는 그 단계에 도달한 방문자 수입니다.',
        )}
      </p>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {DIMENSIONS.map((d) => (
          <Link
            key={d.key}
            href={href(d.key)}
            className={cn(
              'rounded-pill px-3 py-1 text-sm transition-colors',
              dimension === d.key ? 'bg-black text-white' : 'text-grey-500 hover:bg-grey-100',
            )}
          >
            {tr(d.label)}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-grey-200">
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-grey-500">{tr('데이터 없음.')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-grey-200 bg-grey-50 text-left">
                <tr>
                  <th className="px-4 py-2.5 font-medium">
                    <Layers size={13} className="mr-1 inline text-grey-400" />
                    {tr(DIMENSIONS.find((d) => d.key === dimension)?.label ?? '')}
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr('방문')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr('상품조회')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr('장바구니')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr('결제시작')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr('결제완료')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr('결제시작→완료')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr('전환율')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr('매출')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.segment} className="border-b border-grey-100 last:border-0">
                    <td className="max-w-0 truncate px-4 py-2.5 font-mono text-xs">
                      {r.segment}
                    </td>
                    <td className="px-4 py-2.5 text-right">{r.visitors.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-grey-500">
                      {r.productView.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right text-grey-400">
                      {r.cart.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right text-grey-500">
                      {r.checkout.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">
                      {r.purchase.toLocaleString()}
                    </td>
                    {/* 표본이 적으면 비율 대신 '—' — 2명 중 1명을 50% 로 적으면 오독한다. */}
                    <td className="px-4 py-2.5 text-right text-grey-500">
                      {r.checkout >= MIN_SAMPLE ? pct(r.checkoutToPurchase) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-grey-400">
                      {r.visitors >= MIN_SAMPLE ? pct(r.conversion) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right">{r.revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="mt-2 text-[11px] text-grey-400">
        {tr('결제시작이 5명 미만인 줄은 비율을 적지 않습니다 — 표본이 적어 비율이 우연에 좌우됩니다.')}
      </p>
    </div>
  );
}

export function PaymentSection({ rows }: { rows: PaymentRow[] }) {
  return (
    <div>
      <h2 className="mb-1 text-lg uppercase tracking-tight">{tr('결제수단별 성공률')}</h2>
      <p className="mb-3 text-xs text-grey-500">
        {tr(
          '주문 행은 결제창이 열리기 전에 만들어집니다. 그래서 주문 시작과 결제됨만 보면, 우리 화면에서 그만둔 사람까지 결제수단이 실패한 것처럼 보입니다. 가운데 결제창 도달(PG 거래번호가 붙은 주문) 칸을 보면 어디서 샜는지 갈립니다 — 계좌이체처럼 PG 를 안 쓰는 수단은 늘 0 입니다.',
        )}
      </p>
      <div className="overflow-hidden rounded-lg border border-grey-200">
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-grey-500">{tr('데이터 없음.')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-grey-200 bg-grey-50 text-left">
                <tr>
                  <th className="px-4 py-2.5 font-medium">
                    <CreditCard size={13} className="mr-1 inline text-grey-400" />
                    {tr('결제수단')}
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr('주문 시작')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr('결제창 도달')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr('결제됨')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr('대기')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr('취소·실패')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr('성공률')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr('매출')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.method} className="border-b border-grey-100 last:border-0">
                    <td className="px-4 py-2.5 font-mono text-xs">{r.method}</td>
                    <td className="px-4 py-2.5 text-right">{r.started.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-grey-500">
                      {r.reachedPg.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">
                      {r.paid.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right text-grey-500">
                      {r.pending.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right text-grey-400">
                      {r.cancelled.toLocaleString()}
                    </td>
                    {/* 성공률이 낮은 수단은 붉게 — 매출이 직접 새는 자리다. */}
                    <td
                      className={cn(
                        'px-4 py-2.5 text-right',
                        r.started >= 5 && r.successRate < 0.3
                          ? 'font-medium text-danger'
                          : 'text-grey-500',
                      )}
                    >
                      {r.started >= 5 ? pct(r.successRate) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right">{r.revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
