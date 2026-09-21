// Design Ref: J&J 부문관리 — 대회 안의 부문(JLCF Bachata PRO / AMA / Salsa OPEN).
// 고객몰 /jnj 의 상단 부문 탭이 이 목록이고, 명예의 전당·FORMAT·GUIDELINES·심사위원이 전부 부문 아래로 들어간다.
// FORMAT/GUIDELINES 를 비워 두면 대회(에디션) 공통 본문이 그대로 쓰인다 — 부문마다 다를 때만 채우면 된다.
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import type { ResourceConfig, FilterDef } from '@/lib/resource/types';
import { StatusBadge } from '@/components/form/StatusBadge';
import type { I18n } from '@123band/shared';
import { trI18n } from '@/i18n/tr';
import { DIVISION_OPTS } from './jnj-winners';

/** 부문 종류(0110) — 같은 대회 안에서 J&J · 배틀 · 디비전 형식을 함께 운영한다. */
export const KIND_OPTS = [
  { value: 'jnj', label: 'J&J' },
  { value: 'battle', label: 'BATTLE' },
  { value: 'div', label: 'DIV' },
];

export interface JnjDivisionRow {
  id: string;
  edition_id: string;
  /** 'jnj' | 'battle' | 'div' (0110). */
  kind: string;
  code: string;
  title_i18n: I18n;
  subtitle_i18n: I18n;
  format_i18n: I18n;
  guidelines_i18n: I18n;
  video_urls: string[] | null;
  /** 부문 참가 신청 링크(0077). 있으면 고객몰에 '참가 신청' 버튼이 뜬다. */
  signup_url: string | null;
  /** 참가 신청 섹션 노출 스위치(0079). 끄면 링크가 있어도 안 뜬다. */
  signup_visible: boolean;
  /** 부문 관객 심사위원 접수 링크(0078). 있으면 고객몰에 '관객 심사위원 접수' 섹션이 뜬다. */
  vote_url: string | null;
  /** 관객 심사위원 섹션 노출 스위치(0079). 끄면 링크가 있어도 안 뜬다. */
  vote_visible: boolean;
  /** 이 부문 후기 받기(0098). 대회 스위치도 켜져 있어야 뜬다. */
  reviews_enabled: boolean;
  sort_order: number;
  is_active: boolean;
  /** 목록 표시용 조인 임베드 — 저장 시엔 제거된다(omitOnWrite). */
  jnj_editions?: { year: number; title_i18n: I18n } | null;
}

/** 표준 코드는 한글 라벨로, 직접 만든 코드는 코드 그대로 보여준다. */
export function divisionCodeLabel(code: string): string {
  return DIVISION_OPTS.find((o) => o.value === code)?.label ?? code;
}

/** 링크 칸 표시 — 없음(—) · 있지만 꺼둠(숨김) · 노출중(있음). 0079 미적용이면 visible 이 undefined 라 '있음'. */
function linkCell(url: string | null, visible: boolean | undefined): string {
  if (!url?.trim()) return '—';
  return visible === false ? '숨김' : '있음';
}

const columns: ColumnDef<JnjDivisionRow, unknown>[] = [
  // 종류를 맨 앞에 — 목록을 훑을 때 먼저 걸러 보는 값이다.
  {
    accessorKey: 'kind',
    header: '종류',
    cell: (c) => KIND_OPTS.find((o) => o.value === c.getValue())?.label ?? String(c.getValue() ?? '—'),
  },
  {
    accessorKey: 'jnj_editions',
    header: '대회',
    cell: (c) => {
      const e = c.getValue() as JnjDivisionRow['jnj_editions'];
      return e ? `${e.year} · ${trI18n(e.title_i18n)}` : '—';
    },
  },
  { accessorKey: 'title_i18n', header: '부문명', cell: (c) => trI18n(c.getValue() as I18n) || '—' },
  {
    accessorKey: 'code',
    header: '부문 코드',
    cell: (c) => divisionCodeLabel(String(c.getValue())),
  },
  {
    accessorKey: 'format_i18n',
    header: '전용 본문',
    // 비어 있으면 대회 공통 본문으로 폴백된다 — 운영자가 한눈에 알아야 하는 상태.
    cell: (c) => (trI18n(c.getValue() as I18n) ? '부문 전용' : '대회 공통'),
  },
  // 링크가 있어도 스위치가 꺼져 있으면 고객몰엔 안 뜬다 — 한 칸에서 둘 다 읽히게 '숨김' 을 따로 쓴다.
  {
    accessorKey: 'signup_url',
    header: '신청 링크',
    cell: (c) => linkCell(c.getValue() as string | null, c.row.original.signup_visible),
  },
  {
    accessorKey: 'vote_url',
    header: '심사위원 링크',
    cell: (c) => linkCell(c.getValue() as string | null, c.row.original.vote_visible),
  },
  { accessorKey: 'sort_order', header: '탭 순서' },
  {
    accessorKey: 'is_active',
    header: '상태',
    cell: (c) => StatusBadge({ status: c.getValue() ? '노출' : '숨김' }),
  },
];

/**
 * @param editionOptions useJnjEditionOptions() 결과 — 소속 대회 select/필터용.
 */
export function jnjDivisionsConfig(
  editionOptions: { value: string; label: string }[] = [],
  /** 부문 코드 필터 옵션 — 표준 코드 + 이미 등록된 코드. 화면에서 주입한다. */
  codeOptions: { value: string; label: string }[] = DIVISION_OPTS,
): ResourceConfig<JnjDivisionRow> {
  const filters: FilterDef[] = [
    { name: 'kind', label: '종류', kind: 'select', options: KIND_OPTS },
    { name: 'edition_id', label: '대회', kind: 'select', options: editionOptions },
    { name: 'code', label: '부문 코드', kind: 'select', options: codeOptions },
    {
      name: 'q',
      label: '부문명 검색',
      kind: 'search',
      searchColumns: ['title_i18n->>ko', 'title_i18n->>en'],
    },
  ];

  return {
    key: 'jnj_divisions',
    table: 'jnj_divisions',
    title: '부문관리',
    canCreate: true,
    selectColumns:
      'id, edition_id, kind, code, title_i18n, subtitle_i18n, format_i18n, guidelines_i18n, video_urls, signup_url, signup_visible, vote_url, vote_visible, reviews_enabled, sort_order, is_active, jnj_editions(year, title_i18n)',
    defaultSort: { column: 'sort_order', asc: true },
    listColumns: columns,
    filters,
    formFields: [
      // 종류가 먼저 — 배틀 부문인지 J&J 부문인지에 따라 아래 칸을 어떻게 채울지가 달라진다.
      { name: 'kind', label: '종류', kind: 'select', options: KIND_OPTS, required: true },
      { name: 'edition_id', label: '대회', kind: 'custom' }, // useJnjEditionOptions 주입
      // 표준 코드 + 직접 입력 콤보박스(페이지에서 렌더). 한 대회에 오픈이 둘(바차타·키좀바)인
      // 경우처럼 표준 코드만으로 모자랄 때 새 코드를 만들 수 있어야 한다.
      // 우승자·점수·참가자의 '부문' 과 같은 값이어야 그 데이터가 이 탭에 붙는다.
      { name: 'code', label: '부문 코드', kind: 'custom', required: true },
      {
        name: 'title_i18n',
        label: '부문명 (탭에 표시)',
        kind: 'i18n',
        required: true,
        bilingual: true,
        placeholder: 'JLCF Bachata PRO',
      },
      { name: 'subtitle_i18n', label: '탭 아래 한 줄 설명', kind: 'i18n', bilingual: true },
      {
        name: 'format_i18n',
        label: 'FORMAT (이 부문 전용)',
        kind: 'i18n-multiline',
        bilingual: true,
        placeholder:
          '비워 두면 대회(에디션)의 공통 FORMAT 이 표시됩니다. "## 소제목", "- 항목", "**굵게**" 표기를 인식합니다.',
      },
      {
        name: 'guidelines_i18n',
        label: 'GUIDELINES (이 부문 전용)',
        kind: 'i18n-multiline',
        bilingual: true,
        placeholder: '비워 두면 대회(에디션)의 공통 GUIDELINES 가 표시됩니다.',
      },
      {
        name: 'video_urls',
        label: '영상 링크 (이 부문 전용)',
        kind: 'links',
        maxItems: 20,
        placeholder: 'https://youtu.be/… · https://vimeo.com/… · mp4 주소',
        hint: '최대 20개 · 비워 두면 대회(에디션)에 등록한 영상이 이 부문에도 그대로 쓰인다.',
      },
      {
        name: 'signup_url',
        label: '참가 신청 링크',
        kind: 'text',
        placeholder: 'https://forms.gle/… · 신청 폼 또는 티켓 페이지 주소',
        hint: '넣으면 고객몰 대회 개요에 이 부문 참가 신청 버튼이 뜹니다. 회원만 열 수 있고, 비회원이 누르면 로그인 안내가 나옵니다. 아래 체크를 끄면 링크를 지우지 않고도 섹션을 잠시 내릴 수 있습니다.',
      },
      { name: 'signup_visible', label: '참가 신청 노출', kind: 'toggle' },
      {
        name: 'vote_url',
        label: '관객 심사위원 링크',
        kind: 'text',
        placeholder: 'https://forms.gle/… · 관객 심사위원 신청 폼 주소',
        hint: '넣으면 고객몰 대회 개요에 이 부문 관객 심사위원 접수 섹션이 뜹니다. 회원만 열 수 있고, 비회원이 누르면 로그인 안내가 나옵니다. 접수를 마감할 땐 아래 체크를 끄면 됩니다 — 링크는 그대로 둬도 됩니다.',
      },
      { name: 'vote_visible', label: '관객 심사위원 노출', kind: 'toggle' },
      // 부문 탭마다 따로 받는 후기. 대회관리의 '후기 받기 (대회 전체)' 가 꺼져 있으면 이걸 켜도 안 뜬다.
      { name: 'reviews_enabled', label: '후기 받기 (이 부문)', kind: 'toggle' },
      { name: 'sort_order', label: '탭 순서 (작을수록 왼쪽)', kind: 'number' },
      // 위 두 스위치와 나란히 놓이니 무엇을 켜고 끄는지 이름으로 구분되게 한다 — 이건 부문 탭 전체.
      { name: 'is_active', label: '부문 노출 (탭 전체)', kind: 'toggle' },
    ],
    createDefaults: {
      kind: 'jnj',
      is_active: true,
      signup_visible: true,
      vote_visible: true,
      reviews_enabled: true,
      sort_order: 0,
      code: 'pro',
    },
    omitOnWrite: ['jnj_editions'],
    // 부문명은 고유명사라 제외 — 본문만 EN→KO 자동 번역.
    autoTranslate: ['format_i18n', 'guidelines_i18n'],
    schema: z
      .object({
        edition_id: z.string().uuid('대회를 선택하세요'),
        kind: z.enum(['jnj', 'battle', 'div']).optional(),
        code: z
          .string()
          .min(1, '필수')
          .regex(/^[a-z0-9-]+$/, '영문 소문자·숫자·하이픈만 쓸 수 있습니다 (예: open-kizomba)'),
        sort_order: z.number().int('정수').optional(),
        signup_url: z
          .string()
          .url('http(s):// 로 시작하는 주소를 넣어 주세요')
          .nullish()
          .or(z.literal('')),
        vote_url: z
          .string()
          .url('http(s):// 로 시작하는 주소를 넣어 주세요')
          .nullish()
          .or(z.literal('')),
        video_urls: z.array(z.string()).max(20, '영상 링크는 최대 20개까지 넣을 수 있습니다').optional(),
      })
      .partial()
      .passthrough(),
  };
}
