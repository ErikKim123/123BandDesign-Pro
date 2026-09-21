// 행사패스관리 — products 테이블 중 product_type='ticket' 만 분리 관리.
// 상품관리(products.ts)와 같은 테이블/전이를 공유하되 고정 필터로 티켓만 노출.
// 라벨 다국어: buildEventPassesConfig(t) 로 현재 로케일 사전을 주입해 생성.
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import type { ResourceConfig } from '@/lib/resource/types';
import type { AdminDict, AdminLocale } from '@/i18n/dict';
import { StatusBadge } from '@/components/form/StatusBadge';
import { pickI18n, formatPrice, type I18n, type Prices } from '@123band/shared';
import { type ProductRow, sellerAccountLabel } from './products';

const STATUS_CODES = ['draft', 'pending', 'active', 'soldout'] as const;

export function buildEventPassesConfig(t: AdminDict, locale: AdminLocale): ResourceConfig<ProductRow> {
  const statusOpts = STATUS_CODES.map((value) => ({ value, label: t.status[value] ?? value }));
  const col = t.eventPasses.col;
  const field = t.eventPasses.field;

  const columns: ColumnDef<ProductRow, unknown>[] = [
    { accessorKey: 'name_i18n', header: col.name, cell: (c) => pickI18n(c.getValue() as I18n, locale) },
    { id: 'seller_account', header: col.sellerAccount, cell: (c) => sellerAccountLabel(c.row.original) },
    { accessorKey: 'is_partner_product', header: col.seller, cell: (c) => (c.getValue() ? t.seller.partner : t.seller.own) },
    { accessorKey: 'prices', header: col.price, cell: (c) => formatPrice(c.getValue() as Prices, 'USD') || '—' },
    { accessorKey: 'status', header: col.status, cell: (c) => StatusBadge({ status: String(c.getValue()) }) },
  ];

  return {
    key: 'event-passes',
    table: 'products',
    title: t.eventPasses.title,
    canCreate: true,
    // 티켓(행사패스)만 노출 + 신규 생성 시 product_type 고정
    baseFilter: { column: 'product_type', op: 'eq', value: 'ticket' },
    createDefaults: { product_type: 'ticket', status: 'draft' },
    autoCodePrefix: 'EVT', // code 자동 생성(폼 숨김)
    autoTranslate: ['detail_html_i18n', 'event_content'], // 저장 시 상세·이벤트 섹션 KO 비면 EN→KO 자동번역(이름은 영문 폴백)
    // 수정 시 이벤트 콘텐츠 프리로드 + 판매자 계정(profiles/partners) embed
    selectColumns:
      'id, code, seller_id, is_partner_product, product_type, category_id, name_i18n, prices, image_url, status, event_content, seller:profiles!seller_id(email, name, partners(company_name))',
    omitOnWrite: ['seller'], // 조인 임베드는 쓰기 제외
    defaultSort: { column: 'created_at', asc: false },
    listColumns: columns,
    filters: [
      { name: 'q', label: t.eventPasses.searchPlaceholder, kind: 'search', searchColumns: ['code'] },
      { name: 'status', label: t.eventPasses.col.status, kind: 'select', options: statusOpts },
    ],
    searchSellers: true,
    formFields: [
      { name: 'name_i18n', label: field.name_i18n, kind: 'i18n', required: true },
      { name: 'image_url', label: field.image_url, kind: 'custom' }, // ProductImageField
      { name: 'country', label: t.country.label, kind: 'custom' }, // CountrySelect → event_content.country
      { name: 'category_id', label: field.category_id, kind: 'custom' }, // useCategoryOptions 주입
      { name: 'prices', label: field.prices, kind: 'prices' },
      { name: 'attributes', label: field.attributes, kind: 'json', placeholder: '{"seat":["VIP","R","S"]}' },
      { name: 'detail_html_i18n', label: field.detail_html_i18n, kind: 'custom' }, // AiProductGenerator
      { name: 'event_content', label: field.event_content, kind: 'custom' }, // EventEditor
      { name: 'status', label: field.status, kind: 'select', options: statusOpts, required: true },
    ],
    // 가격 정수≥0, 상태 enum (product_type 은 고정값이라 검증 불필요)
    schema: z
      .object({
        status: z.enum(['draft', 'pending', 'active', 'soldout']).optional(),
        prices: z
          .record(z.enum(['USD', 'KRW']), z.number().int('정수').nonnegative('0 이상'))
          .optional(),
      })
      .passthrough(),
  };
}
