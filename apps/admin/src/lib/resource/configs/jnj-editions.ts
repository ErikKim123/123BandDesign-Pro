// Design Ref: J&J 대회관리 — 연도/행사별 잭앤질 대회(에디션). 고객몰 /jnj 가 이 데이터를 읽는다.
// FORMAT·Guidelines 는 HTML 또는 그냥 줄바꿈 텍스트 어느 쪽으로 붙여넣어도 고객몰에서 서식이 살아난다.
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import type { ResourceConfig } from '@/lib/resource/types';
import { StatusBadge } from '@/components/form/StatusBadge';
import type { I18n } from '@123band/shared';
import { trI18n } from '@/i18n/tr';

export interface JnjEditionRow {
  id: string;
  slug: string;
  year: number;
  event_product_id: string | null;
  title_i18n: I18n;
  subtitle_i18n: I18n;
  location_i18n: I18n;
  held_at: string | null;
  cover_url: string | null;
  video_urls: string[] | null;
  format_i18n: I18n;
  guidelines_i18n: I18n;
  sort_order: number;
  is_active: boolean;
  /** 후기 받기(0098) — 끄면 이 대회 모든 부문의 후기 섹션이 사라진다. */
  reviews_enabled: boolean;
}

const columns: ColumnDef<JnjEditionRow, unknown>[] = [
  { accessorKey: 'year', header: '연도' },
  { accessorKey: 'title_i18n', header: '대회명', cell: (c) => trI18n(c.getValue() as I18n) || '—' },
  { accessorKey: 'slug', header: 'URL 슬러그' },
  { accessorKey: 'held_at', header: '개최일', cell: (c) => String(c.getValue() ?? '—') },
  { accessorKey: 'sort_order', header: '순서' },
  {
    accessorKey: 'is_active',
    header: '상태',
    cell: (c) => StatusBadge({ status: c.getValue() ? '노출' : '숨김' }),
  },
];

export const jnjEditionsConfig: ResourceConfig<JnjEditionRow> = {
  key: 'jnj_editions',
  table: 'jnj_editions',
  title: 'J&J 대회관리',
  canCreate: true,
  selectColumns:
    'id, slug, year, event_product_id, title_i18n, subtitle_i18n, location_i18n, held_at, cover_url, video_urls, format_i18n, guidelines_i18n, sort_order, is_active, reviews_enabled',
  defaultSort: { column: 'year', asc: false },
  listColumns: columns,
  filters: [
    {
      name: 'q',
      label: '대회명·슬러그 검색',
      kind: 'search',
      searchColumns: ['slug', 'title_i18n->>ko', 'title_i18n->>en'],
    },
  ],
  formFields: [
    { name: 'year', label: '연도', kind: 'number', required: true },
    {
      name: 'slug',
      label: 'URL 슬러그',
      kind: 'text',
      required: true,
      placeholder: 'jlcl-2026 — 고객몰 주소 /jnj/jlcl-2026 이 된다',
    },
    { name: 'title_i18n', label: '대회명', kind: 'i18n', required: true, bilingual: true },
    { name: 'subtitle_i18n', label: '한 줄 소개', kind: 'i18n', bilingual: true },
    { name: 'location_i18n', label: '장소', kind: 'i18n', bilingual: true },
    { name: 'held_at', label: '개최일(표시용)', kind: 'text', placeholder: '2026.06.23 – 06.26' },
    { name: 'event_product_id', label: '연결 행사', kind: 'custom' }, // useEventProductOptions 주입
    {
      name: 'cover_url',
      label: '커버 이미지',
      kind: 'image',
      bucket: 'band123-jnj',
      preview: 'wide',
      hint: '대회 개요 카드에 쓰인다 · JPG·PNG·WebP, 5MB 이하.',
    },
    {
      name: 'video_urls',
      label: '영상 링크',
      kind: 'links',
      maxItems: 20,
      placeholder: 'https://youtu.be/… · https://vimeo.com/… · mp4 주소',
      hint: '최대 20개 · 고객몰 대회 화면의 "영상 보기" 버튼을 눌렀을 때 팝업으로 재생된다. 유튜브·비메오·mp4 주소를 지원한다.',
    },
    {
      name: 'format_i18n',
      label: 'FORMAT (대회 방식)',
      kind: 'i18n-multiline',
      bilingual: true,
      placeholder:
        '그냥 줄바꿈으로 써도 되고 HTML 도 됩니다. "## 소제목", "- 항목", "1. 항목", "**굵게**" 표기를 인식합니다.',
    },
    {
      name: 'guidelines_i18n',
      label: 'GUIDELINES (참가 규정)',
      kind: 'i18n-multiline',
      bilingual: true,
      placeholder: 'FORMAT 과 동일한 표기 규칙을 씁니다.',
    },
    { name: 'sort_order', label: '같은 해 안에서의 순서', kind: 'number' },
    // 끄면 이 대회 전체(모든 부문)의 후기 섹션이 사라진다. 부문 하나만 끄려면 부문관리에서.
    { name: 'reviews_enabled', label: '후기 받기 (대회 전체)', kind: 'toggle' },
    { name: 'is_active', label: '노출', kind: 'toggle' },
  ],
  createDefaults: {
    is_active: true,
    reviews_enabled: true,
    sort_order: 0,
    year: new Date().getFullYear(),
  },
  // 영문만 채웠을 때 KO 를 자동 번역으로 메운다(대회명은 고유명사라 제외).
  autoTranslate: ['format_i18n', 'guidelines_i18n'],
  schema: z
    .object({
      year: z.number().int('정수').min(2000, '연도를 확인하세요').max(2100, '연도를 확인하세요'),
      slug: z
        .string()
        .min(1, '필수')
        .regex(/^[a-z0-9-]+$/, '영문 소문자·숫자·하이픈만 쓸 수 있습니다'),
      sort_order: z.number().int('정수').optional(),
      video_urls: z.array(z.string()).max(20, '영상 링크는 최대 20개까지 넣을 수 있습니다').optional(),
    })
    .partial()
    .passthrough(),
};
