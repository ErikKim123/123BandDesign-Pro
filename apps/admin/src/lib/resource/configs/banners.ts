// Design Ref: §5.4 배너관리 — banners. i18n 제목 + 이미지/링크 + 노출기간/순서/활성.
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import type { ResourceConfig } from '@/lib/resource/types';
import { StatusBadge } from '@/components/form/StatusBadge';
import type { I18n } from '@123band/shared';
import { trI18n } from '@/i18n/tr';

export interface BannerRow {
  id: string;
  position: string | null;
  title_i18n: I18n;
  subtitle_i18n?: I18n;
  image_url: string | null;
  image_credit?: string | null;
  link_url: string | null;
  sort_order: number;
  start_at: string | null;
  end_at: string | null;
  is_active: boolean;
}

const POSITION_OPTS = [
  { value: 'hero', label: '메인 히어로' },
  { value: 'top', label: '상단' },
  { value: 'middle', label: '중단' },
  { value: 'sidebar', label: '사이드' },
];

const columns: ColumnDef<BannerRow, unknown>[] = [
  { accessorKey: 'title_i18n', header: '제목', cell: (c) => trI18n(c.getValue() as I18n) || '—' },
  { accessorKey: 'position', header: '위치', cell: (c) => POSITION_OPTS.find((o) => o.value === c.getValue())?.label ?? (c.getValue() ?? '—') },
  { accessorKey: 'sort_order', header: '순서' },
  { accessorKey: 'end_at', header: '종료일', cell: (c) => String(c.getValue() ?? '—').slice(0, 10) },
  { accessorKey: 'is_active', header: '상태', cell: (c) => StatusBadge({ status: c.getValue() ? '노출' : '숨김' }) },
];

export const bannersConfig: ResourceConfig<BannerRow> = {
  key: 'banners',
  table: 'banners',
  title: '배너관리',
  canCreate: true,
  selectColumns: 'id, position, title_i18n, image_url, link_url, sort_order, start_at, end_at, is_active',
  defaultSort: { column: 'sort_order', asc: true },
  listColumns: columns,
  filters: [
    { name: 'position', label: '위치', kind: 'select', options: POSITION_OPTS },
  ],
  formFields: [
    { name: 'title_i18n', label: '제목', kind: 'i18n', required: true },
    { name: 'position', label: '위치', kind: 'select', options: POSITION_OPTS, required: true },
    {
      name: 'image_url',
      label: '이미지',
      kind: 'image',
      bucket: 'band123-banners',
      preview: 'wide',
      hint: '가로로 긴 이미지 권장 · JPG·PNG·WebP, 5MB 이하.',
    },
    { name: 'link_url', label: '링크 URL', kind: 'text', placeholder: 'https://…' },
    { name: 'sort_order', label: '노출순서', kind: 'number' },
    { name: 'start_at', label: '노출 시작일', kind: 'date' },
    { name: 'end_at', label: '노출 종료일', kind: 'date' },
    { name: 'is_active', label: '노출', kind: 'toggle' },
  ],
  schema: z
    .object({
      position: z.enum(['hero', 'top', 'middle', 'sidebar']).optional(),
      sort_order: z.number().int('정수').optional(),
    })
    .passthrough(),
};
