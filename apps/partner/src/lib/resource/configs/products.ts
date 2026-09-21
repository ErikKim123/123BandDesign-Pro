// Design Ref: §5.4 상품관리 — products, prices/i18n/attributes + 승인. detail_html 목록 제외.
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import type { FieldDef, ResourceConfig } from '@/lib/resource/types';
import { StatusBadge } from '@/components/form/StatusBadge';
import { pickI18n, formatPrice, type I18n, type Prices, type Locale } from '@123band/shared';
import type { PartnerDict } from '@/i18n/dict';

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
];

// Design Ref: §3.2 상품 상태 전이 — 오거나이저 권한 한정. label 은 t.transitions[labelKey] 로 번역.
// 오거나이저는 '초안 → 승인요청(pending)' 까지만. 승인(pending→active)은 운영자 전용.
type TransitionLabelKey = 'requestApproval' | 'cancelRequest' | 'soldout' | 'resume';
export const PARTNER_PRODUCT_TRANSITIONS: Record<string, { to: string; labelKey: TransitionLabelKey }[]> = {
  draft: [{ to: 'pending', labelKey: 'requestApproval' }],
  pending: [{ to: 'draft', labelKey: 'cancelRequest' }],
  active: [{ to: 'soldout', labelKey: 'soldout' }],
  soldout: [{ to: 'active', labelKey: 'resume' }],
};

// 타입/상태 옵션 — 번역본 (useT 주입)
export const typeOpts = (t: PartnerDict) => [
  { value: 'physical', label: t.productType.physical },
  { value: 'subscription', label: t.productType.subscription },
];
export const statusOpts = (t: PartnerDict) => [
  { value: 'draft', label: t.status.draft },
  { value: 'pending', label: t.status.pending },
  { value: 'active', label: t.status.active },
  { value: 'soldout', label: t.status.soldout },
];

const columns: ColumnDef<ProductRow, unknown>[] = [
  { accessorKey: 'name_i18n', header: '상품명', cell: (c) => pickI18n(c.getValue() as I18n, 'ko') || pickI18n(c.getValue() as I18n, 'en') },
  { accessorKey: 'product_type', header: '타입', cell: (c) => TYPE_OPTS.find((o) => o.value === c.getValue())?.label ?? String(c.getValue()) },
  { accessorKey: 'is_partner_product', header: '판매자', cell: (c) => (c.getValue() ? '오거나이저' : '자사') },
  { accessorKey: 'prices', header: '가격(USD)', cell: (c) => formatPrice(c.getValue() as Prices, 'USD') || '—' },
  { accessorKey: 'status', header: '상태', cell: (c) => StatusBadge({ status: String(c.getValue()) }) },
];

// 번역된 폼 필드 (페이지에서 useT 로 주입 → ResourceFormPage)
export function makeProductFormFields(t: PartnerDict): FieldDef[] {
  return [
    // code 는 폼에서 숨김 — 저장 시 autoCodePrefix 로 자동 생성.
    { name: 'name_i18n', label: t.productForm.name, kind: 'i18n', required: true },
    { name: 'image_url', label: t.productForm.image, kind: 'custom' },
    { name: 'product_type', label: t.productForm.type, kind: 'select', options: typeOpts(t), required: true },
    { name: 'category_id', label: t.productForm.category, kind: 'custom' },
    { name: 'prices', label: t.productForm.price, kind: 'prices' },
    { name: 'attributes', label: t.productForm.attributes, kind: 'json', placeholder: '{"size":["S","M"]}' },
    { name: 'detail_html_i18n', label: t.productForm.detailHtml, kind: 'custom' },
    { name: 'reviews_enabled', label: t.productForm.reviewsEnabled, kind: 'toggle' },
    { name: 'qna_enabled', label: t.productForm.qnaEnabled, kind: 'toggle' },
    { name: 'status', label: t.productForm.status, kind: 'select', options: statusOpts(t), required: true },
  ];
}

// 번역된 목록 컬럼 (페이지에서 useT + locale 주입). 상품명은 현재 언어 우선 표시.
export function makeProductColumns(t: PartnerDict, locale: Locale): ColumnDef<ProductRow, unknown>[] {
  const types = typeOpts(t);
  const alt: Locale = locale === 'ko' ? 'en' : 'ko';
  return [
    { accessorKey: 'name_i18n', header: t.columns.productName, cell: (c) => pickI18n(c.getValue() as I18n, locale) || pickI18n(c.getValue() as I18n, alt) },
    { accessorKey: 'product_type', header: t.columns.type, cell: (c) => types.find((o) => o.value === c.getValue())?.label ?? String(c.getValue()) },
    { accessorKey: 'is_partner_product', header: t.columns.seller, cell: (c) => (c.getValue() ? t.columns.partnerYes : t.columns.partnerNo) },
    { accessorKey: 'prices', header: t.columns.priceUsd, cell: (c) => formatPrice(c.getValue() as Prices, 'USD') || '—' },
    { accessorKey: 'status', header: t.columns.status, cell: (c) => StatusBadge({ status: String(c.getValue()) }) },
  ];
}

// category 옵션은 화면에서 useCategoryOptions 로 주입 (custom 슬롯)
export const productsConfig: ResourceConfig<ProductRow> = {
  key: 'products',
  table: 'products',
  title: '상품관리',
  canCreate: true,
  // 행사패스(ticket) 제외 — 실물/구독만 (행사패스는 /event-passes 에서 관리)
  baseFilter: { column: 'product_type', op: 'neq', value: 'ticket' },
  // code 자동 생성(폼 숨김). seller_id 는 화면에서 현재 오거나이저 id 로 주입.
  autoCodePrefix: 'PRD',
  createDefaults: { product_type: 'physical', status: 'draft', is_partner_product: true, reviews_enabled: true, qna_enabled: true },
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
    { name: 'reviews_enabled', label: '후기 게시판 사용', kind: 'toggle' },
    { name: 'qna_enabled', label: 'QnA 게시판 사용', kind: 'toggle' },
    { name: 'status', label: '상태', kind: 'select', options: STATUS_OPTS, required: true },
  ],
  // G2: 보안 검증 (Design §7) — 가격 정수≥0, 상태/타입 enum
  schema: z
    .object({
      product_type: z.enum(['physical', 'ticket', 'subscription']).optional(),
      status: z.enum(['draft', 'pending', 'active', 'soldout']).optional(),
      prices: z
        .record(z.enum(['USD', 'KRW']), z.number().int('정수').nonnegative('0 이상'))
        .optional(),
    })
    .passthrough(),
};
