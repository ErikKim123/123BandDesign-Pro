// Design Ref: 마이페이지 — 포인트 탭. 잔액 / 쿠폰 교환 / 내 쿠폰함 / 적립·사용 내역
// 공통 헤더(캐릭터/QR)와 탭 네비는 account/layout.tsx 가 그린다 — 여기선 본문만.
import type { Locale } from '@123band/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { createClient } from '@/lib/supabase/server';
import { requireCustomer } from '@/lib/auth/guard';
import { PointsView, type ShopCoupon, type WalletCoupon } from '@/components/account/PointsView';

export const dynamic = 'force-dynamic';

/** "{n}% 적립" 같은 단순 치환 */
function fmtTpl(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

interface LedgerRow {
  id: string;
  delta: number;
  balance_after: number;
  reason: string;
  memo: string | null;
  created_at: string;
}

export default async function PointsPage({ params }: { params: { locale: string } }) {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  const p = dict.points;
  const reasonLabels = p.reason as Record<string, string | undefined>;

  const user = await requireCustomer(locale, 'account/points');
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);

  // 잔액(캐시 컬럼 — 원장으로만 갱신된다)
  const { data: profile } = await supabase
    .from('profiles')
    .select('point_balance')
    .eq('id', user.id)
    .maybeSingle();
  const balance = Number(profile?.point_balance ?? 0);

  // 적립 정책 — app_settings 는 어드민 전용 RLS 라 points_policy() RPC 로 읽는다.
  const { data: policyRaw } = await supabase.rpc('points_policy');
  const policy = (policyRaw ?? {}) as Record<string, number | undefined>;
  const earnRules = [
    { key: 'signup', label: p.earnSignup, amount: Number(policy.signup_bonus ?? 0), note: null },
    { key: 'review', label: p.earnReview, amount: Number(policy.review_bonus ?? 0), note: p.earnOnce },
    { key: 'qna', label: p.earnQna, amount: Number(policy.qna_bonus ?? 0), note: p.earnOnce },
  ].filter((r) => r.amount > 0);
  const earnPercent = Number(policy.order_earn_percent ?? 0);

  // 교환 가능한 쿠폰(교환샵) — coupons 는 공개 읽기 RLS
  const { data: shopRaw } = await supabase
    .from('coupons')
    .select('id, code, name_i18n, discount_type, discount_value, min_amount, currency, point_cost, ends_at, valid_days')
    .eq('is_active', true)
    .eq('is_exchangeable', true)
    .gt('point_cost', 0)
    .or(`ends_at.is.null,ends_at.gte.${today}`)
    .order('point_cost', { ascending: true });

  // 내 쿠폰함 — RLS(user_coupons_select_own)로 본인 것만
  const { data: walletRaw } = await supabase
    .from('user_coupons')
    .select(
      'id, code, status, expires_at, ' +
        'coupon:coupons!coupon_id(code, name_i18n, discount_type, discount_value, min_amount, currency)',
    )
    .order('created_at', { ascending: false })
    .limit(50);

  // 포인트 내역
  const { data: ledgerRaw } = await supabase
    .from('point_ledger')
    .select('id, delta, balance_after, reason, memo, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  const shop = (shopRaw ?? []) as unknown as ShopCoupon[];
  // supabase 임베드는 to-one 이어도 배열로 올 수 있어 단일 객체로 정규화
  const wallet = ((walletRaw ?? []) as unknown as (Omit<WalletCoupon, 'coupon'> & {
    coupon: WalletCoupon['coupon'] | WalletCoupon['coupon'][];
  })[]).map((w) => ({
    ...w,
    coupon: Array.isArray(w.coupon) ? w.coupon[0] ?? null : w.coupon,
  }));
  const ledger = (ledgerRaw ?? []) as LedgerRow[];

  const dateFmt = new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return (
    <div>
      <PointsView locale={locale} dict={p} balance={balance} shop={shop} wallet={wallet} />

      {/* 포인트 받는 방법 — 운영 중인 이벤트만 노출(정책값 0 이면 숨김) */}
      {(earnRules.length > 0 || earnPercent > 0) && (
        <section className="mt-10">
          <h2 className="section-title">{p.earnTitle}</h2>
          <ul className="mt-4 space-y-2 rounded-lg border border-grey-200 p-5">
            {earnRules.map((r) => (
              <li key={r.key} className="flex items-baseline justify-between gap-3 text-sm">
                <span>
                  {r.label}
                  {r.note && <span className="ml-1.5 text-xs text-grey-500">({r.note})</span>}
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-primary">
                  +{r.amount.toLocaleString()} {p.unit}
                </span>
              </li>
            ))}
            {earnPercent > 0 && (
              <li className="text-sm">{fmtTpl(p.earnOrder, { n: earnPercent })}</li>
            )}
          </ul>
        </section>
      )}

      {/* 적립/사용 내역 */}
      <section className="mt-10">
        <h2 className="section-title">{p.historyTitle}</h2>
        {ledger.length === 0 ? (
          <p className="mt-4 rounded-lg border border-grey-200 p-6 text-center text-sm text-grey-500">
            {p.emptyHistory}
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
                    {l.delta.toLocaleString()} {p.unit}
                  </p>
                  <p className="text-xs text-grey-400 tabular-nums">
                    {l.balance_after.toLocaleString()} {p.unit}
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
