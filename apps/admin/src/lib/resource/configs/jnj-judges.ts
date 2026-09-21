// Design Ref: J&J 심사위원관리 — 대회 × (부문 또는 전 부문 공통).
// 고객몰 /jnj 의 각 부문 탭 안 '심사위원' 섹션에 사진 카드로 나온다.
// 부문을 비우면 그 대회의 모든 부문 탭에 공통으로 노출된다(총괄 심사위원장 등).
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import type { ResourceConfig, FilterDef } from '@/lib/resource/types';
import { StatusBadge } from '@/components/form/StatusBadge';
import type { I18n } from '@123band/shared';
import { trI18n } from '@/i18n/tr';
import { KIND_OPTS } from './jnj-divisions';

export interface JnjJudgeRow {
  id: string;
  edition_id: string;
  division_id: string | null;
  /** 'jnj' | 'battle' | 'div' (0110). 부문을 지정했으면 그 부문의 종류와 같게 둔다. */
  kind: string;
  name: string;
  title_i18n: I18n;
  country: string | null;
  photo_url: string | null;
  bio_i18n: I18n;
  instagram: string | null;
  sort_order: number;
  is_active: boolean;
  /** 목록 표시용 조인 임베드 — 저장 시엔 제거된다(omitOnWrite). */
  jnj_editions?: { year: number; title_i18n: I18n } | null;
  jnj_divisions?: { title_i18n: I18n } | null;
}

const columns: ColumnDef<JnjJudgeRow, unknown>[] = [
  {
    accessorKey: 'kind',
    header: '종류',
    cell: (c) => KIND_OPTS.find((o) => o.value === c.getValue())?.label ?? String(c.getValue() ?? '—'),
  },
  {
    accessorKey: 'jnj_editions',
    header: '대회',
    cell: (c) => {
      const e = c.getValue() as JnjJudgeRow['jnj_editions'];
      return e ? `${e.year} · ${trI18n(e.title_i18n)}` : '—';
    },
  },
  {
    accessorKey: 'jnj_divisions',
    header: '부문',
    cell: (c) => {
      const d = c.getValue() as JnjJudgeRow['jnj_divisions'];
      return d ? trI18n(d.title_i18n) : '전 부문 공통';
    },
  },
  { accessorKey: 'name', header: '이름', cell: (c) => String(c.getValue() || '—') },
  { accessorKey: 'title_i18n', header: '직함', cell: (c) => trI18n(c.getValue() as I18n) || '—' },
  { accessorKey: 'sort_order', header: '순서' },
  {
    accessorKey: 'is_active',
    header: '상태',
    cell: (c) => StatusBadge({ status: c.getValue() ? '노출' : '숨김' }),
  },
];

/**
 * @param editionOptions useJnjEditionOptions() 결과
 * @param divisionOptions useJnjDivisionOptions() 결과 (필터용 — 폼에서는 대회로 좁혀 렌더한다)
 */
export function jnjJudgesConfig(
  editionOptions: { value: string; label: string }[] = [],
  divisionOptions: { value: string; label: string }[] = [],
): ResourceConfig<JnjJudgeRow> {
  const filters: FilterDef[] = [
    { name: 'kind', label: '종류', kind: 'select', options: KIND_OPTS },
    { name: 'edition_id', label: '대회', kind: 'select', options: editionOptions },
    { name: 'division_id', label: '부문', kind: 'select', options: divisionOptions },
    { name: 'q', label: '이름 검색', kind: 'search', searchColumns: ['name'] },
  ];

  return {
    key: 'jnj_judges',
    table: 'jnj_judges',
    title: '심사위원관리',
    canCreate: true,
    selectColumns:
      'id, edition_id, division_id, kind, name, title_i18n, country, photo_url, bio_i18n, instagram, sort_order, is_active, jnj_editions(year, title_i18n), jnj_divisions(title_i18n)',
    defaultSort: { column: 'sort_order', asc: true },
    listColumns: columns,
    filters,
    formFields: [
      // 부문을 고르면 그 부문의 종류를 따라간다(페이지에서 맞춰 준다). '전 부문 공통' 이면 이 값이 붙을 형식을 정한다.
      { name: 'kind', label: '종류', kind: 'custom', required: true }, // 바꾸면 부문 선택을 비운다
      { name: 'edition_id', label: '대회', kind: 'custom' }, // useJnjEditionOptions 주입
      { name: 'division_id', label: '부문', kind: 'custom' }, // 선택한 대회의 부문만 주입
      { name: 'name', label: '이름', kind: 'text', required: true },
      {
        name: 'title_i18n',
        label: '직함',
        kind: 'i18n',
        bilingual: true,
        placeholder: 'Head Judge / 심사위원장',
      },
      { name: 'country', label: '국가', kind: 'custom' }, // CountrySelect
      {
        name: 'photo_url',
        label: '사진',
        kind: 'image',
        bucket: 'band123-jnj',
        hint: '배경 지운 인물 컷아웃, 세로 4:5 · 인물을 아래 끝에 붙이고 머리 위 여백은 최소로 · JPG·PNG·WebP, 5MB 이하.',
      },
      { name: 'bio_i18n', label: '한두 줄 소개', kind: 'i18n-multiline', bilingual: true },
      {
        name: 'instagram',
        label: '인스타그램',
        kind: 'text',
        placeholder: '@handle 또는 https://instagram.com/handle',
      },
      { name: 'sort_order', label: '표시 순서 (작을수록 앞)', kind: 'number' },
      { name: 'is_active', label: '노출', kind: 'toggle' },
    ],
    createDefaults: { kind: 'jnj', is_active: true, sort_order: 0 },
    omitOnWrite: ['jnj_editions', 'jnj_divisions'],
    // 이름·직함은 고유명사/짧은 표기라 제외 — 소개글만 EN→KO 자동 번역.
    autoTranslate: ['bio_i18n'],
    schema: z
      .object({
        edition_id: z.string().uuid('대회를 선택하세요'),
        name: z.string().min(1, '필수'),
        sort_order: z.number().int('정수').optional(),
      })
      .partial()
      .passthrough(),
  };
}
