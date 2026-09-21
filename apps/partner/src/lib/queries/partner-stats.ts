// 오거나이저 대시보드/정산 통계 — 본인 데이터만 (RLS: products/order_items seller_id = auth.uid()).
// 서버 컴포넌트 전용.
//
// 주: order_items 의 부모 orders 는 RLS(orders_buyer_own) 상 오거나이저에게 막혀 있어
//     중첩 embed(orders(...)) 가 null 일 수 있다. 그 경우 주문번호/상태/일자는 '—' 로 표기하고
//     정산 집계에는 포함한다(취소/환불을 아는 경우에만 제외). 판매자에게 orders SELECT 를
//     허용하는 마이그레이션(0011_partner_order_visibility.sql)을 적용하면 자동으로 채워진다.
import { createClient } from '@/lib/supabase/server';
import { pickI18n, type I18n } from '@123band/shared';

export interface PartnerSaleRow {
  id: string;
  productName: string;
  nameI18n: I18n | null; // 원본 i18n — 클라이언트에서 현재 언어로 표시
  qty: number;
  lineAmount: number; // 최소단위 정수
  currency: string;
  orderNo: string | null;
  orderStatus: string | null;
  createdAt: string | null;
  buyerName: string | null; // 구매자 이름 (RLS 0025 적용 시 노출, 미적용/없으면 null)
}

export interface PartnerSettlement {
  rows: PartnerSaleRow[];
  /** 정산 대상(취소/환불 제외) 통화별 총 판매액 (최소단위 정수) */
  gross: Record<string, number>;
  /** 수수료 차감 후 정산 예정액 (최소단위 정수) */
  payout: Record<string, number>;
  commissionRate: number;
}

interface RawItem {
  id: string;
  qty: number;
  line_amount: number;
  currency: string;
  products: { name_i18n: I18n } | null;
  orders: {
    order_no: string;
    status: string;
    created_at: string;
    buyer: { name: string | null } | null;
  } | null;
}

const EXCLUDED = new Set(['cancelled', 'refunded']);

/** 오거나이저 본인 판매 내역 + 정산 집계 */
export async function getPartnerSettlement(userId: string): Promise<PartnerSettlement> {
  const supabase = createClient();
  const [partnerRes, itemsRes] = await Promise.all([
    supabase.from('partners').select('commission_rate').eq('user_id', userId).maybeSingle(),
    supabase
      .from('order_items')
      .select(
        'id, qty, line_amount, currency, products(name_i18n), orders(order_no, status, created_at, buyer:profiles(name))',
      )
      .eq('seller_id', userId),
  ]);

  const commissionRate = Number(partnerRes.data?.commission_rate ?? 0);
  const raw = (itemsRes.data ?? []) as unknown as RawItem[];

  const gross: Record<string, number> = {};
  const payout: Record<string, number> = {};
  const rows: PartnerSaleRow[] = raw.map((r) => {
    const status = r.orders?.status ?? null;
    const counted = status === null || !EXCLUDED.has(status);
    if (counted) {
      gross[r.currency] = (gross[r.currency] ?? 0) + r.line_amount;
      payout[r.currency] = (payout[r.currency] ?? 0) + Math.round(r.line_amount * (1 - commissionRate));
    }
    return {
      id: r.id,
      productName:
        pickI18n(r.products?.name_i18n, 'ko') || pickI18n(r.products?.name_i18n, 'en') || '—',
      nameI18n: r.products?.name_i18n ?? null,
      qty: r.qty,
      lineAmount: r.line_amount,
      currency: r.currency,
      orderNo: r.orders?.order_no ?? null,
      orderStatus: status,
      createdAt: r.orders?.created_at ?? null,
      buyerName: r.orders?.buyer?.name?.trim() || null,
    };
  });

  // 최근순 (created_at 가 있으면 기준 정렬)
  rows.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  return { rows, gross, payout, commissionRate };
}

export interface PartnerStats {
  productCount: number;
  activeProductCount: number;
  eventPassCount: number;
  saleItemCount: number;
  gross: Record<string, number>;
  payout: Record<string, number>;
  commissionRate: number;
  recentSales: PartnerSaleRow[];
}

/** 대시보드 요약 (상품 수 + 판매/정산 요약 + 최근 판매 5건) */
export async function getPartnerStats(userId: string): Promise<PartnerStats> {
  const supabase = createClient();
  const [productsCnt, activeCnt, eventPassCnt, settlement] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('seller_id', userId),
    supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('seller_id', userId)
      .eq('status', 'active'),
    supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('seller_id', userId)
      .eq('product_type', 'ticket'),
    getPartnerSettlement(userId),
  ]);

  return {
    productCount: productsCnt.count ?? 0,
    activeProductCount: activeCnt.count ?? 0,
    eventPassCount: eventPassCnt.count ?? 0,
    saleItemCount: settlement.rows.length,
    gross: settlement.gross,
    payout: settlement.payout,
    commissionRate: settlement.commissionRate,
    recentSales: settlement.rows.slice(0, 5),
  };
}
