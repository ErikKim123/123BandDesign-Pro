// 티켓(패스) 선택 구매 — 한 행사에 티켓이 여러 개일 때 상세페이지에서 티켓별 수량을 고르고
// 선택분을 한 번에 장바구니 담기/결제. 로그인 전용(비로그인이면 로그인 유도).
'use client';
import { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Minus, Plus, ShoppingBag, CreditCard, Check, Clock } from 'lucide-react';
import {
  baseCurrency,
  formatPrice,
  formatDisplayPrice,
  pickI18n,
  pickPrice,
  DISPLAY_CURRENCIES,
  type Currency,
  type I18n,
  type Locale,
  type Prices,
} from '@123band/shared';
import { intlLocale } from '@/lib/locale';
import { useCart, type CartItem } from '@/lib/cart/CartContext';
import { useDisplayCurrency } from '@/lib/currency/CurrencyContext';
import { CurrencyToggle } from '@/components/cart/CurrencyToggle';

export interface TicketTierView {
  key: string;
  until?: string; // 구간 마감(datetime-local, KST). 없으면 상시
  prices: Prices; // 123Band 판매가
  listPrices: Prices; // 정식가
  state: 'active' | 'past' | 'upcoming';
}

export interface PurchaseTicket {
  key: string;
  name: I18n;
  prices: Prices; // 현재 판매가 (활성 가격구간, 123Band 판매가) — 담기/결제 기준
  listPrices?: Prices; // 정식가 (표시용)
  tiers: TicketTierView[]; // 기간별(Price Hike) 스케줄
  /**
   * 남은 수량. 총 판매수량(units)을 정하지 않은 티켓은 undefined — 그런 티켓은
   * 지금까지처럼 수량 제한 없이 팔린다(수량을 안 넣었다고 갑자기 못 팔면 안 된다).
   */
  remaining?: number;
}

// 티켓 공통(상품) 정보 — 티켓별 필드(ticketKey/ticketName/prices)는 담을 때 주입.
type BaseItem = Omit<CartItem, 'qty' | 'ticketKey' | 'ticketName' | 'prices'>;

export function TicketPurchase({
  tickets,
  base,
  locale,
  currency,
  country,
  labels,
  disabled,
}: {
  tickets: PurchaseTicket[];
  base: BaseItem;
  locale: Locale;
  currency: Currency;
  /** 행사 국가(ISO-2) — 결제 통화 가격이 없을 때 그 나라 통화로 표기하기 위한 기준. */
  country?: string | null;
  labels: {
    addToCart: string;
    added: string;
    pay: string;
    total: string;
    saleActive: string;
    saleUpcoming: string;
    saleEnded: string;
    saleUntil: string; // "{date}" 치환
    remaining: string; // "{n}" 치환 — 예: "남은 12장"
    soldOut: string;
  };
  disabled?: boolean;
}) {
  const { add, authed } = useCart();
  const router = useRouter();
  const pathname = usePathname();
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [added, setAdded] = useState(false);

  // 표시 통화(서브통화 토글) — 전역 공유값. 결제는 항상 currency(USD/KRW)로 진행되고 이건 표시 전용.
  // 상세에서 고른 통화가 장바구니·결제까지 이어진다(CartView/CheckoutView 도 같은 값을 읽음).
  const { chosenCurrency } = useDisplayCurrency();
  // 이 행사의 기준 통화 — 결제 통화(USD/KRW)가 입력돼 있으면 그대로, 없으면 행사 국가 통화(태국 → ฿).
  // 오거나이저가 바트만 넣은 행사를 US$ 로 환산해 보여주지 않기 위한 기준.
  const baseCur = useMemo(
    () => baseCurrency(tickets.map((t) => t.prices), currency, country),
    [tickets, currency, country],
  );
  // 토글 노출 통화 — 기준 통화 + '모든 티켓'에 실제 값이 입력된 통화만(부분 입력·환산 제외).
  // 결제 통화라도 값이 없으면 넣지 않는다 — 눌러도 가격이 안 바뀌는 죽은 버튼이 되는 걸 막기 위함.
  const availableCurrencies = useMemo(
    () =>
      DISPLAY_CURRENCIES.filter(
        (c) => c === baseCur || (tickets.length > 0 && tickets.every((t) => t.prices[c] != null)),
      ),
    [tickets, baseCur],
  );
  // 이 상세의 실효 표시 통화 — 직접 고른 값이 여기서 못 쓰이면(또는 안 골랐으면) 기준 통화로 폴백.
  const displayCur =
    chosenCurrency && availableCurrencies.includes(chosenCurrency) ? chosenCurrency : baseCur;

  const intl = intlLocale(locale);
  // 표시 통화(서브통화)는 입력된 값만 — 없으면 기준 통화로 폴백(FX 로 지어내지 않음).
  const fmt = (p: Prices) => formatDisplayPrice(p, displayCur, baseCur, intl);
  // 구간 마감일 (M/D, KST). 없으면 빈 문자열. 앞뒤 표현("~", "까지")은 로케일별 라벨이 담당.
  const periodText = (until?: string) => {
    if (!until) return '';
    const d = new Date(/[+Z]/.test(until) ? until : `${until}+09:00`);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(intl, { month: 'numeric', day: 'numeric', timeZone: 'Asia/Seoul' }).format(d);
  };
  const setQ = (k: string, n: number) => setQtys((p) => ({ ...p, [k]: Math.max(0, n) }));

  // 합계 — 실효 표시 통화(displayCur)로. displayCur 는 모든 티켓에 입력된 통화이거나 결제 통화 → 환산 없음.
  const selected = tickets.filter((t) => (qtys[t.key] ?? 0) > 0);
  const total = selected.reduce(
    (s, t) => s + (pickPrice(t.prices, displayCur) ?? 0) * (qtys[t.key] ?? 0),
    0,
  );
  const totalFmt = formatPrice({ [displayCur]: total } as Prices, displayCur, intl);
  const anySelected = selected.length > 0;

  // 비로그인이면 로그인으로(원위치 복귀). 리다이렉트했으면 true.
  function redirectLogin(): boolean {
    if (authed === false) {
      const seg = pathname.split('/').filter(Boolean);
      const loc = seg[0] || 'en';
      const next = seg.slice(1).join('/');
      router.push(`/${loc}/login${next ? `?next=${encodeURIComponent(next)}` : ''}`);
      return true;
    }
    return false;
  }
  function addSelected() {
    for (const t of tickets) {
      const q = qtys[t.key] ?? 0;
      if (q > 0) add({ ...base, ticketKey: t.key, ticketName: t.name, prices: t.prices }, q);
    }
  }
  function onAdd() {
    if (!anySelected || redirectLogin()) return;
    addSelected();
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
    setQtys({});
  }
  function onPay() {
    // 수량 미선택(0개) 상태 결제 시도 — 결제할 내역이 없으니 수량 증가 안내.
    if (!anySelected) {
      window.alert(
        locale === 'ko'
          ? '결제할 상품이 없습니다. 수량을 1개 이상으로 늘려 주세요.'
          : 'There is nothing to pay for. Please increase the quantity to at least 1.',
      );
      return;
    }
    if (redirectLogin()) return;
    addSelected();
    const seg = pathname.split('/').filter(Boolean);
    router.push(`/${seg[0] || 'en'}/checkout`);
  }

  return (
    <div className="space-y-3">
      {/* 통화 토글 — 값이 입력된 통화만 노출. 누르면 가격 표시가 해당 통화로 전환(결제는 결제통화 그대로). */}
      <CurrencyToggle available={availableCurrencies} base={baseCur} locale={locale} />
      <ul className="space-y-2">
        {tickets.map((t) => {
          const q = qtys[t.key] ?? 0;
          const nm = pickI18n(t.name, locale) || pickI18n(base.name_i18n, locale) || '—';
          const selected = q > 0;
          const active = t.tiers.find((x) => x.state === 'active');
          const others = t.tiers.filter((x) => x.state !== 'active');
          // 현재 판매가 — 활성 구간이 있으면 그 값, 없으면(레거시) 대표 티켓가.
          const curPrices = active ? active.prices : t.prices;
          const curList = active ? active.listPrices : t.listPrices ?? {};
          const curW = pickPrice(curPrices, displayCur) ?? 0;
          const curL = pickPrice(curList, displayCur) ?? 0;
          const curPct = curL > curW && curL > 0 ? Math.round(((curL - curW) / curL) * 100) : 0;
          const activePeriod = active ? periodText(active.until) : '';
          const showTop = Boolean(activePeriod) || curPct > 0;
          // 수량을 안 정한 티켓(undefined)은 제한 없음 — 0 과 구분해야 한다.
          const left = t.remaining;
          const soldOut = left != null && left <= 0;
          const atLimit = left != null && q >= left;
          return (
            <li
              key={t.key}
              className={`overflow-hidden rounded-xl border bg-white transition ${
                selected ? 'border-primary ring-1 ring-primary/30' : 'border-grey-200'
              }`}
            >
              {/* 헤더: 티켓명 + 수량 */}
              {/* 티켓명은 자르지 않는다 — 'Bootcamp Performanc…' 처럼 끊기면 패스가 두 종류일 때
                  어느 것을 고르는지 알 수 없어 선택 자체가 불가능해진다. 줄이 늘어나는 편이 낫다.
                  수량 버튼은 shrink-0 으로 고정하고, 이름이 두 줄이 돼도 첫 줄에 맞춰 위로 정렬한다. */}
              <div className="flex items-start justify-between gap-3 px-3.5 pt-3">
                <p className="min-w-0 flex-1 font-semibold leading-snug text-grey-900 [overflow-wrap:anywhere]">
                  {nm}
                </p>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setQ(t.key, q - 1)}
                    disabled={disabled || q <= 0}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-grey-300 text-grey-600 transition hover:border-grey-400 hover:bg-grey-50 disabled:opacity-40"
                    aria-label="-"
                  >
                    <Minus size={13} />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold tabular-nums">{q}</span>
                  <button
                    type="button"
                    onClick={() => setQ(t.key, q + 1)}
                    disabled={disabled || soldOut || atLimit}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-grey-300 text-grey-600 transition hover:border-grey-400 hover:bg-grey-50 disabled:opacity-40"
                    aria-label="+"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>

              {/* 현재 판매가 (강조 카드) */}
              <div className="mx-3.5 mt-2.5 rounded-lg border border-primary/25 bg-primary/[0.05] p-3">
                {showTop && (
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    {activePeriod ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                        <Clock size={12} /> {labels.saleUntil.replace('{date}', activePeriod)}
                      </span>
                    ) : (
                      <span />
                    )}
                    {curPct > 0 && (
                      <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-white">
                        {curPct}% OFF
                      </span>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap items-end gap-x-2 gap-y-0.5">
                  <span className="font-display text-[1.6rem] font-bold leading-none text-grey-900">
                    {fmt(curPrices)}
                  </span>
                  {curPct > 0 && (
                    <span className="pb-0.5 text-sm text-grey-400 line-through">{fmt(curList)}</span>
                  )}
                  {/* 남은 수량 — 가격 옆. 수량을 정하지 않은 티켓은 아무것도 띄우지 않는다. */}
                  {left != null &&
                    (soldOut ? (
                      <span className="pb-0.5 rounded-pill bg-grey-200 px-2 py-0.5 text-[11px] font-bold text-grey-600">
                        {labels.soldOut}
                      </span>
                    ) : (
                      <span className="pb-0.5 text-xs font-semibold text-primary">
                        {labels.remaining.replace('{n}', String(left))}
                      </span>
                    ))}
                </div>
                {active && (
                  <p className="mt-2 flex items-start gap-1 text-xs font-medium leading-snug text-success">
                    <Check size={13} className="mt-px shrink-0" />
                    <span>{labels.saleActive}</span>
                  </p>
                )}
              </div>

              {/* 예정/종료 구간 — 시계 아이콘의 흐린 안내 */}
              {others.length > 0 ? (
                <ul className="mx-3.5 mb-3 mt-2 space-y-1.5 border-t border-grey-100 pt-2">
                  {others.map((tier) => (
                    <li key={tier.key} className="flex items-start gap-1.5 text-xs">
                      <Clock size={12} className="mt-0.5 shrink-0 text-grey-300" />
                      <span className="min-w-0 leading-snug">
                        <span className="font-medium text-grey-500">
                          {periodText(tier.until) ? `~ ${periodText(tier.until)} ` : ''}
                          {fmt(tier.prices)}
                        </span>
                        <span className="text-grey-400">
                          {' · '}
                          {tier.state === 'upcoming' ? labels.saleUpcoming : labels.saleEnded}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="pb-3" />
              )}
            </li>
          );
        })}
      </ul>

      {anySelected && (
        <div className="flex items-center justify-between rounded-lg bg-grey-50 px-3 py-2.5">
          <span className="label-caps text-grey-500">{labels.total}</span>
          <span className="font-display text-xl font-bold text-grey-900">{totalFmt}</span>
        </div>
      )}

      <button
        type="button"
        onClick={onAdd}
        disabled={disabled || !anySelected}
        className="btn btn-primary w-full"
      >
        {added ? (
          <>
            <Check size={16} /> {labels.added}
          </>
        ) : (
          <>
            <ShoppingBag size={16} /> {labels.addToCart}
          </>
        )}
      </button>
      <button
        type="button"
        onClick={onPay}
        disabled={disabled}
        className="btn btn-secondary w-full"
      >
        <CreditCard size={16} /> {labels.pay}
      </button>
    </div>
  );
}
