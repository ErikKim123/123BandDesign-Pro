// Design Ref: §5 Phase 4 — 서버 측 금액 재계산 (클라이언트 total 신뢰 안 함)
// 클라이언트는 상품id+수량+쿠폰코드만 보낸다. 단가/합계/할인은 전부 DB 기준으로 서버가 다시 계산.
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  activeTicketTier,
  pickI18n,
  pickPrice,
  tierPrices,
  type Currency,
  type EventContent,
  type I18n,
  type Locale,
  type Prices,
} from '@123band/shared';

export interface CartLine {
  id: string;
  qty: number;
  ticketKey?: string; // 티켓(패스) 변형 — 있으면 해당 티켓의 현재가로 견적
}

export interface QuoteItem {
  productId: string;
  sellerId: string;
  qty: number;
  unitPrice: number;
  lineAmount: number;
  // 구매한 티켓(패스) 티어 — order_items 에 그대로 저장한다(0042). 일반상품은 undefined.
  // 이름은 구매 시점 스냅샷: 오거나이저가 나중에 티켓명을 바꿔도 주문서 표기는 유지돼야 한다.
  ticketKey?: string;
  ticketName?: I18n;
}

export interface Quote {
  currency: Currency;
  items: QuoteItem[];
  subtotal: number; // 최소단위
  discount: number; // 최소단위
  total: number; // 최소단위 (= subtotal - discount, 0 이상)
  couponCode: string | null;
  orderName: string; // PG 표시용 ("상품명 외 N건")
  // 표시 전용(서브통화) — 고객이 웹에서 바트 등으로 보고 송금한 경우. 정산/통계는 위 canonical 그대로.
  displayCurrency?: Currency; // 결제 통화와 다를 때만(같으면 생략 → canonical 사용)
  displayTotal?: number; // 표시 통화 기준 최종 결제금액(최소단위)
}

export type QuoteResult =
  | { ok: true; quote: Quote }
  | { ok: false; reason: 'empty' | 'invalid_item' | 'unavailable' | 'coupon' };

interface ProductRow {
  id: string;
  seller_id: string;
  status: string;
  name_i18n: Record<string, string>;
  prices: Prices;
  event_content?: EventContent | null;
}

interface CouponRow {
  code: string;
  discount_type: string;
  discount_value: number;
  min_amount: number;
  currency: string;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  used_count: number;
  is_active: boolean;
}

const COUPON_COLS =
  'code, discount_type, discount_value, min_amount, currency, starts_at, ends_at, usage_limit, used_count, is_active';

/** 할인액(최소단위) — 총액을 넘지 않도록 캡. 정액 쿠폰은 통화 일치 시에만. */
function computeDiscount(coupon: CouponRow, subtotal: number, currency: Currency): number {
  let d = 0;
  if (coupon.discount_type === 'percent') {
    d = Math.floor((subtotal * coupon.discount_value) / 100);
  } else if (coupon.currency === currency) {
    d = coupon.discount_value;
  }
  return Math.min(Math.max(0, d), subtotal);
}

function buildOrderName(items: QuoteItem[], names: Map<string, string>, locale: Locale): string {
  const first = names.get(items[0]?.productId ?? '') || '123Band';
  const more = items.length - 1;
  if (more <= 0) return first;
  return locale === 'ko' ? `${first} 외 ${more}건` : `${first} +${more} more`;
}

/**
 * 장바구니(상품id+수량)와 쿠폰코드로 서버 권위 견적을 만든다.
 * 가격은 DB 의 products.prices[currency] 에서만 읽는다 → 클라이언트 가격 위조 불가.
 * db: 로그인 사용자 세션 클라이언트(RLS 적용). 상품/쿠폰은 공개 조회라 anon 으로 충분 → service role 불필요.
 */
export async function quoteCart(
  db: SupabaseClient,
  lines: CartLine[],
  currency: Currency,
  locale: Locale,
  couponCode: string | null,
  today: string,
  // 고객이 웹에서 본 표시 통화(서브통화 가능). 결제 통화와 다르면 '표시 전용' 금액을 함께 산출한다.
  displayCurrency?: Currency,
): Promise<QuoteResult> {
  const clean = (lines ?? []).filter(
    (l) => l && typeof l.id === 'string' && Number.isInteger(l.qty) && l.qty > 0,
  );
  if (clean.length === 0) return { ok: false, reason: 'empty' };

  const ids = [...new Set(clean.map((l) => l.id))];
  const { data, error } = await db
    .from('products')
    .select('id, seller_id, status, name_i18n, prices, event_content')
    .in('id', ids);
  if (error) return { ok: false, reason: 'invalid_item' };

  const byId = new Map<string, ProductRow>((data as ProductRow[]).map((p) => [p.id, p]));
  const names = new Map<string, string>();
  const items: QuoteItem[] = [];
  // 표시 통화(서브통화)가 결제 통화와 다를 때만 별도 집계 — 같은 가격 소스에서 해당 통화로 픽/환산.
  const wantDisplay = !!displayCurrency && displayCurrency !== currency;
  let displaySubtotal = 0;

  for (const line of clean) {
    const p = byId.get(line.id);
    if (!p) return { ok: false, reason: 'invalid_item' };
    if (p.status !== 'active') return { ok: false, reason: 'unavailable' };
    // 티켓(패스) 변형이면 해당 티켓의 현재 판매가(활성 가격구간)로, 아니면 상품 대표가로 견적.
    let priceObj: Prices | null | undefined;
    let ticketName: I18n | undefined;
    if (line.ticketKey) {
      const ticket = (p.event_content?.tickets ?? []).find((t) => t.key === line.ticketKey);
      const active = ticket ? activeTicketTier(ticket.priceTiers, Date.now()) : null;
      priceObj = active ? tierPrices(active) : ticket?.price;
      ticketName = ticket?.name;
    } else {
      priceObj = p.prices;
    }
    const unit = pickPrice(priceObj, currency);
    if (unit == null) return { ok: false, reason: 'unavailable' };
    // 표시 통화 단가 — 입력된 서브통화 우선, 없으면 근사 환산(pickPrice). 표시 전용이라 실패해도 결제엔 무관.
    if (wantDisplay) displaySubtotal += (pickPrice(priceObj, displayCurrency!) ?? 0) * line.qty;
    names.set(p.id, pickI18n(p.name_i18n, locale) || '123Band');
    items.push({
      productId: p.id,
      sellerId: p.seller_id,
      qty: line.qty,
      unitPrice: unit,
      lineAmount: unit * line.qty,
      ...(line.ticketKey ? { ticketKey: line.ticketKey, ticketName } : {}),
    });
  }

  const subtotal = items.reduce((s, i) => s + i.lineAmount, 0);

  // 쿠폰 서버 검증 (클라이언트 검증과 동일 규칙을 서버 권위로 재확인)
  // 0038 이후: 개인 발급 코드(user_coupons, 포인트 교환분)를 먼저 찾고 없으면 전역 코드를 본다.
  // db 는 로그인 세션 클라이언트이므로 RLS 가 "내 쿠폰"만 보이게 해준다 → 남의 코드 도용 불가.
  let discount = 0;
  let appliedCode: string | null = null;
  const code = couponCode?.trim().toUpperCase();
  if (code) {
    const { data: mineRaw } = await db
      .from('user_coupons')
      .select(`code, expires_at, coupon:coupons!coupon_id(${COUPON_COLS})`)
      .eq('code', code)
      .eq('status', 'active')
      .maybeSingle();
    const mine = mineRaw as { code: string; expires_at: string | null; coupon: CouponRow | CouponRow[] } | null;

    if (mine) {
      const origin = Array.isArray(mine.coupon) ? mine.coupon[0] : mine.coupon;
      if (!origin || !origin.is_active) return { ok: false, reason: 'coupon' };
      const expired =
        (mine.expires_at && mine.expires_at < today) ||
        (origin.starts_at && origin.starts_at > today) ||
        (origin.ends_at && origin.ends_at < today);
      const belowMin = origin.min_amount > 0 && subtotal < origin.min_amount;
      // 개인 발급분은 이미 수량을 확보한 상태 → usage_limit/used_count 는 보지 않는다.
      if (expired || belowMin) return { ok: false, reason: 'coupon' };
      discount = computeDiscount(origin, subtotal, currency);
      appliedCode = mine.code;
    } else {
      const { data: crow } = await db
        .from('coupons')
        .select(COUPON_COLS)
        .eq('code', code)
        .eq('is_active', true)
        .eq('is_exchangeable', false) // 교환 전용 쿠폰의 원본 코드는 직접 사용 불가
        .maybeSingle();
      const coupon = crow as CouponRow | null;
      if (coupon) {
        const expired =
          (coupon.starts_at && coupon.starts_at > today) ||
          (coupon.ends_at && coupon.ends_at < today);
        const usedUp = coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit;
        const belowMin = coupon.min_amount > 0 && subtotal < coupon.min_amount;
        if (expired || usedUp || belowMin) return { ok: false, reason: 'coupon' };
        discount = computeDiscount(coupon, subtotal, currency);
        appliedCode = coupon.code;
      } else {
        return { ok: false, reason: 'coupon' };
      }
    }
  }

  const total = Math.max(0, subtotal - discount);

  // 표시 통화 최종액 — 할인은 결제 통화 기준이므로 표시 통화로 근사 환산해 차감(표시 전용).
  let displayCur: Currency | undefined;
  let displayTotal: number | undefined;
  if (wantDisplay) {
    const dispDiscount =
      discount > 0 ? pickPrice({ [currency]: discount } as Prices, displayCurrency!) ?? 0 : 0;
    displayCur = displayCurrency;
    displayTotal = Math.max(0, displaySubtotal - dispDiscount);
  }

  return {
    ok: true,
    quote: {
      currency,
      items,
      subtotal,
      discount,
      total,
      couponCode: appliedCode,
      orderName: buildOrderName(items, names, locale),
      displayCurrency: displayCur,
      displayTotal,
    },
  };
}
