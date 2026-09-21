// Design Ref: J&J 우승자관리 — 대회(에디션) × 부문 × 역할 × 순위(1~3).
// 역할이 '커플'이면 리더/팔로워를 한 카드에 같이 표기하고, '리더'/'팔로워'면 각각 따로 시상대를 만든다.
// 점수(총점·평균)는 시상대 카드에도 찍힌다(0073). 4위 이하를 포함한 전 라운드 성적표는 J&J 점수관리(jnj_scores, 0074).
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import type { ResourceConfig, FilterDef } from '@/lib/resource/types';
import { StatusBadge } from '@/components/form/StatusBadge';
import type { I18n } from '@123band/shared';
import { trLocale } from '@/i18n/tr';
import { trI18n } from '@/i18n/tr';
import { KIND_OPTS } from './jnj-divisions';

export interface JnjWinnerRow {
  /** 'jnj' | 'battle' | 'div' (0111). 부문의 종류와 같게 둔다. */
  kind: string;
  id: string;
  edition_id: string;
  division: string;
  role: 'leader' | 'follower' | 'couple';
  rank: number;
  /** J&J Dash 참가번호. 전체 결과 표에 그대로 노출된다(0073). */
  entry_no: string | null;
  /** 최종(가중) 총점 · 심사위원 평균 (0073). 비면 화면에서 점수 줄이 사라진다. */
  total_score: number | null;
  avg_score: number | null;
  name: string;
  country: string | null;
  photo_url: string | null;
  partner_name: string | null;
  partner_country: string | null;
  partner_photo_url: string | null;
  note_i18n: I18n;
  is_active: boolean;
  /** 목록 표시용 조인 임베드 — 저장 시엔 제거된다(omitOnWrite). */
  jnj_editions?: { year: number; title_i18n: I18n } | null;
}

// 부문 코드 — 부문관리·우승자·점수·참가자 화면이 모두 이 목록을 공유한다.
// 대회마다 부문 이름은 다르지만(예: 'Bachata J&J OPEN') 코드는 이 넷 중 하나로 모은다.
export const DIVISION_OPTS = [
  { value: 'amateur', label: '아마추어' },
  { value: 'pro', label: '프로' },
  { value: 'salsa', label: '살사' },
  { value: 'open', label: '오픈' },
];

export const ROLE_OPTS = [
  { value: 'couple', label: '커플 (리더+팔로워)' },
  { value: 'leader', label: '리더' },
  { value: 'follower', label: '팔로워' },
];

const label = (opts: { value: string; label: string }[], v: unknown) =>
  opts.find((o) => o.value === String(v))?.label ?? String(v ?? '—');

const columns: ColumnDef<JnjWinnerRow, unknown>[] = [
  {
    accessorKey: 'kind',
    header: '종류',
    cell: (c) => KIND_OPTS.find((o) => o.value === c.getValue())?.label ?? String(c.getValue() ?? '—'),
  },
  {
    accessorKey: 'jnj_editions',
    header: '대회',
    cell: (c) => {
      const e = c.getValue() as JnjWinnerRow['jnj_editions'];
      return e ? `${e.year} · ${trI18n(e.title_i18n)}` : '—';
    },
  },
  { accessorKey: 'division', header: '부문', cell: (c) => label(DIVISION_OPTS, c.getValue()) },
  { accessorKey: 'role', header: '역할', cell: (c) => label(ROLE_OPTS, c.getValue()) },
  // '1위' 는 영어에서 '#1' — 접미사만 바꿔서는 안 된다.
  { accessorKey: 'rank', header: '순위', cell: (c) => (trLocale() === 'en' ? `#${c.getValue()}` : `${c.getValue()}위`) },
  {
    accessorKey: 'name',
    header: '이름',
    cell: (c) => {
      const row = c.row.original;
      return row.role === 'couple' && row.partner_name
        ? `${row.name} · ${row.partner_name}`
        : row.name || '—';
    },
  },
  {
    accessorKey: 'total_score',
    header: '점수',
    cell: (c) => {
      const row = c.row.original;
      const total = row.total_score != null ? Number(row.total_score).toFixed(2) : null;
      const avg = row.avg_score != null ? Number(row.avg_score).toFixed(2) : null;
      if (!total && !avg) return '—';
      return [total, avg ? `avg ${avg}` : null].filter(Boolean).join(' · ');
    },
  },
  {
    accessorKey: 'is_active',
    header: '상태',
    cell: (c) => StatusBadge({ status: c.getValue() ? '노출' : '숨김' }),
  },
];

/**
 * 대회(에디션) 필터 옵션은 DB 에서 와야 해서 화면에서 주입한다.
 * @param editionOptions useJnjEditionOptions() 결과
 */
export function jnjWinnersConfig(
  editionOptions: { value: string; label: string }[] = [],
  /** 부문 옵션 — 표준 코드 + 부문관리에서 직접 만든 코드. 화면에서 주입한다. */
  divisionOptions: { value: string; label: string }[] = DIVISION_OPTS,
): ResourceConfig<JnjWinnerRow> {
  const filters: FilterDef[] = [
    { name: 'kind', label: '종류', kind: 'select', options: KIND_OPTS },
    { name: 'edition_id', label: '대회', kind: 'select', options: editionOptions },
    { name: 'division', label: '부문', kind: 'select', options: divisionOptions },
    { name: 'role', label: '역할', kind: 'select', options: ROLE_OPTS },
    { name: 'q', label: '이름 검색', kind: 'search', searchColumns: ['name', 'partner_name'] },
  ];

  return {
    key: 'jnj_winners',
    table: 'jnj_winners',
    title: '우승자관리',
    canCreate: true,
    selectColumns:
      'kind, id, edition_id, division, role, rank, entry_no, total_score, avg_score, name, country, photo_url, partner_name, partner_country, partner_photo_url, note_i18n, is_active, jnj_editions(year, title_i18n)',
    defaultSort: { column: 'rank', asc: true },
    listColumns: columns,
    filters,
    formFields: [
      { name: 'kind', label: '종류', kind: 'select', options: KIND_OPTS, required: true },
      { name: 'edition_id', label: '대회', kind: 'custom' }, // useJnjEditionOptions 주입
      { name: 'division', label: '부문', kind: 'select', options: divisionOptions, required: true },
      { name: 'role', label: '시상 단위', kind: 'select', options: ROLE_OPTS, required: true },
      // 숫자 입력 — select 는 문자열을 돌려줘서 int 컬럼에 그대로 실리는 걸 피한다(1~3 은 zod 가 막는다).
      { name: 'rank', label: '순위 (1~3)', kind: 'number', required: true },
      { name: 'name', label: '이름 (커플이면 리더)', kind: 'text', required: true },
      { name: 'entry_no', label: '참가번호', kind: 'text', hint: 'J&J Dash 의 참가번호(예: 049). 전체 결과 표에 그대로 보인다.' },
      {
        name: 'total_score',
        label: '총점 (최종 가중)',
        kind: 'number',
        step: 0.01,
        hint: '비워 두면 고객몰에서 점수 줄이 사라진다.',
      },
      { name: 'avg_score', label: '평균 점수', kind: 'number', step: 0.01 },
      { name: 'country', label: '국가', kind: 'custom' }, // CountrySelect
      {
        name: 'photo_url',
        label: '사진',
        kind: 'image',
        bucket: 'band123-jnj',
        hint: '세로 3:4 인물 사진 권장 · JPG·PNG·WebP, 5MB 이하.',
      },
      { name: 'partner_name', label: '팔로워 이름 (시상 단위=커플일 때)', kind: 'text' },
      { name: 'partner_country', label: '팔로워 국가', kind: 'custom' }, // CountrySelect
      {
        name: 'partner_photo_url',
        label: '팔로워 사진',
        kind: 'image',
        bucket: 'band123-jnj',
        hint: '시상 단위가 커플일 때만 쓰인다.',
      },
      { name: 'note_i18n', label: '한 줄 코멘트', kind: 'i18n', bilingual: true },
      { name: 'is_active', label: '노출', kind: 'toggle' },
    ],
    createDefaults: { kind: 'jnj', is_active: true, division: 'pro', role: 'couple', rank: 1 },
    omitOnWrite: ['jnj_editions'],
    schema: z
      .object({
        edition_id: z.string().uuid('대회를 선택하세요'),
        division: z.string().min(1, '필수'),
        role: z.enum(['leader', 'follower', 'couple']),
        rank: z.number().int('정수').min(1, '1~3 만 가능').max(3, '1~3 만 가능'),
        total_score: z.number().min(0, '0 이상').max(9999, '너무 큽니다').nullable(),
        avg_score: z.number().min(0, '0 이상').max(999, '너무 큽니다').nullable(),
        name: z.string().min(1, '필수'),
      })
      .partial()
      .passthrough(),
  };
}
