// Design Ref: §5.4 게시판관리 — 공지/문의/후기/FAQ 유형별 글 CRUD.
// 제목·본문은 다국어(*_i18n). 목록에 번역 상태를 배지로 띄워 "영문만 채운 글"을 바로 찾게 한다.
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import type { I18n } from '@123band/shared';
import { trI18n } from '@/i18n/tr';
import type { ResourceConfig } from '@/lib/resource/types';
import { StatusBadge } from '@/components/form/StatusBadge';

export interface BoardRow {
  id: string;
  board_type: string | null;
  /** [deprecated] title_i18n 에서 DB 트리거로 동기화. 표시는 title_i18n 기준. */
  title: string | null;
  content: string | null;
  title_i18n: I18n | null;
  content_i18n: I18n | null;
  author_id: string | null;
  status: string;
  created_at: string;
}

const TYPE_OPTS = [
  { value: 'notice', label: '공지' },
  { value: 'qna', label: '문의' },
  { value: 'review', label: '후기' },
  { value: 'faq', label: 'FAQ' },
];
const STATUS_OPTS = [
  { value: 'open', label: '공개' },
  { value: 'closed', label: '비공개' },
];

const txt = (v: I18n | null | undefined, locale: 'ko' | 'en') => (v?.[locale] ?? '').trim();

/** 번역 상태 — 한 언어라도 비면 '없음', 양쪽이 똑같으면(입력 미러본) '번역 필요'. */
function i18nState(row: BoardRow): '한글 없음' | '영문 없음' | '번역 필요' | '완료' {
  // 본문이 통째로 비어 있으면(제목만 있는 글) 본문은 판정에서 뺀다.
  const fields = [row.title_i18n, row.content_i18n].filter(
    (v) => txt(v, 'ko') || txt(v, 'en'),
  );
  if (fields.length === 0) return '한글 없음';
  if (fields.some((v) => !txt(v, 'ko'))) return '한글 없음';
  if (fields.some((v) => !txt(v, 'en'))) return '영문 없음';
  if (fields.some((v) => txt(v, 'ko') === txt(v, 'en'))) return '번역 필요';
  return '완료';
}

const STATE_TONE = {
  '한글 없음': 'danger',
  '영문 없음': 'danger',
  '번역 필요': 'warn',
  '완료': 'success',
} as const;

const columns: ColumnDef<BoardRow, unknown>[] = [
  { accessorKey: 'board_type', header: '유형', cell: (c) => TYPE_OPTS.find((o) => o.value === c.getValue())?.label ?? '—' },
  {
    accessorKey: 'title_i18n',
    header: '제목',
    cell: (c) => {
      const v = c.getValue() as I18n | null;
      // 목록은 한글 우선(운영자 기준) — 없으면 영문 폴백.
      return trI18n(v) || c.row.original.title || '—';
    },
  },
  {
    id: 'i18n_state',
    accessorKey: 'title_i18n',
    header: '번역',
    enableSorting: false,
    cell: (c) => {
      const state = i18nState(c.row.original);
      return StatusBadge({ status: state, tone: STATE_TONE[state] });
    },
  },
  { accessorKey: 'status', header: '상태', cell: (c) => StatusBadge({ status: STATUS_OPTS.find((o) => o.value === c.getValue())?.label ?? String(c.getValue()) }) },
  { accessorKey: 'created_at', header: '작성일', cell: (c) => String(c.getValue() ?? '').slice(0, 10) },
];

export const boardsConfig: ResourceConfig<BoardRow> = {
  key: 'boards',
  table: 'boards',
  title: '게시판관리',
  canCreate: true,
  // 레거시 title/content 도 함께 읽는다 — upsert 는 전체 행 교체라 폼에 실려 나가야 값이 보존된다.
  selectColumns:
    'id, board_type, title, content, title_i18n, content_i18n, author_id, status, created_at',
  defaultSort: { column: 'created_at', asc: false },
  listColumns: columns,
  filters: [
    // 제목은 jsonb 라 언어별 경로로 검색한다(ko/en 둘 중 하나만 맞아도 매칭).
    { name: 'q', label: '제목 검색', kind: 'search', searchColumns: ['title_i18n->>ko', 'title_i18n->>en'] },
    { name: 'board_type', label: '유형', kind: 'select', options: TYPE_OPTS },
    { name: 'status', label: '상태', kind: 'select', options: STATUS_OPTS },
  ],
  formFields: [
    { name: 'board_type', label: '유형', kind: 'select', options: TYPE_OPTS, required: true },
    // 왼쪽 EN(원문) · 오른쪽 KO(번역) 2열 입력 — 한글 칸이 항상 보이게 한다.
    { name: 'title_i18n', label: '제목', kind: 'i18n', required: true, bilingual: true },
    { name: 'content_i18n', label: '내용', kind: 'i18n-multiline', bilingual: true },
    { name: 'status', label: '상태', kind: 'select', options: STATUS_OPTS, required: true },
  ],
  // 저장 시 KO 가 비었거나 EN 복사본이면 EN→KO 자동번역(AI 키 없으면 조용히 건너뜀).
  // 게시글 제목은 고유명사가 아니라 문장이라 제목도 번역 대상에 넣는다.
  autoTranslate: ['title_i18n', 'content_i18n'],
  schema: z
    .object({
      board_type: z.enum(['notice', 'qna', 'review', 'faq']).optional(),
      status: z.enum(['open', 'closed']).optional(),
    })
    .passthrough(),
};
