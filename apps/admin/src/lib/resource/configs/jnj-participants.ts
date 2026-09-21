// Design Ref: J&J 참가자관리 — 대회(에디션) × 부문 × 역할 × 참가자.
// 고객몰 /jnj 의 '전체 참여자' 카드 그리드가 이 표를 읽는다(0076).
// 성적(점수관리)과 달리 순위·점수가 없다. 예선에서 떨어진 사람도 그대로 남는 '누가 나왔나' 명단.
// 연락처·이메일은 담지 않는다 — 공개 화면에 필요한 값만 둔다.
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import type { ResourceConfig, FilterDef } from '@/lib/resource/types';
import { StatusBadge } from '@/components/form/StatusBadge';
import type { I18n } from '@123band/shared';
import { trI18n, tr } from '@/i18n/tr';
import { KIND_OPTS } from './jnj-divisions';
import { DIVISION_OPTS } from './jnj-winners';
import { SCORE_ROLE_OPTS } from './jnj-scores';

export interface JnjParticipantRow {
  /** 'jnj' | 'battle' | 'div' (0111). 부문의 종류와 같게 둔다. */
  kind: string;
  id: string;
  edition_id: string;
  division: string;
  role: 'leader' | 'follower';
  entry_no: string;
  name: string;
  country: string | null;
  photo_url: string | null;
  instagram: string | null;
  sort_order: number;
  is_active: boolean;
  /** 목록 표시용 조인 임베드 — 저장 시엔 제거된다(omitOnWrite). */
  jnj_editions?: { year: number; title_i18n: I18n } | null;
}

const label = (opts: { value: string; label: string }[], v: unknown) =>
  opts.find((o) => o.value === String(v))?.label ?? String(v ?? '—');

const columns: ColumnDef<JnjParticipantRow, unknown>[] = [
  {
    accessorKey: 'kind',
    header: '종류',
    cell: (c) => KIND_OPTS.find((o) => o.value === c.getValue())?.label ?? String(c.getValue() ?? '—'),
  },
  {
    accessorKey: 'jnj_editions',
    header: '대회',
    cell: (c) => {
      const e = c.getValue() as JnjParticipantRow['jnj_editions'];
      return e ? `${e.year} · ${trI18n(e.title_i18n)}` : '—';
    },
  },
  { accessorKey: 'division', header: '부문', cell: (c) => label(DIVISION_OPTS, c.getValue()) },
  { accessorKey: 'role', header: '역할', cell: (c) => tr(label(SCORE_ROLE_OPTS, c.getValue())) },
  { accessorKey: 'entry_no', header: '번호', cell: (c) => (c.getValue() as string) || '—' },
  { accessorKey: 'name', header: '이름', cell: (c) => (c.getValue() as string) || '—' },
  { accessorKey: 'country', header: '국가', cell: (c) => (c.getValue() as string) || '—' },
  { accessorKey: 'instagram', header: 'SNS', cell: (c) => (c.getValue() as string) || '—' },
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
export function jnjParticipantsConfig(
  editionOptions: { value: string; label: string }[] = [],
  /** 부문 옵션 — 표준 코드 + 부문관리에서 직접 만든 코드. 화면에서 주입한다. */
  divisionOptions: { value: string; label: string }[] = DIVISION_OPTS,
): ResourceConfig<JnjParticipantRow> {
  const filters: FilterDef[] = [
    { name: 'kind', label: '종류', kind: 'select', options: KIND_OPTS },
    { name: 'edition_id', label: '대회', kind: 'select', options: editionOptions },
    { name: 'division', label: '부문', kind: 'select', options: divisionOptions },
    { name: 'role', label: '역할', kind: 'select', options: SCORE_ROLE_OPTS },
    { name: 'q', label: '이름 검색', kind: 'search', searchColumns: ['name', 'entry_no'] },
  ];

  return {
    key: 'jnj_participants',
    table: 'jnj_participants',
    title: '참가자관리',
    canCreate: true,
    selectColumns:
      'kind, id, edition_id, division, role, entry_no, name, country, photo_url, instagram, sort_order, is_active, jnj_editions(year, title_i18n)',
    defaultSort: { column: 'sort_order', asc: true },
    listColumns: columns,
    filters,
    formFields: [
      { name: 'kind', label: '종류', kind: 'select', options: KIND_OPTS, required: true },
      { name: 'edition_id', label: '대회', kind: 'custom' }, // useJnjEditionOptions 주입
      { name: 'division', label: '부문', kind: 'select', options: divisionOptions, required: true },
      { name: 'role', label: '역할', kind: 'select', options: SCORE_ROLE_OPTS, required: true },
      { name: 'entry_no', label: '참가번호', kind: 'text' },
      { name: 'name', label: '이름', kind: 'text', required: true },
      { name: 'country', label: '국가', kind: 'custom' }, // CountrySelect
      {
        name: 'photo_url',
        label: '사진',
        kind: 'image',
        bucket: 'band123-jnj',
        hint: '세로 3:4 인물 사진 권장. 비우면 이름 첫 글자가 대신 들어간다.',
      },
      {
        name: 'instagram',
        label: '인스타그램',
        kind: 'text',
        hint: "핸들('@name') 또는 주소. 비우면 카드에 링크가 안 붙는다.",
      },
      { name: 'sort_order', label: '정렬 순서', kind: 'number', hint: '작을수록 앞에 온다. 가져오기가 참가번호 순으로 매긴다.' },
      { name: 'is_active', label: '노출', kind: 'toggle' },
    ],
    createDefaults: { kind: 'jnj', is_active: true, division: 'pro', role: 'leader', sort_order: 0 },
    omitOnWrite: ['jnj_editions'],
    schema: z
      .object({
        edition_id: z.string().uuid('대회를 선택하세요'),
        division: z.string().min(1, '필수'),
        role: z.enum(['leader', 'follower']),
        name: z.string().min(1, '필수'),
      })
      .partial()
      .passthrough(),
  };
}
