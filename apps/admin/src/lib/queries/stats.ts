// Design Ref: §5 — 관리자 대시보드 통계 (admin RLS 로 전체 조회). 서버 컴포넌트 전용.
import type { I18n } from '@123band/shared';
import { createClient } from '@/lib/supabase/server';

export interface RecentOrder {
  id: string;
  order_no: string;
  status: string;
  total_amount: number;
  currency: string;
  created_at: string;
  /** 주문자(회원) — orders.buyer_id → profiles */
  buyer: { name: string | null; email: string | null } | null;
  /** 주문 항목의 상품 — 여러 건이면 대시보드에서 첫 상품명 + 나머지 건수로 표기 */
  order_items: { product: { name_i18n: I18n; code: string | null } | null }[] | null;
}

export interface DashboardStats {
  orderCount: number;
  memberCount: number;
  partnerCount: number;
  productCount: number;
  /** 결제완료 이후 주문의 통화별 매출 합 (minor units) */
  revenue: Record<string, number>;
  recentOrders: RecentOrder[];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = createClient();
  const [orders, paid, members, partners, products, recent] = await Promise.all([
    supabase.from('orders').select('*', { count: 'exact', head: true }),
    supabase.from('orders').select('total_amount, currency').in('status', ['paid', 'shipped', 'done']),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'partner'),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase
      .from('orders')
      .select(
        'id, order_no, status, total_amount, currency, created_at, ' +
          'buyer:profiles!buyer_id(name, email), ' +
          'order_items(product:products!product_id(name_i18n, code))',
      )
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const revenue: Record<string, number> = {};
  for (const o of (paid.data ?? []) as { total_amount: number; currency: string }[]) {
    revenue[o.currency] = (revenue[o.currency] ?? 0) + o.total_amount;
  }

  return {
    orderCount: orders.count ?? 0,
    memberCount: members.count ?? 0,
    partnerCount: partners.count ?? 0,
    productCount: products.count ?? 0,
    revenue,
    recentOrders: (recent.data ?? []) as unknown as RecentOrder[],
  };
}
