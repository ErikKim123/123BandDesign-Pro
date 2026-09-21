// Design Ref: 마이페이지 — 스탬프 탭. 도장 카드 / 받는 방법 / 내역.
// 공통 헤더(캐릭터/QR)와 탭 네비는 account/layout.tsx 가 그린다 — 여기선 본문만.
// 도장 증감은 전부 서버(DB 함수)가 한다. 이 화면은 읽기 전용이며,
// 진입 시 claim_stamp_card() 로 "찼는데 아직 보상이 안 나간 카드"만 정산한다.
// 카드 완성 보상은 포인트다(0065) — 지급된 포인트는 포인트 탭에서 확인한다.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Locale } from '@123band/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { createClient } from '@/lib/supabase/server';
import { requireCustomer } from '@/lib/auth/guard';
import { StampCard } from '@/components/account/StampCard';

export const dynamic = 'force-dynamic';

interface LedgerRow {
  id: string;
  delta: number;
  balance_after: number;
  reason: string;
  memo: string | null;
  created_at: string;
}

function fmtTpl(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

export default async function StampsPage({ params }: { params: { locale: string } }) {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  const s = dict.stamps;
  const reasonLabels = s.reason as Record<string, string | undefined>;

  const user = await requireCustomer(locale, 'account/stamps');
  const supabase = createClient();

  // 카드가 찼는데 보상이 아직 안 나간 경우(보상 포인트가 뒤늦게 설정된 경우)를 여기서 메운다.
  // 평소에는 적립 시점에 자동 정산되므로 대부분 0 을 돌려준다.
  await supabase.rpc('claim_stamp_card');

  const [{ data: profile }, { data: policyRaw }, { data: ledgerRaw }] = await Promise.all([
    // 진행도(캐시 컬럼 — 원장으로만 갱신된다)
    supabase.from('profiles').select('stamp_count').eq('id', user.id).maybeSingle(),
    // 정책 — app_settings 는 어드민 전용 RLS 라 stamps_policy() RPC 로 읽는다.
    supabase.rpc('stamps_policy'),
    // RLS(stamp_ledger_select_own)로 본인 것만 조회된다
    supabase
      .from('stamp_ledger')
      .select('id, delta, balance_after, reason, memo, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const policy = (policyRaw ?? {}) as Record<string, unknown>;
  // 어드민이 스탬프 기능을 껐다 — 주소로 직접 들어와도 보여 주지 않는다.
  if (policy.visible === false) redirect(`/${locale}/account`);
  const enabled = Boolean(policy.enabled);
  const goal = Number(policy.goal ?? 0);
  const rewardPoints = Number(policy.reward_points ?? 0);
  const count = Number(profile?.stamp_count ?? 0);

  // 운영 중인 적립 경로만 노출한다(정책값 0 이면 그 경로는 중단된 것 → 숨김).
  const earnRules = [
    { key: 'order', label: s.earnOrder, note: s.onceOrder, amount: Number(policy.per_order ?? 0) },
    {
      key: 'checkin',
      label: s.earnCheckin,
      note: s.oncePass,
      amount: Number(policy.per_checkin ?? 0),
    },
    {
      key: 'review',
      label: s.earnReview,
      note: s.onceProduct,
      amount: Number(policy.per_review ?? 0),
    },
    { key: 'qna', label: s.earnQna, note: s.onceProduct, amount: Number(policy.per_qna ?? 0) },
  ].filter((r) => r.amount > 0);

  const ledger = (ledgerRaw ?? []) as LedgerRow[];

  const dateFmt = new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return (
    <div className="space-y-10">
      {/* 적립이 꺼져 있어도 지금까지 모은 도장은 그대로다 — 그 점을 먼저 안심시킨다. */}
      {!enabled && (
        <p className="rounded-lg border border-grey-200 bg-grey-50 p-4 text-center text-sm text-grey-600">
          {s.disabled}
        </p>
      )}

      <StampCard
        count={count}
        goal={goal}
        title={s.cardTitle}
        desc={s.cardDesc}
        progress={fmtTpl(s.progress, { n: count, goal })}
        remaining={
          goal > 0 && count < goal
            ? goal - count === 1
              ? s.almost
              : fmtTpl(s.remaining, { n: goal - count })
            : null
        }
      />

      {/* 카드를 채우면 무엇을 받는지 — 보상이 설정돼 있지 않으면 솔직히 알린다. */}
      <section>
        <h2 className="section-title">{s.rewardTitle}</h2>
        <div className="mt-4 rounded-lg border border-grey-200 p-5 text-sm">
          {rewardPoints > 0 ? (
            <>
              <p className="font-semibold text-primary">
                {fmtTpl(s.rewardPoints, { n: rewardPoints.toLocaleString() })}
              </p>
              <p className="mt-1 text-grey-600">{s.rewardAuto}</p>
              {/* 받은 포인트는 포인트 탭에 쌓인다 — 어디서 확인하는지 바로 이어준다. */}
              <Link
                href={`/${locale}/account/points`}
                className="mt-2 inline-block text-xs text-primary underline underline-offset-2"
              >
                {s.rewardSeePoints}
              </Link>
            </>
          ) : (
            <p className="text-grey-600">{s.rewardNone}</p>
          )}
        </div>
      </section>

      {/* 도장 받는 방법 */}
      {earnRules.length > 0 && (
        <section>
          <h2 className="section-title">{s.earnTitle}</h2>
          <ul className="mt-4 space-y-2 rounded-lg border border-grey-200 p-5">
            {earnRules.map((r) => (
              <li key={r.key} className="flex items-baseline justify-between gap-3 text-sm">
                <span>
                  {r.label}
                  <span className="ml-1.5 text-xs text-grey-500">({r.note})</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-primary">
                  {fmtTpl(s.earnAmount, { n: r.amount })} {s.unit}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 스탬프 내역 */}
      <section>
        <h2 className="section-title">{s.historyTitle}</h2>
        {ledger.length === 0 ? (
          <p className="mt-4 rounded-lg border border-grey-200 p-6 text-center text-sm text-grey-500">
            {s.emptyHistory}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-grey-100 border-y border-grey-100">
            {ledger.map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{reasonLabels[l.reason] ?? l.reason}</p>
                  <p className="text-xs text-grey-500">
                    {dateFmt.format(new Date(l.created_at))}
                    {l.memo ? ` · ${l.memo}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-semibold tabular-nums ${
                      l.delta >= 0 ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {l.delta > 0 ? '+' : ''}
                    {l.delta} {s.unit}
                  </p>
                  <p className="text-xs text-grey-400 tabular-nums">
                    {l.balance_after} {s.unit}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
