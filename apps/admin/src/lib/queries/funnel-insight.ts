// 퍼널 — 세그먼트 분해 · 매출 지표 · 결제수단 성공률 · 데이터 신뢰도 (0119).
//
// 기존 funnel.ts 는 '전체 한 덩어리'를 본다. 평균은 거짓말을 한다 — 모바일 결제 이탈이
// 데스크톱 전환에 가려지고, 광고로 온 사람과 검색으로 온 사람이 섞인다. 여기서는 같은
// 퍼널을 기기·채널·신규/재방문·국가·랜딩별로 다시 그리는 데 필요한 것만 읽는다.
//
// 그리고 수치를 보기 전에 수치를 믿을 수 있는지부터 본다(신뢰도 점검).
import { createClient } from '@/lib/supabase/server';

/** 퍼널을 나눠 보는 축. DB 함수 p_dimension 과 1:1. */
export type FunnelDimension = 'device' | 'channel' | 'visitor_type' | 'country' | 'landing';

export const DIMENSIONS: { key: FunnelDimension; label: string }[] = [
  { key: 'device', label: '기기' },
  { key: 'channel', label: '유입 채널' },
  { key: 'visitor_type', label: '신규/재방문' },
  { key: 'country', label: '국가' },
  { key: 'landing', label: '랜딩 화면' },
];

export interface SegmentRow {
  segment: string;
  visitors: number;
  productView: number;
  cart: number;
  checkout: number;
  purchase: number;
  revenue: number;
  /** 방문 → 구매 */
  conversion: number;
  /** 결제시작 → 구매 — 결제 구간에서 새는 양이 여기 보인다. */
  checkoutToPurchase: number;
}

export interface RevenueStats {
  orders: number;
  revenue: number;
  /** 객단가 */
  aov: number;
  /** 방문당 매출 */
  rpv: number;
  visitors: number;
}

export interface PaymentRow {
  method: string;
  started: number;
  /** PG 거래번호가 붙은 주문 = 결제창까지 간 주문. 여기 못 닿았으면 우리 화면에서 샌 것이다. */
  reachedPg: number;
  paid: number;
  pending: number;
  cancelled: number;
  successRate: number;
  revenue: number;
}

/** 점검 항목 코드 — 화면이 이 코드로 문구를 고른다. */
export type IntegrityKey =
  | 'purchase_vs_orders'
  | 'orders_without_visitor'
  | 'utm_rule_violations'
  | 'bot_traffic'
  | 'excluded_pageviews'
  | 'stale_pending_orders';

export interface IntegrityRow {
  key: IntegrityKey;
  value: number;
  total: number;
  severity: 'ok' | 'warn' | 'bad';
}

export interface FunnelInsight {
  segments: SegmentRow[];
  revenue: RevenueStats;
  payments: PaymentRow[];
  integrity: IntegrityRow[];
}

const num = (v: unknown) => Number(v ?? 0);

export async function getFunnelInsight(
  days: number,
  end: string | null,
  dimension: FunnelDimension,
): Promise<FunnelInsight> {
  const supabase = createClient();
  const [segRes, revRes, payRes, intRes] = await Promise.all([
    supabase.rpc('admin_funnel_segments', {
      p_days: days,
      p_end: end,
      p_dimension: dimension,
      p_limit: 12,
    }),
    supabase.rpc('admin_funnel_revenue', { p_days: days, p_end: end }),
    supabase.rpc('admin_payment_success', { p_days: days, p_end: end }),
    supabase.rpc('admin_funnel_integrity', { p_days: days, p_end: end }),
  ]);

  const segments: SegmentRow[] = (
    (segRes.data ?? []) as Record<string, unknown>[]
  ).map((r) => {
    const visitors = num(r.visitors);
    const checkout = num(r.checkout);
    const purchase = num(r.purchase);
    return {
      segment: String(r.segment ?? ''),
      visitors,
      productView: num(r.product_view),
      cart: num(r.cart),
      checkout,
      purchase,
      revenue: num(r.revenue),
      conversion: visitors > 0 ? purchase / visitors : 0,
      checkoutToPurchase: checkout > 0 ? purchase / checkout : 0,
    };
  });

  const rev = ((revRes.data ?? []) as Record<string, unknown>[])[0] ?? {};
  const revenue: RevenueStats = {
    orders: num(rev.orders),
    revenue: num(rev.revenue),
    aov: num(rev.aov),
    rpv: num(rev.rpv),
    visitors: num(rev.visitors),
  };

  const payments: PaymentRow[] = ((payRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
    method: String(r.method ?? ''),
    started: num(r.started),
    reachedPg: num(r.reached_pg),
    paid: num(r.paid),
    pending: num(r.pending),
    cancelled: num(r.cancelled),
    successRate: num(r.success_rate),
    revenue: num(r.revenue),
  }));

  const integrity: IntegrityRow[] = ((intRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
    key: String(r.check_key ?? '') as IntegrityKey,
    value: num(r.value),
    total: num(r.total),
    severity: (String(r.severity ?? 'ok') as IntegrityRow['severity']) ?? 'ok',
  }));

  return { segments, revenue, payments, integrity };
}
