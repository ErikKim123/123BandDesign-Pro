// Design Ref: §5.4 메인화면관리 — 메인 배너(히어로 슬라이드) 관리.
// banners 테이블을 position='hero' 로 스코프. 홈 히어로 캐러셀(최대 5개, 5초 자동)에서 소비.
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import type { ResourceConfig } from '@/lib/resource/types';
import { StatusBadge } from '@/components/form/StatusBadge';
import { Thumb } from '@/components/form/Thumb';
import type { I18n } from '@123band/shared';
import { trI18n } from '@/i18n/tr';
import type { BannerRow } from './banners';

const columns: ColumnDef<BannerRow, unknown>[] = [
  { accessorKey: 'image_url', header: '이미지', enableSorting: false, cell: (c) => Thumb({ url: (c.getValue() as string | null) ?? null }) },
  { accessorKey: 'title_i18n', header: '제목', cell: (c) => trI18n(c.getValue() as I18n) || '—' },
  { accessorKey: 'sort_order', header: '순서' },
  { accessorKey: 'end_at', header: '종료일', cell: (c) => String(c.getValue() ?? '—').slice(0, 10) },
  { accessorKey: 'is_active', header: '상태', cell: (c) => StatusBadge({ status: c.getValue() ? '노출' : '숨김' }) },
];

// banners 를 히어로 슬라이드로만 쓰는 전용 config (위치 필드는 숨기고 hero 고정)
export const heroBannersConfig: ResourceConfig<BannerRow> = {
  key: 'hero_banners',
  table: 'banners',
  title: '메인 배너 (히어로 슬라이드)',
  canCreate: true,
  selectColumns: 'id, position, title_i18n, subtitle_i18n, image_url, image_credit, link_url, sort_order, start_at, end_at, is_active',
  baseFilter: { column: 'position', op: 'eq', value: 'hero' },
  createDefaults: { position: 'hero', is_active: true },
  defaultSort: { column: 'sort_order', asc: true },
  listColumns: columns,
  filters: [],
  formFields: [
    { name: 'title_i18n', label: '제목', kind: 'i18n', required: true },
    {
      name: 'image_url',
      label: '이미지',
      kind: 'image',
      bucket: 'band123-banners',
      preview: 'wide',
      hint: '와이드 이미지(1600×620 권장) · JPG·PNG·WebP, 5MB 이하.',
    },
    {
      name: 'image_credit',
      label: '이미지 제공',
      kind: 'text',
      placeholder: '© 촬영자 / 제공처',
      hint: '슬라이드 우측 하단에 작게 표시됩니다. 비우면 표시하지 않습니다.',
    },
    { name: 'link_url', label: '링크 URL', kind: 'text', placeholder: '/ko/events 또는 https://…' },
    { name: 'sort_order', label: '노출순서', kind: 'number' },
    { name: 'start_at', label: '노출 시작일', kind: 'date' },
    { name: 'end_at', label: '노출 종료일', kind: 'date' },
    { name: 'subtitle_i18n', label: '설명 (링크 없을 때 슬라이드에 표시)', kind: 'i18n-multiline' },
    { name: 'is_active', label: '노출', kind: 'toggle' },
  ],
  schema: z
    .object({ sort_order: z.number().int('정수').optional() })
    .passthrough(),
};
