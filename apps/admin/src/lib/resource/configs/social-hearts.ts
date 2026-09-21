// Design Ref: 소셜관리 — 하트 주고받은 내역(social_hearts_v). 조회 + 삭제(신고 대응)만.
// 하트 생성은 give_social_heart RPC 로만 가능하므로 어드민에서도 만들지 않는다.
import type { ColumnDef } from '@tanstack/react-table';
import type { ResourceConfig } from '@/lib/resource/types';
import { fmtDateTime } from './point-ledger';

export interface SocialHeartRow {
  id: string;
  created_at: string;
  created_date: string;
  /** 반응 종류 (마이그레이션 0046) — 구행은 'heart' */
  kind: string | null;
  message: string | null;
  from_user_id: string;
  to_user_id: string;
  from_name: string | null;
  from_email: string | null;
  from_code: string | null;
  to_name: string | null;
  to_email: string | null;
  to_code: string | null;
}

function memberLabel(name: string | null, email: string | null, code: string | null): string {
  if (name) return email ? `${name} · ${email}` : name;
  return email || code || '—';
}

// web 의 REACTION_EMOJI 와 같은 5종(마이그레이션 0046). 어드민은 조회만 하므로 표기용 상수로 둔다.
const KIND_LABEL: Record<string, string> = {
  heart: '❤️ 고마워요',
  thumbs: '👍 최고예요',
  dance: '💃 춤 최고',
  fire: '🔥 에너지',
  clap: '👏 멋져요',
};

const columns: ColumnDef<SocialHeartRow, unknown>[] = [
  { accessorKey: 'created_at', header: '일시', cell: (c) => fmtDateTime(c.getValue()) },
  {
    accessorKey: 'kind',
    header: '반응',
    cell: (c) => KIND_LABEL[String(c.getValue() ?? 'heart')] ?? String(c.getValue() ?? '—'),
  },
  {
    id: 'from',
    header: '보낸 회원',
    cell: (c) => memberLabel(c.row.original.from_name, c.row.original.from_email, c.row.original.from_code),
  },
  {
    id: 'to',
    header: '받은 회원',
    cell: (c) => memberLabel(c.row.original.to_name, c.row.original.to_email, c.row.original.to_code),
  },
  { accessorKey: 'message', header: '한마디', cell: (c) => String(c.getValue() ?? '—') },
];

export const socialHeartsConfig: ResourceConfig<SocialHeartRow> = {
  key: 'social-hearts',
  // 목록은 평평한 조인 뷰로 읽는다(컬럼별 ilike 검색을 쓰기 위해).
  // 조인 뷰는 삭제할 수 없으므로 삭제만 기반 테이블(social_hearts)로 보낸다 — social/page.tsx 참고.
  table: 'social_hearts_v',
  title: '하트 내역',
  canCreate: false,
  defaultSort: { column: 'created_at', asc: false },
  listColumns: columns,
  filters: [
    {
      name: 'q',
      label: '회원 이메일/이름/코드 검색',
      kind: 'search',
      searchColumns: [
        'from_name',
        'from_email',
        'from_code',
        'to_name',
        'to_email',
        'to_code',
        'message',
      ],
    },
  ],
  formFields: [],
};
