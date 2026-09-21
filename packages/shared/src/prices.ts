// Design Ref: §10.4 — 금액은 통화별 최소단위 정수, prices jsonb
import {
  DEFAULT_CURRENCY,
  DISPLAY_CURRENCIES,
  SUB_CURRENCIES,
  type Currency,
  type EventPriceTier,
  type EventTicketTier,
  type I18n,
  type Prices,
} from './types/index';

/** 통화별 소수 자릿수 (USD=2 → 센트, KRW=0 → 원). 서브통화는 전부 정수(=0) 단위로 다룬다(입력·표시 단순화). */
const FRACTION_DIGITS: Record<Currency, number> = {
  USD: 2,
  KRW: 0,
  THB: 0,
  VND: 0,
  CNY: 0,
  JPY: 0,
};

/**
 * 표시/폴백 전용 근사 환율 — 1 단위 통화 = ? USD. (실제 정산 환율 아님)
 * prices 에 대상 통화가 없을 때만 이 값으로 근사 환산. 서브통화는 오거나이저 입력/실시간환율(/api/fx) 우선이고
 * 이 값은 최후 폴백. (1 USD ≈ 1,400원 · 36฿ · 25,000₫ · 7.2¥ · 150엔)
 */
const USD_PER_UNIT: Record<Currency, number> = {
  USD: 1,
  KRW: 1 / 1400,
  THB: 1 / 36,
  VND: 1 / 25000,
  CNY: 1 / 7.2,
  JPY: 1 / 150,
};

/** 보유 통화 최소단위 → 대상 통화 최소단위 근사 환산. (from===to 면 그대로) */
export function convertMinor(minor: number, from: Currency, to: Currency): number {
  if (from === to) return minor;
  const usd = toDisplayAmount(minor, from) * USD_PER_UNIT[from];
  return toMinorAmount(usd / USD_PER_UNIT[to], to);
}

/**
 * prices jsonb 에서 해당 통화 금액(최소단위 정수)을 고른다.
 * 요청 통화가 있으면 그대로, 없으면 기본 통화 → 값이 있는 첫 통화에서 근사 환산(USD_PER_UNIT).
 * 상세/목록/장바구니/결제가 동일 환산을 쓰도록 폴백을 여기서 통일한다. 아무 값도 없으면 null.
 */
export function pickPrice(
  prices: Prices | null | undefined,
  currency: Currency,
  fallback: Currency = DEFAULT_CURRENCY,
): number | null {
  if (!prices) return null;
  if (prices[currency] != null) return prices[currency]!;
  if (prices[fallback] != null) return convertMinor(prices[fallback]!, fallback, currency);
  for (const [c, v] of Object.entries(prices)) {
    if (v != null) return convertMinor(v, c as Currency, currency);
  }
  return null;
}

/** 최소단위 정수 → 표시 단위 숫자 (예: USD 1990 → 19.9) */
export function toDisplayAmount(minorUnits: number, currency: Currency): number {
  return minorUnits / 10 ** FRACTION_DIGITS[currency];
}

/** 표시 단위 숫자 → 최소단위 정수 (예: USD 19.9 → 1990). toDisplayAmount 의 역(반올림). */
export function toMinorAmount(displayAmount: number, currency: Currency): number {
  return Math.max(0, Math.round(displayAmount * 10 ** FRACTION_DIGITS[currency]));
}

/** Intl 기반 통화 포맷 (예: USD 1990 → "$19.90", KRW 2900000 → "₩2,900,000") */
export function formatPrice(
  prices: Prices | null | undefined,
  currency: Currency,
  locale = 'en-US',
): string {
  const minor = pickPrice(prices, currency);
  if (minor == null) return '';
  const display = toDisplayAmount(minor, currency);
  // 센트(소수) 없이 딱 떨어지는 금액이면 뒷자리(.00)를 생략한다. 예: $216.00 → $216,
  // 단 $184.99 처럼 센트가 있으면 그대로 두 자리 표기. (KRW 는 소수 0자리라 영향 없음)
  const hasFraction = !Number.isInteger(display);
  const parts = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    // narrowSymbol 이 없으면 en 로케일에서 THB 가 "THB 9,360" 처럼 코드로 나온다(₩·₫ 는 기호). 기호로 통일.
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: hasFraction ? FRACTION_DIGITS[currency] : 0,
    maximumFractionDigits: FRACTION_DIGITS[currency],
  }).formatToParts(display);
  // 기호가 겹치는 통화만 직접 표기 — USD 는 AUD/CAD 의 '$' 와, CNY/JPY 는 서로 '¥' 와 헷갈린다.
  const symbol: Partial<Record<Currency, string>> = { USD: 'US$', CNY: '元', JPY: '円' };
  return parts.map((p) => (p.type === 'currency' ? (symbol[currency] ?? p.value) : p.value)).join('');
}

/**
 * 화면 표기용 금액 선택 — 표시 통화(서브통화)는 '오거나이저가 입력한 값'만 쓴다.
 * 입력이 없으면 FX 로 지어내지 않고 결제 통화(pay)로 폴백한다. (그것조차 없으면 입력된 값에서 환산 — 극히 드묾)
 * → 상세/장바구니/결제에서 오거나이저가 넣지 않은 통화 가격을 만들어 보여주지 않는다.
 */
export function pickDisplayPrice(
  prices: Prices | null | undefined,
  display: Currency,
  pay: Currency,
): { minor: number; currency: Currency } | null {
  if (!prices) return null;
  if (prices[display] != null) return { minor: prices[display]!, currency: display };
  if (prices[pay] != null) return { minor: prices[pay]!, currency: pay };
  const v = pickPrice(prices, pay); // 결제 통화도 없는 예외 케이스만 환산 폴백
  return v != null ? { minor: v, currency: pay } : null;
}

/** pickDisplayPrice 를 통화 포맷까지 — 없는 서브통화는 지어내지 않고 결제 통화로 표기. */
export function formatDisplayPrice(
  prices: Prices | null | undefined,
  display: Currency,
  pay: Currency,
  locale = 'en-US',
): string {
  const r = pickDisplayPrice(prices, display, pay);
  if (!r) return '';
  return formatPrice({ [r.currency]: r.minor } as Prices, r.currency, locale);
}

// ── 티켓(패스) 가격구간 → 현재 판매가 ─────────────────────────────
// 상세페이지(클라)와 결제견적(서버)이 동일 로직을 쓰도록 shared 에 둔다.

/** 가격구간 마감(datetime-local, KST) → epoch ms. until 없으면 상시(Infinity). */
export function tierDeadlineMs(until?: string): number {
  if (!until) return Infinity;
  const d = new Date(/[+Z]/.test(until) ? until : `${until}+09:00`);
  return Number.isNaN(d.getTime()) ? Infinity : d.getTime();
}

/**
 * 가격이 매겨진 구간 중 마감이 안 지난 첫 구간을 현재가로 본다.
 * 전부 마감이면 null(판매 종료). nowMs = Date.now().
 *
 * '가격이 매겨졌다'의 기준은 USD 뿐 아니라 KRW·서브통화(THB/VND/CNY/JPY)까지 — tierPrices 가 뽑는 값이 하나라도 있으면 된다.
 * (과거엔 USD(wolfPrice/listPrice)만 봐서, 오거나이저가 바트만 입력한 구간은 통째로 '가격 없음' 처리돼
 *  티켓 자체가 상세/목록에서 사라졌다. 결제 금액은 pickPrice 근사 환산으로 상세·장바구니·견적이 동일하게 뽑는다.)
 */
export function activeTicketTier(
  tiers: EventPriceTier[] | undefined,
  nowMs: number,
): EventPriceTier | null {
  const priced = (tiers ?? []).filter((t) => Object.keys(tierPrices(t)).length > 0);
  for (const t of priced) {
    if (tierDeadlineMs(t.until) >= nowMs) return t;
  }
  return null;
}

/** 가격구간 → 판매가(최소단위). 123Band 판매가 우선, 없으면 정식가. 서브통화(THB/VND/CNY/JPY)도 병합. */
export function tierPrices(t: EventPriceTier): Prices {
  const usd = t.wolfPrice ?? t.listPrice;
  const krw = t.wolfPriceKrw ?? t.listPriceKrw;
  const p: Prices = {};
  if (usd != null) p.USD = usd;
  if (krw != null) p.KRW = krw;
  for (const c of SUB_CURRENCIES) {
    const v = t.wolfPricesSub?.[c] ?? t.listPricesSub?.[c];
    if (v != null) p[c] = v;
  }
  return p;
}

/** 가격구간 → 정식가(최소단위). 표시용(취소선/할인율). 서브통화 포함. 없으면 빈 객체. */
export function tierListPrices(t: EventPriceTier): Prices {
  const p: Prices = {};
  if (t.listPrice != null) p.USD = t.listPrice;
  if (t.listPriceKrw != null) p.KRW = t.listPriceKrw;
  for (const c of SUB_CURRENCIES) {
    const v = t.listPricesSub?.[c];
    if (v != null) p[c] = v;
  }
  return p;
}

/** 행사 국가(ISO-3166 alpha-2) → 그 나라 통화. 우리가 다루는 통화만 매핑(그 외는 null). */
const COUNTRY_CURRENCY: Record<string, Currency> = {
  US: 'USD',
  KR: 'KRW',
  TH: 'THB',
  VN: 'VND',
  CN: 'CNY',
  JP: 'JPY',
};

/** 국가코드 → 통화. 모르는 국가면 null. */
export function currencyForCountry(country?: string | null): Currency | null {
  return COUNTRY_CURRENCY[(country ?? '').trim().toUpperCase()] ?? null;
}

/**
 * 한 화면(행사)의 표시 기준 통화 — '실제로 입력된' 가격만 보고 정한다. 환산으로 통화를 지어내지 않는다.
 * 1) 선호 통화(로케일 결제통화)가 모든 가격셋에 있으면 그대로 — 값이 있으면 USD 를 따라간다
 * 2) 없으면 행사 국가 통화 — USD 가 없어지면 그 나라 통화(태국 → ฿)로 간다
 * 3) 그것도 없으면 값이 있는 첫 통화 — 가격이 한 통화뿐이면 그게 기준이 된다
 * 4) 가격 자체가 없으면 선호 통화
 */
export function baseCurrency(
  priceSets: (Prices | null | undefined)[],
  preferred: Currency,
  country?: string | null,
): Currency {
  const sets = priceSets.filter((p): p is Prices => !!p && Object.keys(p).length > 0);
  if (sets.length === 0) return preferred;
  const inAll = (c: Currency) => sets.every((p) => p[c] != null);
  if (inAll(preferred)) return preferred;
  const local = currencyForCountry(country);
  if (local && inAll(local)) return local;
  return DISPLAY_CURRENCIES.find(inAll) ?? preferred;
}

/** prices 에 명시적 값이 있는 통화만(근사 폴백 제외) — 웹 통화 토글 노출용. DISPLAY_CURRENCIES 순서. */
export function currenciesWithValue(prices: Prices | null | undefined): Currency[] {
  if (!prices) return [];
  return DISPLAY_CURRENCIES.filter((c) => prices[c] != null);
}

/** USD 최소단위(센트)에서 서브통화 근사액(각 통화 최소단위)을 계산 — 폴백/기본값용. 실시간 환율은 /api/fx. */
export function subPricesFromUsd(usdMinor: number): Prices {
  const p: Prices = {};
  for (const c of SUB_CURRENCIES) p[c] = convertMinor(usdMinor, 'USD', c);
  return p;
}

/** 티켓 상품의 구매 가능한 패스 하나 — 이름 + 현재 판매가 + 정식가(할인 표기용). */
export interface ActivePass {
  name: I18n;
  prices: Prices; // 현재 판매가(123Band 판매가)
  listPrices: Prices; // 정식가 — 판매가보다 높으면 카드에서 할인율(% OFF) 산출
}

/**
 * 티켓 상품의 여러 패스(Full/Party 등) 각각의 이름 + 현재 판매가 + 정식가 목록.
 * 구매 가능한(가격이 매겨진) 패스만. 상세페이지 purchaseTickets 의 대표가 산출과 동일 로직 →
 * 목록 카드에 표기되는 패스명·가격·할인율이 상세와 일치한다. nowMs = Date.now().
 */
export function activePasses(
  tickets: EventTicketTier[] | undefined,
  nowMs: number,
): ActivePass[] {
  return (tickets ?? [])
    .map((t) => {
      const active = activeTicketTier(t.priceTiers, nowMs);
      const prices = active ? tierPrices(active) : (t.price ?? {});
      const listPrices = active ? tierListPrices(active) : {};
      return { name: t.name ?? {}, prices, listPrices };
    })
    .filter((p) => Object.keys(p.prices).length > 0);
}

/** 주문 한 줄이 '어떤 패스였는지'. exact=false 면 단가로 역추적한 추정값(0042 이전 주문). */
export interface OrderPass {
  name: I18n; // 티켓(패스)명
  tierLabel?: string; // 가격구간명 (얼리버드/August 등) — 있을 때만
  exact: boolean; // true = 주문에 저장된 값, false = 단가 역추적 추정
}

/**
 * 주문항목 → 구매한 패스 정보.
 * 1순위 order_items.ticket_name_i18n(구매시점 스냅샷) → 2순위 ticket_key 로 현재 티켓 조회
 * → 3순위(0042 이전 주문) 단가와 일치하는 가격구간 역추적.
 * 역추적은 단가가 정확히 하나의 (티켓 × 구간)에만 맞을 때만 반환한다. 여러 개면 어느 패스인지 알 수 없으므로
 * 틀린 이름을 보여주느니 null(=행사명만 표시)로 둔다.
 */
export function resolveOrderPass(
  tickets: EventTicketTier[] | undefined,
  opts: {
    ticketKey?: string | null;
    ticketName?: I18n | null;
    unitPrice?: number | null;
    currency?: Currency | null;
  },
): OrderPass | null {
  const list = tickets ?? [];
  const hasText = (n?: I18n | null) => !!n && Object.values(n).some((v) => v && v.trim());

  // 구간명은 저장하지 않으므로(가격구간은 시간에 따라 바뀜) 단가가 맞는 구간이 있으면 그것으로 보강한다.
  const labelOf = (t: EventTicketTier | undefined): string | undefined => {
    if (!t || opts.unitPrice == null || !opts.currency) return undefined;
    const hit = (t.priceTiers ?? []).find(
      (pt) => pickPrice(tierPrices(pt), opts.currency!) === opts.unitPrice,
    );
    return hit?.label?.trim() || undefined;
  };

  if (opts.ticketKey) {
    const t = list.find((x) => x.key === opts.ticketKey);
    const name = hasText(opts.ticketName) ? opts.ticketName! : t?.name;
    if (hasText(name)) return { name: name!, tierLabel: labelOf(t), exact: true };
  }
  if (hasText(opts.ticketName)) return { name: opts.ticketName!, exact: true };

  // ── 레거시 폴백: 단가 ↔ 가격구간 역추적 ──
  if (opts.unitPrice == null || !opts.currency) return null;
  const matches: OrderPass[] = [];
  for (const t of list) {
    if (!hasText(t.name)) continue;
    let hitLabel: string | undefined;
    let hit = false;
    for (const pt of t.priceTiers ?? []) {
      if (pickPrice(tierPrices(pt), opts.currency) === opts.unitPrice) {
        hit = true;
        hitLabel = pt.label?.trim() || undefined;
        break;
      }
    }
    // 레거시 단일가 티켓(priceTiers 없이 price 만 있는 데이터)도 본다.
    if (!hit && t.price && pickPrice(t.price, opts.currency) === opts.unitPrice) hit = true;
    if (hit) matches.push({ name: t.name!, tierLabel: hitLabel, exact: false });
  }
  return matches.length === 1 ? (matches[0] ?? null) : null;
}

/**
 * 정식가 대비 판매가 할인율(%). 정식가가 판매가보다 높을 때만 양수, 아니면 0.
 * 상세페이지(TicketPurchase)의 curPct 공식과 동일. 카드/상세가 같은 값을 보이도록 공용화.
 */
export function discountPercent(
  prices: Prices | null | undefined,
  listPrices: Prices | null | undefined,
  currency: Currency,
): number {
  const w = pickPrice(prices, currency) ?? 0;
  const l = pickPrice(listPrices, currency) ?? 0;
  return l > w && l > 0 ? Math.round(((l - w) / l) * 100) : 0;
}
