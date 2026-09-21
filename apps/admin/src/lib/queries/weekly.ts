// Design Ref: §5 — 주간리포트. 0058 RPC 기반.
// 트래픽/퍼널이 '지금'을 본다면 여기는 '추세'를 본다 — 주차마다 전주 대비 증감을 붙인다.
import { createClient } from '@/lib/supabase/server';

export interface WeeklyRow {
  weekStart: string;
  visitors: number;
  pageviews: number;
  /** 퍼널 */
  productView: number;
  cart: number;
  checkout: number;
  purchase: number;
  /** 주문 */
  orders: number;
  paid: number;
  revenue: number;
  /** 방문 → 결제확정 전환율 */
  conversion: number;
  /** 전주 대비 방문자 증감률. 첫 주는 null. */
  visitorDelta: number | null;
}

export interface PaymentMethodRow {
  method: string;
  attempts: number;
  paid: number;
  revenue: number;
  successRate: number;
}

export interface WeeklyStats {
  weeks: number;
  rows: WeeklyRow[];
  payments: PaymentMethodRow[];
}

type TrafficRpc = { week_start: string; visitors: number; pageviews: number };
type FunnelRpc = {
  week_start: string;
  visit: number;
  product_view: number;
  cart: number;
  checkout: number;
  purchase: number;
};
type OrdersRpc = { week_start: string; orders: number; paid: number; revenue: number };
type PaymentRpc = { method: string; attempts: number; paid: number; revenue: number };

/** RPC 는 date 를 'YYYY-MM-DD' 또는 ISO 로 줄 수 있어 날짜 부분만 키로 쓴다. */
const dayKey = (v: string) => String(v).slice(0, 10);

export async function getWeeklyStats(weeks: number): Promise<WeeklyStats> {
  const supabase = createClient();
  const [trafficRes, funnelRes, ordersRes, payRes] = await Promise.all([
    supabase.rpc('admin_weekly_traffic', { p_weeks: weeks }),
    supabase.rpc('admin_weekly_funnel', { p_weeks: weeks }),
    supabase.rpc('admin_weekly_orders', { p_weeks: weeks }),
    supabase.rpc('admin_payment_method_stats', { p_weeks: weeks }),
  ]);

  const traffic = (trafficRes.data ?? []) as TrafficRpc[];
  const funnel = (funnelRes.data ?? []) as FunnelRpc[];
  const orders = (ordersRes.data ?? []) as OrdersRpc[];

  const fByWeek = new Map(funnel.map((f) => [dayKey(f.week_start), f]));
  const oByWeek = new Map(orders.map((o) => [dayKey(o.week_start), o]));

  // 트래픽이 없어도 주문만 있는 주가 있다(추적 도입 전 기간) — 두 축의 주차를 합집합으로 잡는다.
  const allWeeks = Array.from(
    new Set([
      ...traffic.map((t) => dayKey(t.week_start)),
      ...funnel.map((f) => dayKey(f.week_start)),
      ...orders.map((o) => dayKey(o.week_start)),
    ]),
  ).sort();

  const tByWeek = new Map(traffic.map((t) => [dayKey(t.week_start), t]));

  const rows: WeeklyRow[] = allWeeks.map((wk, i) => {
    const t = tByWeek.get(wk);
    const f = fByWeek.get(wk);
    const o = oByWeek.get(wk);
    const visitors = Number(t?.visitors ?? 0);
    const purchase = Number(f?.purchase ?? 0);

    const prevWk = allWeeks[i - 1];
    const prevVisitors = prevWk == null ? 0 : Number(tByWeek.get(prevWk)?.visitors ?? 0);

    return {
      weekStart: wk,
      visitors,
      pageviews: Number(t?.pageviews ?? 0),
      productView: Number(f?.product_view ?? 0),
      cart: Number(f?.cart ?? 0),
      checkout: Number(f?.checkout ?? 0),
      purchase,
      orders: Number(o?.orders ?? 0),
      paid: Number(o?.paid ?? 0),
      revenue: Number(o?.revenue ?? 0),
      conversion: visitors > 0 ? purchase / visitors : 0,
      // 전주가 0이면 증감률이 무한대라 표시하지 않는다.
      visitorDelta: prevWk != null && prevVisitors > 0 ? (visitors - prevVisitors) / prevVisitors : null,
    };
  });

  const payments: PaymentMethodRow[] = ((payRes.data ?? []) as PaymentRpc[]).map((p) => ({
    method: p.method,
    attempts: Number(p.attempts),
    paid: Number(p.paid),
    revenue: Number(p.revenue),
    successRate: Number(p.attempts) > 0 ? Number(p.paid) / Number(p.attempts) : 0,
  }));

  return { weeks, rows, payments };
}
