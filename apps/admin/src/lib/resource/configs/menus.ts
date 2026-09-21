// Design Ref: §5.4 메뉴관리 — 고객몰 상단 네비 메뉴(다국어 라벨 + 경로 + 순서/노출).
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import type { ResourceConfig } from '@/lib/resource/types';
import { StatusBadge } from '@/components/form/StatusBadge';
import type { I18n } from '@123band/shared';
import { trI18n } from '@/i18n/tr';

export interface MenuRow {
  id: string;
  label_i18n: I18n;
  path: string;
  sort_order: number;
  is_active: boolean;
}

const columns: ColumnDef<MenuRow, unknown>[] = [
  { accessorKey: 'label_i18n', header: '메뉴명', cell: (c) => trI18n(c.getValue() as I18n) || '—' },
  { accessorKey: 'path', header: '경로' },
  { accessorKey: 'sort_order', header: '순서' },
  { accessorKey: 'is_active', header: '상태', cell: (c) => StatusBadge({ status: c.getValue() ? '노출' : '숨김' }) },
];

export const menusConfig: ResourceConfig<MenuRow> = {
  key: 'menus',
  table: 'menus',
  title: '메뉴관리',
  canCreate: true,
  selectColumns: 'id, label_i18n, path, sort_order, is_active',
  defaultSort: { column: 'sort_order', asc: true },
  listColumns: columns,
  filters: [],
  formFields: [
    { name: 'label_i18n', label: '메뉴명', kind: 'i18n', required: true },
    { name: 'path', label: '경로', kind: 'text', required: true, placeholder: "/ = 홈, /events, /shop?type=ticket, http…(외부)" },
    { name: 'sort_order', label: '노출순서', kind: 'number' },
    { name: 'is_active', label: '노출', kind: 'toggle' },
  ],
  createDefaults: { path: '/', is_active: true },
  schema: z
    .object({ sort_order: z.number().int('정수').optional() })
    .passthrough(),
};
