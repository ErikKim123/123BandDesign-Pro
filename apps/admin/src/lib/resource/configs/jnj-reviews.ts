// Design Ref: J&J 대회 후기(jnj_reviews, 0098) 모더레이션 — 조회 + 삭제(부적절 후기 정리).
// 후기 켜기/끄기는 J&J 대회관리 · 부문관리의 '후기 받기' 스위치에서 한다.
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import type { I18n } from '@123band/shared';
import { trI18n } from '@/i18n/tr';
import type { FilterDef, ResourceConfig } from '@/lib/resource/types';
import { divisionCodeLabel } from './jnj-divisions';

export interface JnjReviewRow {
  id: string;
  edition_id: string;
  division: string;
  author_id: string | null;
  author_name: string | null;
  rating: number;
  content: string | null;
  created_at: string;
  /** 목록 표시용 조인 임베드 */
  jnj_editions?: { year: number; title_i18n: I18n } | null;
}

const RATING_OPTS = [
  { value: '5', label: '★★★★★' },
  { value: '4', label: '★★★★' },
  { value: '3', label: '★★★' },
  { value: '2', label: '★★' },
  { value: '1', label: '★' },
];

const stars = (n: number) => {
  const v = Math.max(0, Math.min(5, n));
  return '★'.repeat(v) + '☆'.repeat(5 - v);
};

const columns: ColumnDef<JnjReviewRow, unknown>[] = [
  {
    accessorKey: 'jnj_editions',
    header: '대회',
    cell: (c) => {
      const e = c.getValue() as JnjReviewRow['jnj_editions'];
      return e ? `${e.year} · ${trI18n(e.title_i18n)}` : '—';
    },
  },
  {
    accessorKey: 'division',
    header: '부문',
    cell: (c) => {
      const code = String(c.getValue() ?? '');
      return code ? divisionCodeLabel(code) : '대회 공통';
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

/** @param editionOptions useJnjEditionOptions() 결과 — 대회 필터용. */
export function jnjReviewsConfig(
  editionOptions: { value: string; label: string }[] = [],
): ResourceConfig<JnjReviewRow> {
  const filters: FilterDef[] = [
    { name: 'edition_id', label: '대회', kind: 'select', options: editionOptions },
    { name: 'rating', label: '별점', kind: 'select', options: RATING_OPTS },
    { name: 'q', label: '내용/작성자 검색', kind: 'search', searchColumns: ['content', 'author_name'] },
  ];
  return {
    key: 'jnj_reviews',
    table: 'jnj_reviews',
    title: 'J&J 대회 후기',
    canCreate: false, // 모더레이션 전용 — 조회/삭제만
    selectColumns:
      'id, edition_id, division, author_id, author_name, rating, content, created_at, jnj_editions(year, title_i18n)',
    defaultSort: { column: 'created_at', asc: false },
    listColumns: columns,
    filters,
    formFields: [
      { name: 'author_name', label: '작성자', kind: 'text', readOnly: true },
      { name: 'division', label: '부문 코드 (비어 있으면 대회 공통)', kind: 'text', readOnly: true },
      { name: 'rating', label: '별점', kind: 'number', readOnly: true },
      { name: 'content', label: '내용', kind: 'textarea', readOnly: true },
      { name: 'created_at', label: '작성일', kind: 'text', readOnly: true },
    ],
    omitOnWrite: ['jnj_editions'],
    schema: z.object({}).passthrough(),
  };
}
