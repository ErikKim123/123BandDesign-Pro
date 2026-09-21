// Design Ref: §5.4 게시판관리 계열 — 상품후기(product_reviews) 모더레이션. 조회 + 삭제(부적절 후기 정리).
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import type { I18n } from '@123band/shared';
import { trI18n } from '@/i18n/tr';
import type { ResourceConfig } from '@/lib/resource/types';

export interface ReviewRow {
  id: string;
  product_id: string;
  author_id: string | null;
  author_name: string | null;
  rating: number;
  content: string | null;
  created_at: string;
  products?: { name_i18n: I18n } | null;
}

const RATING_OPTS = [
  { value: '5', label: '★★★★★' },
  { value: '4', label: '★★★★' },
  { value: '3', label: '★★★' },
  { value: '2', label: '★★' },
  { value: '1', label: '★' },
];

const stars = (n: number) => '★'.repeat(Math.max(0, Math.min(5, n))) + '☆'.repeat(5 - Math.max(0, Math.min(5, n)));

const columns: ColumnDef<ReviewRow, unknown>[] = [
  {
    accessorKey: 'products',
    header: '상품',
    cell: (c) => {
      const p = c.getValue() as ReviewRow['products'];
      return p ? trI18n(p.name_i18n) || '—' : '—';
    },
  },
  { accessorKey: 'rating', header: '별점', cell: (c) => stars(Number(c.getValue() ?? 0)) },
  { accessorKey: 'author_name', header: '작성자', cell: (c) => c.getValue() ?? '—' },
  {
    accessorKey: 'content',
    header: '내용',
    cell: (c) => {
      const s = String(c.getValue() ?? '');
      return s.length > 40 ? `${s.slice(0, 40)}…` : s || '—';
    },
  },
  { accessorKey: 'created_at', header: '작성일', cell: (c) => String(c.getValue() ?? '').slice(0, 10) },
];

export const productReviewsConfig: ResourceConfig<ReviewRow> = {
  key: 'product-reviews',
  table: 'product_reviews',
  title: '상품후기',
  canCreate: false, // 모더레이션 전용 — 조회/삭제만
  selectColumns:
    'id, product_id, author_id, author_name, rating, content, created_at, products(name_i18n)',
  defaultSort: { column: 'created_at', asc: false },
  listColumns: columns,
  filters: [
    { name: 'q', label: '내용/작성자 검색', kind: 'search', searchColumns: ['content', 'author_name'] },
    { name: 'rating', label: '별점', kind: 'select', options: RATING_OPTS },
  ],
  formFields: [
    { name: 'author_name', label: '작성자', kind: 'text', readOnly: true },
    { name: 'rating', label: '별점', kind: 'number', readOnly: true },
    { name: 'content', label: '내용', kind: 'textarea', readOnly: true },
    { name: 'created_at', label: '작성일', kind: 'text', readOnly: true },
  ],
  schema: z.object({}).passthrough(),
};
