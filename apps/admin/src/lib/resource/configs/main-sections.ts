// Design Ref: §5.4 메인화면관리 — main_sections. 메인 섹션(히어로/슬라이더/추천/카테고리띠) 구성.
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import type { ResourceConfig } from '@/lib/resource/types';
import { StatusBadge } from '@/components/form/StatusBadge';

export interface MainSectionRow {
  id: string;
  section_type: string | null;
  config: Record<string, unknown>;
  sort_order: number;
  is_active: boolean;
}

const TYPE_OPTS = [
  { value: 'hero', label: '히어로' },
  { value: 'slider', label: '슬라이더' },
  { value: 'featured', label: '추천상품' },
  { value: 'category_strip', label: '카테고리띠' },
  { value: 'organizer_cta', label: '오거나이저 CTA' },
];

const columns: ColumnDef<MainSectionRow, unknown>[] = [
  { accessorKey: 'section_type', header: '섹션', cell: (c) => TYPE_OPTS.find((o) => o.value === c.getValue())?.label ?? '—' },
  { accessorKey: 'sort_order', header: '순서' },
  { accessorKey: 'is_active', header: '상태', cell: (c) => StatusBadge({ status: c.getValue() ? '노출' : '숨김' }) },
];

export const mainSectionsConfig: ResourceConfig<MainSectionRow> = {
  key: 'main_sections',
  table: 'main_sections',
  title: '메인화면관리',
  canCreate: true,
  selectColumns: 'id, section_type, config, sort_order, is_active',
  defaultSort: { column: 'sort_order', asc: true },
  listColumns: columns,
  filters: [
    { name: 'section_type', label: '섹션', kind: 'select', options: TYPE_OPTS },
  ],
  formFields: [
    { name: 'section_type', label: '섹션 유형', kind: 'select', options: TYPE_OPTS, required: true },
    { name: 'config', label: '설정(JSON)', kind: 'json', placeholder: '{"title":"신상품","product_ids":[]}' },
    { name: 'sort_order', label: '노출순서', kind: 'number' },
    { name: 'is_active', label: '노출', kind: 'toggle' },
  ],
  schema: z
    .object({
      section_type: z.enum(['hero', 'slider', 'featured', 'category_strip', 'organizer_cta']).optional(),
      sort_order: z.number().int('정수').optional(),
    })
    .passthrough(),
};
