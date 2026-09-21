// Design Ref: §5 Phase 4 — 내 주문내역 (RLS: buyer 본인만). orders + order_items + 상품명 join.
import { createClient } from '@/lib/supabase/server';
import type { EventContent, I18n } from '@123band/shared';

/** 입장권 1장(=1입장단위). QR 은 redemption_secret 을 담고, 선물 시 회전된다. */
export interface MyPass {
  id: string;
  redemption_secret: string;
  status: string; // 'valid' | 'used' | 'revoked'
  used_at: string | null;
}

export interface MyOrderItem {
  id: string;
  qty: number;
  /** 1개 단가 — 0042 이전 주문의 패스(티어) 역추적에 쓴다. */
  unit_price: number;
  line_amount: number;
  currency: string;
  checked_in_at: string | null;
  /** 입장 처리된 수량(스캔 누적). qty 도달 시 소진. */
  checked_in_count: number;
  /** 구매한 패스(0042) — 일반상품/레거시 주문은 null. */
  ticket_key?: string | null;
  ticket_name_i18n?: I18n | null;
  /** 이 항목의 패스 중 '내가 현재 소유한' 것만 (RLS: owner_id=본인). 선물한 패스는 빠진다. */
  passes: MyPass[];
  products: {
    id: string;
    name_i18n: I18n;
    image_url: string | null;
    product_type: string;
    is_partner_product: boolean;
    event_content: EventContent | null;
  } | null;
}

export interface MyShipment {
  status: string;
  region: string;
  carrier: string | null;
  tracking_no: string | null;
  eta: string | null;
}

export interface MyOrder {
  id: string;
  order_no: string;
  status: string;
  total_amount: number;
  currency: string;
  // 표시 전용(서브통화) 병기 — 바트 등으로 송금한 주문. 없으면(=마이그레이션 0034 미적용/미해당) canonical 사용.
  display_currency?: string | null;
  display_total?: number | null;
  created_at: string;
  order_items: MyOrderItem[];
  shipments: MyShipment[];
}

export interface MyOrdersPage {
  orders: MyOrder[];
  total: number;
}

/**
 * 로그인 사용자의 주문 — RLS(orders_buyer_own) 로 본인 것만. 최신순 + 페이지네이션(기본 10개/페이지).
 * total 은 전체 주문 수(페이지 계산용).
 */
export async function getMyOrders(
  opts: { page?: number; pageSize?: number } = {},
): Promise<MyOrdersPage> {
  const pageSize = Math.max(1, opts.pageSize ?? 10);
  const page = Math.max(1, opts.page ?? 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const client = createClient();

  // 주문 항목·배송은 공통. 마이그레이션이 덜 적용된 DB 에서도 목록/QR 게이팅은 동작해야 하므로
  // 선택 컬럼(표시통화 0034 · 구매패스 0042)은 있는 조합부터 시도하고 실패하면 빼고 재조회한다.
  const itemsSelect = (ticket: boolean) =>
    'order_items(id, qty, unit_price, line_amount, currency, checked_in_at, checked_in_count, ' +
    (ticket ? 'ticket_key, ticket_name_i18n, ' : '') +
    'passes(id, redemption_secret, status, used_at), ' +
    'products(id, name_i18n, image_url, product_type, is_partner_product, event_content)), ' +
    'shipments(status, region, carrier, tracking_no, eta)';
  const runSelect = (cols: string) =>
    client
      .from('orders')
      .select(cols, { count: 'exact' })
      .is('buyer_hidden_at', null) // 구매자가 숨긴(삭제한) 주문 제외
      .neq('status', 'pending') // 결제대기(미결제) 주문 제외 — 결제 완료된 주문만 노출
      .order('created_at', { ascending: false })
      .range(from, to);

  const ORDER_COLS_FULL = 'id, order_no, status, total_amount, currency, display_currency, display_total, created_at';
  const ORDER_COLS_BASE = 'id, order_no, status, total_amount, currency, created_at';

  // 1차: 표시통화 + 구매패스 → 2차: 표시통화만 → 3차: 둘 다 없이. 어드민 주문상세와 동일한 폴백 순서.
  let { data, error, count } = await runSelect(`${ORDER_COLS_FULL}, ${itemsSelect(true)}`);
  if (error) {
    ({ data, error, count } = await runSelect(`${ORDER_COLS_FULL}, ${itemsSelect(false)}`));
  }
  if (error) {
    ({ data, error, count } = await runSelect(`${ORDER_COLS_BASE}, ${itemsSelect(false)}`));
  }
  if (error) throw error;
  return { orders: (data ?? []) as unknown as MyOrder[], total: count ?? 0 };
}
