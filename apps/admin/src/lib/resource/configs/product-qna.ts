// Design Ref: §5.4 게시판관리 계열 — 상품문의(product_qna) 모더레이션. 조회 + 삭제(부적절 문의 정리).
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import type { I18n } from '@123band/shared';
import { trI18n } from '@/i18n/tr';
import type { ResourceConfig } from '@/lib/resource/types';

export interface QnaRow {
  id: string;
  product_id: string;
  author_id: string | null;
  author_name: string | null;
  question: string | null;
  answer: string | null;
  answered_at: string | null;
  created_at: string;
  products?: { name_i18n: I18n } | null;
}

const truncate = (s: unknown, n = 40) => {
  const v = String(s ?? '');
  return v.length > n ? `${v.slice(0, n)}…` : v || '—';
};

const columns: ColumnDef<QnaRow, unknown>[] = [
  {
    accessorKey: 'products',
    header: '상품',
    cell: (c) => {
      const p = c.getValue() as QnaRow['products'];
      return p ? trI18n(p.name_i18n) || '—' : '—';
    },
  },
  { accessorKey: 'author_name', header: '작성자', cell: (c) => c.getValue() ?? '—' },
  { accessorKey: 'question', header: '질문', cell: (c) => truncate(c.getValue()) },
  { accessorKey: 'answer', header: '답변', cell: (c) => (c.getValue() ? '완료' : '미답변') },
  { accessorKey: 'created_at', header: '작성일', cell: (c) => String(c.getValue() ?? '').slice(0, 10) },
];

export const productQnaConfig: ResourceConfig<QnaRow> = {
  key: 'product-qna',
  table: 'product_qna',
  title: '상품문의',
  canCreate: false, // 모더레이션 전용 — 조회/삭제만
  selectColumns:
    'id, product_id, author_id, author_name, question, answer, answered_at, created_at, products(name_i18n)',
  defaultSort: { column: 'created_at', asc: false },
  listColumns: columns,
  filters: [
    { name: 'q', label: '질문/작성자 검색', kind: 'search', searchColumns: ['question', 'author_name'] },
  ],
  formFields: [
    { name: 'author_name', label: '작성자', kind: 'text', readOnly: true },
    { name: 'question', label: '질문', kind: 'textarea', readOnly: true },
    { name: 'answer', label: '답변', kind: 'textarea', readOnly: true },
    { name: 'created_at', label: '작성일', kind: 'text', readOnly: true },
  ],
  schema: z.object({}).passthrough(),
};
