// Design Ref: 마이페이지 포인트 — 잔액 / 포인트로 쿠폰 교환 / 내 쿠폰함.
// 교환은 exchange_points_for_coupon RPC 가 포인트 차감 + 개인 쿠폰 발급을 한 트랜잭션으로 처리한다.
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Ticket } from 'lucide-react';
import { formatPrice, pickI18n, type Currency, type Locale, type Prices } from '@123band/shared';
import { intlLocale } from '@/lib/locale';
import { createClient } from '@/lib/supabase/client';
import type { Dictionary } from '@/i18n/dictionaries';

export interface ShopCoupon {
  id: string;
  code: string;
  name_i18n: Record<string, string> | null;
  discount_type: string;
  discount_value: number;
  min_amount: number;
  currency: string;
  point_cost: number;
  ends_at: string | null;
  valid_days: number | null;
}

export interface WalletCoupon {
  id: string;
  code: string;
  status: string;
  expires_at: string | null;
  coupon: {
    code: string;
    name_i18n: Record<string, string> | null;
    discount_type: string;
    discount_value: number;
    min_amount: number;
    currency: string;
  } | null;
}

type Dict = Dictionary['points'];

function money(minor: number, currency: string, locale: Locale): string {
  return formatPrice({ [currency]: minor } as Prices, currency as Currency, intlLocale(locale));
}

/** "20%" 또는 "US$10" */
function discountLabel(
  c: { discount_type: string; discount_value: number; currency: string },
  locale: Locale,
): string {
  return c.discount_type === 'percent'
    ? `${c.discount_value}%`
    : money(c.discount_value, c.currency, locale);
}

function fmt(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

export function PointsView({
  locale,
  dict,
  balance,
  shop,
  wallet,
}: {
  locale: Locale;
  dict: Dict;
  balance: number;
  shop: ShopCoupon[];
  wallet: WalletCoupon[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  // 교환 결과를 화면에 바로 반영하기 위한 사본. 종전에는 router.refresh() 로 페이지를 통째로
  // 다시 그려야 새 쿠폰과 줄어든 잔액이 보였다 — 서버 왕복이 끝날 때까지 화면은 그대로였다.
  const [balanceNow, setBalanceNow] = useState(balance);
  const [walletNow, setWalletNow] = useState(wallet);

  async function exchange(c: ShopCoupon) {
    if (busyId) return;
    setBusyId(c.id);
    setMsg(null);
    try {
      // RPC 는 방금 발급된 user_coupons 행을 그대로 돌려준다(returns user_coupons).
      // 개인 코드(PTxxxxxxxx)는 서버가 만드는 값이라 지어낼 수 없는데, 이 응답에 들어 있으므로
      // 추가 조회 없이 그대로 쿠폰함에 넣을 수 있다.
      const { data, error } = await createClient().rpc('exchange_points_for_coupon', {
        p_coupon_id: c.id,
      });
      if (error) {
        // RPC 가 raise 한 오류코드(insufficient_points 등)를 안내 문구로 매핑
        const errs = dict.err as Record<string, string | undefined>;
        const key = Object.keys(errs).find((k) => error.message.includes(k));
        setMsg({ tone: 'err', text: (key && errs[key]) || dict.err.error });
        return;
      }
      setMsg({ tone: 'ok', text: dict.exchangeOk });

      const row = data as
        | { id: string; code: string; status: string; expires_at: string | null }
        | null;
      if (row?.id && row.code) {
        setWalletNow((prev) => [
          {
            id: row.id,
            code: row.code,
            status: row.status,
            expires_at: row.expires_at,
            coupon: {
              code: c.code,
              name_i18n: c.name_i18n,
              discount_type: c.discount_type,
              discount_value: c.discount_value,
              min_amount: c.min_amount,
              currency: c.currency,
            },
          },
          ...prev,
        ]);
        setBalanceNow((b) => Math.max(0, b - c.point_cost));
      } else {
        // 행을 못 받은 경우(구버전 RPC 등)에만 서버에서 다시 읽는다.
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      /* 클립보드 권한 없음 — 코드가 화면에 보이므로 직접 입력 가능 */
    }
  }

  return (
    <div className="space-y-10">
      {/* 잔액 */}
      <div className="rounded-lg border border-primary/30 bg-cream p-6 text-center">
        <p className="text-sm text-grey-600">{dict.balance}</p>
        <p className="mt-1 text-4xl font-semibold tabular-nums text-primary">
          {balanceNow.toLocaleString()} <span className="text-2xl">{dict.unit}</span>
        </p>
      </div>

      {msg && (
        <p className={`text-center text-sm ${msg.tone === 'ok' ? 'text-success' : 'text-danger'}`}>
          {msg.text}
        </p>
      )}

      {/* 교환샵 */}
      <section>
        <h2 className="section-title">{dict.exchangeTitle}</h2>
        <p className="mt-1 text-sm text-grey-500">{dict.exchangeDesc}</p>

        {shop.length === 0 ? (
          <p className="mt-4 rounded-lg border border-grey-200 p-6 text-center text-sm text-grey-500">
            {dict.emptyShop}
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {shop.map((c) => {
              const enough = balanceNow >= c.point_cost;
              const name = pickI18n(c.name_i18n ?? {}, locale) || c.code;
              return (
                <li key={c.id} className="flex flex-col rounded-lg border border-grey-200 p-4">
                  <div className="flex items-start gap-2">
                    <Ticket size={18} className="mt-0.5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{name}</p>
                      <p className="text-lg font-semibold text-primary">{discountLabel(c, locale)}</p>
                      {c.min_amount > 0 && (
                        <p className="mt-0.5 text-xs text-grey-500">
                          {fmt(dict.minAmount, { amount: money(c.min_amount, c.currency, locale) })}
                        </p>
                      )}
                      {c.valid_days != null && (
                        <p className="text-xs text-grey-500">{fmt(dict.validDays, { n: c.valid_days })}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium tabular-nums">
                      {fmt(dict.needPoints, { n: c.point_cost.toLocaleString() })}
                    </span>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={!enough || busyId === c.id}
                      onClick={() => void exchange(c)}
                    >
                      {busyId === c.id ? dict.exchanging : enough ? dict.exchangeBtn : dict.shortage}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 내 쿠폰함 */}
      <section>
        <h2 className="section-title">{dict.myCouponsTitle}</h2>
        {walletNow.length === 0 ? (
          <p className="mt-4 rounded-lg border border-grey-200 p-6 text-center text-sm text-grey-500">
            {dict.emptyCoupons}
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {walletNow.map((w) => {
              const c = w.coupon;
              const inactive = w.status !== 'active';
              return (
                <li
                  key={w.id}
                  className={`flex flex-wrap items-center gap-3 rounded-lg border p-4 ${
                    inactive ? 'border-grey-200 bg-grey-50 opacity-60' : 'border-primary/30 bg-cream'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {(c && pickI18n(c.name_i18n ?? {}, locale)) || c?.code || w.code}
                    </p>
                    <p className="text-sm text-grey-600">
                      {c ? discountLabel(c, locale) : '—'}
                      {c && c.min_amount > 0 && (
                        <> · {fmt(dict.minAmount, { amount: money(c.min_amount, c.currency, locale) })}</>
                      )}
                    </p>
                    {w.expires_at && (
                      <p className="text-xs text-grey-500">
                        {dict.expiresAt} {w.expires_at.slice(0, 10)}
                      </p>
                    )}
                  </div>
                  {inactive ? (
                    <span className="rounded-pill bg-grey-200 px-3 py-1 text-xs font-medium text-grey-600">
                      {w.status === 'used' ? dict.statusUsed : dict.statusExpired}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void copy(w.code)}
                      className="inline-flex items-center gap-1.5 rounded-pill border border-primary/40 px-3 py-1.5 font-mono text-sm text-primary transition-colors hover:bg-primary/10"
                    >
                      {copied === w.code ? <Check size={14} /> : <Copy size={14} />}
                      {w.code}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
