// Design Ref: §5.4 회원관리 — profiles CRUD (수정만, 생성은 Auth 가입 경유)
import type { ColumnDef } from '@tanstack/react-table';
import type { ResourceConfig } from '@/lib/resource/types';
import Link from 'next/link';
import { CharacterAvatar } from '@/components/member/CharacterAvatar';

export interface MemberRow {
  id: string;
  email: string | null;
  role: string;
  name: string | null;
  phone: string | null;
  country: string | null;
  created_at: string;
  /** 회원이 올린 프로필 사진. 없으면 캐릭터 아바타(avatar_seed·avatar_traits)로 그린다. */
  avatar_url: string | null;
  avatar_seed: string | null;
  avatar_traits: unknown;
}

// 폼(권한 변경)용 — 전체 역할
const ROLE_OPTS = [
  { value: 'customer', label: '일반회원' },
  { value: 'partner', label: '오거나이저' },
  { value: 'admin', label: '관리자' },
];
// 필터용 — 회원관리는 오거나이저 제외(오거나이저는 오거나이저관리에서 관리)
const FILTER_ROLE_OPTS = [
  { value: 'customer', label: '일반회원' },
  { value: 'admin', label: '관리자' },
];

// ISO2 국가코드 → 표시 국가명(런타임 로케일). 실패 시 코드 그대로.
const REGION_NAMES = (() => {
  try {
    return new Intl.DisplayNames(undefined, { type: 'region' });
  } catch {
    return null;
  }
})();
function countryLabel(v: unknown): string {
  const code = String(v ?? '').trim();
  if (!code) return '—';
  try {
    return REGION_NAMES?.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

// 가입일시 — 날짜 + 시:분:초 (브라우저 현지시간, 보통 KST)
function fmtDateTime(v: unknown): string {
  const raw = String(v ?? '');
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 19).replace('T', ' ');
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

const columns: ColumnDef<MemberRow, unknown>[] = [
  // 얼굴 먼저 — 목록을 훑을 때 이메일 문자열보다 사람이 먼저 눈에 들어온다.
  // 회원이 올린 사진이 있으면 사진, 없으면 고객 화면과 같은 캐릭터 아바타.
  {
    id: 'avatar',
    header: '사진',
    // 얼굴을 누르면 그 회원의 활동(회원활동 드로어)으로 — 행 클릭(수정)과 구분한다.
    cell: (c) => (
      <Link
        href={`/member-activity?member=${c.row.original.id}`}
        onClick={(e) => e.stopPropagation()}
        title="활동 보기"
        className="inline-block rounded-full transition-transform hover:scale-110"
      >
        <CharacterAvatar
          seed={c.row.original.avatar_seed}
          traits={c.row.original.avatar_traits}
          photoUrl={c.row.original.avatar_url}
          size={36}
          className="rounded-full"
          label={c.row.original.name ?? c.row.original.email ?? 'member'}
        />
      </Link>
    ),
  },
  { accessorKey: 'email', header: '이메일' },
  { accessorKey: 'country', header: '국가', cell: (c) => countryLabel(c.getValue()) },
  { accessorKey: 'role', header: '권한', cell: (c) => ROLE_OPTS.find((o) => o.value === c.getValue())?.label ?? String(c.getValue()) },
  { accessorKey: 'name', header: '이름' },
  { accessorKey: 'created_at', header: '가입일', cell: (c) => fmtDateTime(c.getValue()) },
];

export const membersConfig: ResourceConfig<MemberRow> = {
  key: 'members',
  table: 'profiles',
  title: '일반회원 관리',
  canCreate: false, // 가입은 Auth 경유 — 어드민은 수정만
  // 오거나이저 회원은 제외 — 오거나이저는 '오거나이저관리'에서 분리 관리
  baseFilter: { column: 'role', op: 'neq', value: 'partner' },
  selectColumns: 'id, email, role, name, phone, country, created_at, avatar_url, avatar_seed, avatar_traits',
  defaultSort: { column: 'created_at', asc: false }, // 등록일(가입일) 최신순 기본
  listColumns: columns,
  filters: [
    { name: 'q', label: '이메일/이름 검색', kind: 'search', searchColumns: ['email', 'name'] },
    { name: 'role', label: '권한', kind: 'select', options: FILTER_ROLE_OPTS },
  ],
  formFields: [
    { name: 'email', label: '이메일', kind: 'text', readOnly: true },
    { name: 'name', label: '이름', kind: 'text' },
    { name: 'phone', label: '전화', kind: 'text' },
    { name: 'role', label: '권한', kind: 'select', options: ROLE_OPTS, required: true },
    { name: 'country', label: '국가', kind: 'custom' }, // CountrySelect (members 페이지 renderCustom)
    { name: 'login_status', label: '최근 로그인', kind: 'custom' }, // 읽기 전용 표시 — 저장 대상 아님 (LoginStatusInfo)
  ],
};
