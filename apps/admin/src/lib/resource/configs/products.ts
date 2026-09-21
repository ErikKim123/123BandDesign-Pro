// Design Ref: §5.4 상품관리 — products, prices/i18n/attributes + 승인. detail_html 목록 제외.
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import type { ResourceConfig } from '@/lib/resource/types';
import { StatusBadge } from '@/components/form/StatusBadge';
import { formatPrice, type I18n, type Prices } from '@123band/shared';
import { trI18n } from '@/i18n/tr';

export interface ProductRow {
  id: string;
  code: string | null;
  seller_id: string;
  is_partner_product: boolean;
  product_type: string;
  category_id: string | null;
  name_i18n: I18n;
  prices: Prices;
  image_url: string | null;
  status: string;
  // 판매자 계정 embed (profiles!seller_id → email/name + partners.company_name)
  seller?: {
    email: string | null;
    name: string | null;
    partners?: { company_name: string | null }[] | null;
  } | null;
}

/** 판매자 계정 표시: 회사명 > 이메일 > 이름 순. */
export function sellerAccountLabel(row: ProductRow): string {
  const s = row.seller;
  if (!s) return '—';
  const company = s.partners?.[0]?.company_name;
  return company || s.email || s.name || '—';
}

// 행사패스(ticket)는 별도 '행사패스관리'에서 관리 — 상품관리는 실물/구독만.
const TYPE_OPTS = [
  { value: 'physical', label: '실물' },
  { value: 'subscription', label: '구독' },
];
const STATUS_OPTS = [
  { value: 'draft', label: '초안' },
  { value: 'pending', label: '승인대기' },
  { value: 'active', label: '판매중' },
  { value: 'soldout', label: '품절' },
  { value: 'inactive', label: '비활성' },
];

// Design Ref: §3.2 상품 상태 전이
// 비활성(inactive): 노출에서 완전히 내림(공개 읽기는 active 만 노출). 재개로 복구.
// label: 한국어(레거시 소비처 호환) · labelKey: 다국어 사전 키(transitions.*)
export const PRODUCT_TRANSITIONS: Record<
  string,
  { to: string; label: string; labelKey: string }[]
> = {
  draft: [{ to: 'pending', label: '승인요청', labelKey: 'requestApproval' }],
  pending: [
    { to: 'active', label: '승인', labelKey: 'approve' },
    { to: 'draft', label: '반려', labelKey: 'reject' },
  ],
  active: [
    { to: 'soldout', label: '품절', labelKey: 'soldout' },
    { to: 'inactive', label: '비활성', labelKey: 'inactive' },
  ],
  soldout: [
    { to: 'active', label: '재개', labelKey: 'resume' },
    { to: 'inactive', label: '비활성', labelKey: 'inactive' },
  ],
  inactive: [{ to: 'active', label: '재개', labelKey: 'resume' }],
};

const columns: ColumnDef<ProductRow, unknown>[] = [
  { accessorKey: 'name_i18n', header: '상품명', cell: (c) => trI18n(c.getValue() as I18n) },
  { accessorKey: 'product_type', header: '타입', cell: (c) => TYPE_OPTS.find((o) => o.value === c.getValue())?.label ?? String(c.getValue()) },
  { accessorKey: 'is_partner_product', header: '판매자', cell: (c) => (c.getValue() ? '오거나이저' : '자사') },
  { accessorKey: 'prices', header: '가격(USD)', cell: (c) => formatPrice(c.getValue() as Prices, 'USD') || '—' },
  { accessorKey: 'status', header: '상태', cell: (c) => StatusBadge({ status: String(c.getValue()) }) },
];

// category 옵션은 화면에서 useCategoryOptions 로 주입 (custom 슬롯)
export const productsConfig: ResourceConfig<ProductRow> = {
  key: 'products',
  table: 'products',
  title: '상품관리',
  canCreate: true,
  // 행사패스(ticket) 제외 — 실물/구독만 (행사패스는 /event-passes 에서 관리)
  baseFilter: { column: 'product_type', op: 'neq', value: 'ticket' },
  createDefaults: { product_type: 'physical', status: 'draft' },
  autoCodePrefix: 'PRD', // code 자동 생성(폼 숨김)
  autoTranslate: ['detail_html_i18n'], // 저장 시 상세 KO 비면 EN→KO 자동번역(이름은 영문 폴백)
  // Plan FR-10: 목록 select 에서 detail_html_i18n 제외 (성능)
  selectColumns: 'id, code, seller_id, is_partner_product, product_type, category_id, name_i18n, prices, image_url, status',
  defaultSort: { column: 'created_at', asc: false },
  listColumns: columns,
  filters: [
    { name: 'q', label: '코드 검색', kind: 'search', searchColumns: ['code'] },
    { name: 'product_type', label: '타입', kind: 'select', options: TYPE_OPTS },
    { name: 'status', label: '상태', kind: 'select', options: STATUS_OPTS },
  ],
  formFields: [
    { name: 'name_i18n', label: '상품명', kind: 'i18n', required: true },
    { name: 'image_url', label: '대표 이미지(썸네일)', kind: 'custom' }, // ProductImageField
    { name: 'product_type', label: '타입', kind: 'select', options: TYPE_OPTS, required: true },
    { name: 'category_id', label: '카테고리', kind: 'custom' }, // useCategoryOptions 주입
    { name: 'prices', label: '가격', kind: 'prices' },
    { name: 'attributes', label: '속성(JSON)', kind: 'json', placeholder: '{"size":["S","M"]}' },
    { name: 'detail_html_i18n', label: '상세 HTML (AI 생성)', kind: 'custom' }, // AiProductGenerator
    { name: 'status', label: '상태', kind: 'select', options: STATUS_OPTS, required: true },
  ],
  // G2: 보안 검증 (Design §7) — 가격 정수≥0, 상태/타입 enum
  schema: z
    .object({
      product_type: z.enum(['physical', 'ticket', 'subscription']).optional(),
      status: z.enum(['draft', 'pending', 'active', 'soldout', 'inactive']).optional(),
      prices: z
        .record(z.enum(['USD', 'KRW']), z.number().int('정수').nonnegative('0 이상'))
        .optional(),
    })
    .passthrough(),
};
