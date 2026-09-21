// Design Ref: §5.4 주문관리 — orders 조회 + 상태 전이(결제/발송/완료/취소/환불). 생성은 고객 결제 경유.
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import { toDisplayAmount, type Currency } from '@123band/shared';
import type { ResourceConfig } from '@/lib/resource/types';
import { StatusBadge } from '@/components/form/StatusBadge';

export interface OrderRow {
  id: string;
  order_no: string;
  buyer_id: string;
  status: string;
  total_amount: number;
  currency: string;
  // 표시 전용(서브통화) 병기 — 고객이 바트 등으로 송금한 경우. 없으면 canonical 사용.
  // 목록 조회에는 포함하지 않아(마이그레이션 0034 미적용에도 안전) 여기선 선택적.
  display_currency?: string | null;
  display_total?: number | null;
  payment_method: string | null;
  created_at: string;
  // 구매자(회원) embed — orders.buyer_id → profiles
  buyer?: { name: string | null; email: string | null } | null;
  // 주문 항목별 판매자(오거나이저) embed — order_items.seller_id → profiles(→ partners.company_name)
  order_items?:
    | {
        seller_id: string;
        seller?: {
          name: string | null;
          email: string | null;
          partners?: { company_name: string | null }[] | null;
        } | null;
      }[]
    | null;
}

/** 회원명 표시: 이름 > 이메일. */
export function buyerLabel(row: OrderRow): string {
  return row.buyer?.name || row.buyer?.email || '—';
}

/** 오거나이저명 표시: 주문 항목들의 판매자(회사명 > 이름 > 이메일), 중복 제거 후 나열. */
export function organizerLabel(row: OrderRow): string {
  const names = new Set<string>();
  for (const it of row.order_items ?? []) {
    const s = it.seller;
    if (!s) continue;
    const label = s.partners?.[0]?.company_name || s.name || s.email;
    if (label) names.add(label);
  }
  return names.size ? Array.from(names).join(', ') : '—';
}

const STATUS_OPTS = [
  { value: 'pending', label: '결제대기' },
  { value: 'awaiting_payment', label: '입금확인대기' },
  { value: 'paid', label: '결제완료' },
  { value: 'shipped', label: '발송' },
  { value: 'done', label: '완료' },
  { value: 'cancelled', label: '취소' },
  { value: 'refunded', label: '환불' },
];
const PAY_OPTS = [
  { value: 'payverse', label: 'PayVerse' },
  // PG 교체(2026-08) 이전 주문 필터용 레거시 값
  { value: 'portone', label: 'PortOne(구)' },
  { value: 'transfer', label: '계좌이체/송금' },
];

// Design Ref: §3.2 주문 상태 전이 (orders.status)
export const ORDER_TRANSITIONS: Record<string, { to: string; label: string }[]> = {
  pending: [{ to: 'paid', label: '결제확인' }, { to: 'cancelled', label: '취소' }],
  // 송금 주문 — 운영자가 입금 확인 후 '결제확인'으로 확정(또는 취소).
  awaiting_payment: [{ to: 'paid', label: '결제확인' }, { to: 'cancelled', label: '취소' }],
  paid: [{ to: 'shipped', label: '발송' }, { to: 'refunded', label: '환불' }],
  shipped: [{ to: 'done', label: '완료' }],
  done: [],
  cancelled: [],
  refunded: [],
};

// 통화 코드 + 금액(최소단위 → 표시단위). USD 만 센트(2자리), KRW·서브통화(THB 등)는 정수.
export function formatAmount(amount: number, currency: string): string {
  const cur = currency as Currency;
  const display = toDisplayAmount(Number(amount ?? 0), cur);
  return `${currency} ${display.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: cur === 'USD' ? 2 : 0,
  })}`;
}

/** 표시 통화(서브통화) 병기 우선 — display_* 가 있으면 그 통화/금액, 없으면 canonical. */
export function formatOrderAmount(row: {
  total_amount: number;
  currency: string;
  display_currency?: string | null;
  display_total?: number | null;
}): string {
  if (row.display_currency && row.display_total != null) {
    return formatAmount(row.display_total, row.display_currency);
  }
  return formatAmount(row.total_amount, row.currency);
}

const columns: ColumnDef<OrderRow, unknown>[] = [
  { accessorKey: 'order_no', header: '주문번호' },
  { id: 'buyer', header: '회원명', enableSorting: false, cell: (c) => buyerLabel(c.row.original) },
  { id: 'organizer', header: '오거나이저', enableSorting: false, cell: (c) => organizerLabel(c.row.original) },
  { accessorKey: 'status', header: '상태', cell: (c) => StatusBadge({ status: STATUS_OPTS.find((o) => o.value === c.getValue())?.label ?? String(c.getValue()) }) },
  { accessorKey: 'total_amount', header: '금액', cell: (c) => formatOrderAmount(c.row.original) },
  { accessorKey: 'payment_method', header: '결제수단', cell: (c) => PAY_OPTS.find((o) => o.value === c.getValue())?.label ?? '—' },
  { accessorKey: 'created_at', header: '주문일', cell: (c) => String(c.getValue() ?? '').slice(0, 10) },
];

export const ordersConfig: ResourceConfig<OrderRow> = {
  key: 'orders',
  table: 'orders',
  title: '주문관리',
  canCreate: false, // 주문 생성은 고객 결제 플로우(Phase 4) — 어드민은 조회/상태 전이
  // 목록은 canonical 컬럼만 조회(마이그레이션 0034 미적용에도 목록이 안 깨지도록). 바트 병기는 상세(OrderDetail)에서.
  selectColumns:
    'id, order_no, buyer_id, status, total_amount, currency, payment_method, created_at, ' +
    'buyer:profiles!buyer_id(name, email), ' +
    'order_items(seller_id, seller:profiles!seller_id(name, email, partners(company_name)))',
  // 임베드(buyer/order_items)는 실제 컬럼이 아니므로 상태 저장 시 페이로드에서 제거
  omitOnWrite: ['buyer', 'order_items'],
  defaultSort: { column: 'created_at', asc: false },
  listColumns: columns,
  filters: [
    { name: 'q', label: '주문번호·회원명·오거나이저명 검색', kind: 'search', searchColumns: ['order_no'] },
    { name: 'status', label: '상태', kind: 'select', options: STATUS_OPTS },
    { name: 'payment_method', label: '결제수단', kind: 'select', options: PAY_OPTS },
  ],
  // 회원명·오거나이저명 검색 → 관련 테이블에서 id 해석 후 주문 필터(or)로 변환
  buildSearchOr: async (term, supabase) => {
    const like = `%${term}%`;
    const tokens: string[] = [];
    const [{ data: profs }, { data: pas }] = await Promise.all([
      supabase.from('profiles').select('id').or(`name.ilike.${like},email.ilike.${like}`).limit(500),
      supabase.from('partners').select('user_id').ilike('company_name', like).limit(500),
    ]);
    const profIds = (profs as { id: string }[] | null)?.map((r) => r.id) ?? [];
    // 회원명/이메일 매칭 → 구매자 주문
    if (profIds.length) tokens.push(`buyer_id.in.(${profIds.join(',')})`);
    // 오거나이저명(회사명/이름/이메일) 매칭 → 판매자 id → 해당 주문 항목의 주문
    const sellerIds = new Set<string>(profIds);
    (pas as { user_id: string | null }[] | null)?.forEach((r) => r.user_id && sellerIds.add(r.user_id));
    if (sellerIds.size) {
      const { data: items } = await supabase
        .from('order_items')
        .select('order_id')
        .in('seller_id', Array.from(sellerIds))
        .limit(2000);
      const orderIds = Array.from(
        new Set((items as { order_id: string }[] | null)?.map((r) => r.order_id) ?? []),
      );
      if (orderIds.length) tokens.push(`id.in.(${orderIds.join(',')})`);
    }
    return tokens;
  },
  // 상세(주문번호·금액·연락처·상품·배송 등)는 OrderDetail 패널이 표시 — 폼은 상태 변경만.
  formFields: [
    { name: 'status', label: '상태 변경', kind: 'select', options: STATUS_OPTS, required: true },
  ],
  schema: z
    .object({
      status: z
        .enum(['pending', 'awaiting_payment', 'paid', 'shipped', 'done', 'cancelled', 'refunded'])
        .optional(),
    })
    .passthrough(),
};
