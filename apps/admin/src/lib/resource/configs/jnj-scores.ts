// Design Ref: J&J 점수관리 — 대회(에디션) × 부문 × 라운드(예선·본선·결승) × 역할 × 참가자.
// 고객몰 /jnj 의 '전체 결과' 섹션이 이 표를 그대로 읽는다(0074).
// 라운드마다 점수 체계가 다르다: 예선·본선 = 심사위원 O표 + 통과 여부, 결승 = 순위 + 총점 + 평균.
// 시상대(1~3위) 카드는 별도 화면(J&J 우승자관리 · jnj_winners)이 맡는다.
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import type { ResourceConfig, FilterDef } from '@/lib/resource/types';
import { StatusBadge } from '@/components/form/StatusBadge';
import type { I18n } from '@123band/shared';
import { trI18n, tr } from '@/i18n/tr';
import { KIND_OPTS } from './jnj-divisions';
import { fmt } from '@/i18n/dict';
import { DIVISION_OPTS } from './jnj-winners';

export interface JnjScoreRow {
  /** 'jnj' | 'battle' | 'div' (0111). 부문의 종류와 같게 둔다. */
  kind: string;
  id: string;
  edition_id: string;
  division: string;
  round: 'prelim' | 'semi' | 'final';
  role: 'leader' | 'follower';
  entry_no: string;
  name: string;
  country: string | null;
  /** 참가자 사진(0075). 전체 결과 표의 썸네일. */
  photo_url: string | null;
  /** 예선·본선 — 심사위원 O표 수와 통과 여부. */
  votes: number | null;
  passed: boolean | null;
  /** 결승 — 순위·최종(가중) 총점·평균. */
  rank: number | null;
  total_score: number | null;
  avg_score: number | null;
  sort_order: number;
  is_active: boolean;
  /** 목록 표시용 조인 임베드 — 저장 시엔 제거된다(omitOnWrite). */
  jnj_editions?: { year: number; title_i18n: I18n } | null;
}

export const ROUND_OPTS = [
  { value: 'prelim', label: '예선' },
  { value: 'semi', label: '본선' },
  { value: 'final', label: '결승' },
];

export const SCORE_ROLE_OPTS = [
  { value: 'leader', label: '리더' },
  { value: 'follower', label: '팔로워' },
];

const label = (opts: { value: string; label: string }[], v: unknown) =>
  opts.find((o) => o.value === String(v))?.label ?? String(v ?? '—');

const num = (v: unknown, digits = 2) => (v == null ? null : Number(v).toFixed(digits));

const columns: ColumnDef<JnjScoreRow, unknown>[] = [
  {
    accessorKey: 'kind',
    header: '종류',
    cell: (c) => KIND_OPTS.find((o) => o.value === c.getValue())?.label ?? String(c.getValue() ?? '—'),
  },
  {
    accessorKey: 'jnj_editions',
    header: '대회',
    cell: (c) => {
      const e = c.getValue() as JnjScoreRow['jnj_editions'];
      return e ? `${e.year} · ${trI18n(e.title_i18n)}` : '—';
    },
  },
  { accessorKey: 'division', header: '부문', cell: (c) => label(DIVISION_OPTS, c.getValue()) },
  { accessorKey: 'round', header: '라운드', cell: (c) => tr(label(ROUND_OPTS, c.getValue())) },
  { accessorKey: 'role', header: '역할', cell: (c) => tr(label(SCORE_ROLE_OPTS, c.getValue())) },
  { accessorKey: 'entry_no', header: '번호', cell: (c) => (c.getValue() as string) || '—' },
  { accessorKey: 'name', header: '이름', cell: (c) => (c.getValue() as string) || '—' },
  {
    // 라운드에 따라 의미가 달라 한 칸에 접는다 — 예선·본선은 'O 5 · 통과', 결승은 '1위'.
    id: 'result',
    header: '결과',
    cell: (c) => {
      const r = c.row.original;
      if (r.round === 'final') return r.rank != null ? fmt(tr('{n}위'), { n: r.rank }) : '—';
      const parts = [
        r.votes != null ? `O ${r.votes}` : null,
        r.passed == null ? null : tr(r.passed ? '통과' : '탈락'),
      ].filter(Boolean);
      return parts.length ? parts.join(' · ') : '—';
    },
  },
  {
    accessorKey: 'total_score',
    header: '점수',
    cell: (c) => {
      const r = c.row.original;
      const total = num(r.total_score);
      const avg = num(r.avg_score);
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
export function jnjScoresConfig(
  editionOptions: { value: string; label: string }[] = [],
  /** 부문 옵션 — 표준 코드 + 부문관리에서 직접 만든 코드. 화면에서 주입한다. */
  divisionOptions: { value: string; label: string }[] = DIVISION_OPTS,
): ResourceConfig<JnjScoreRow> {
  const filters: FilterDef[] = [
    { name: 'kind', label: '종류', kind: 'select', options: KIND_OPTS },
    { name: 'edition_id', label: '대회', kind: 'select', options: editionOptions },
    { name: 'division', label: '부문', kind: 'select', options: divisionOptions },
    { name: 'round', label: '라운드', kind: 'select', options: ROUND_OPTS },
    { name: 'role', label: '역할', kind: 'select', options: SCORE_ROLE_OPTS },
    { name: 'q', label: '이름 검색', kind: 'search', searchColumns: ['name', 'entry_no'] },
  ];

  return {
    key: 'jnj_scores',
    table: 'jnj_scores',
    title: '점수관리',
    canCreate: true,
    selectColumns:
      'kind, id, edition_id, division, round, role, entry_no, name, country, photo_url, votes, passed, rank, total_score, avg_score, sort_order, is_active, jnj_editions(year, title_i18n)',
    // 가져올 때 라운드·역할별로 매긴 순서 — 표에 보이는 순서와 같게 한다.
    defaultSort: { column: 'sort_order', asc: true },
    listColumns: columns,
    filters,
    formFields: [
      { name: 'kind', label: '종류', kind: 'select', options: KIND_OPTS, required: true },
      { name: 'edition_id', label: '대회', kind: 'custom' }, // useJnjEditionOptions 주입
      { name: 'division', label: '부문', kind: 'select', options: divisionOptions, required: true },
      { name: 'round', label: '라운드', kind: 'select', options: ROUND_OPTS, required: true },
      { name: 'role', label: '역할', kind: 'select', options: SCORE_ROLE_OPTS, required: true },
      { name: 'entry_no', label: '참가번호', kind: 'text' },
      { name: 'name', label: '이름', kind: 'text', required: true },
      { name: 'country', label: '국가', kind: 'custom' }, // CountrySelect
      {
        name: 'photo_url',
        label: '사진',
        kind: 'image',
        bucket: 'band123-jnj',
        hint: '전체 결과 표에 동그란 썸네일로 나온다. 비우면 이름 첫 글자가 대신 들어간다.',
      },
      { name: 'votes', label: 'O표 (예선·본선)', kind: 'number', hint: '심사위원이 준 O 표 수. 결승 행에서는 비워 둔다.' },
      { name: 'passed', label: '통과 (예선·본선)', kind: 'toggle' },
      { name: 'rank', label: '순위 (결승)', kind: 'number' },
      { name: 'total_score', label: '총점 (결승·최종 가중)', kind: 'number', step: 0.01 },
      { name: 'avg_score', label: '평균 점수 (결승)', kind: 'number', step: 0.01 },
      { name: 'sort_order', label: '정렬 순서', kind: 'number', hint: '작을수록 표 위에 온다. 가져오기가 순위·O표 순으로 자동으로 매긴다.' },
      { name: 'is_active', label: '노출', kind: 'toggle' },
    ],
    createDefaults: { kind: 'jnj', is_active: true, division: 'pro', round: 'final', role: 'leader', sort_order: 0 },
    omitOnWrite: ['jnj_editions'],
    schema: z
      .object({
        edition_id: z.string().uuid('대회를 선택하세요'),
        division: z.string().min(1, '필수'),
        round: z.enum(['prelim', 'semi', 'final']),
        role: z.enum(['leader', 'follower']),
        name: z.string().min(1, '필수'),
        votes: z.number().int('정수').min(0, '0 이상').max(999, '너무 큽니다').nullable(),
        rank: z.number().int('정수').min(1, '1 이상').max(999, '너무 큽니다').nullable(),
        total_score: z.number().min(0, '0 이상').max(9999, '너무 큽니다').nullable(),
        avg_score: z.number().min(0, '0 이상').max(999, '너무 큽니다').nullable(),
      })
      .partial()
      .passthrough(),
  };
}
