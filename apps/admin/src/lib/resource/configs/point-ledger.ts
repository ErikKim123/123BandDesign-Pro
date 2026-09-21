// Design Ref: 포인트관리 — 적립/사용 내역(point_ledger) 읽기 전용 목록.
// 원장은 RPC 로만 생성되므로 어드민에서도 조회만 한다(수정/삭제 없음).
import type { ColumnDef } from '@tanstack/react-table';
import type { ResourceConfig } from '@/lib/resource/types';
import { PointDelta } from '@/components/point/PointDelta';

export interface PointLedgerRow {
  id: string;
  user_id: string;
  delta: number;
  balance_after: number;
  reason: string;
  memo: string | null;
  created_at: string;
  user?: { name: string | null; email: string | null } | null;
}

export const REASON_OPTS = [
  { value: 'signup', label: '가입 축하' },
  { value: 'admin_grant', label: '관리자 지급' },
  { value: 'admin_deduct', label: '관리자 차감' },
  { value: 'review_write', label: '후기 작성 이벤트' },
  { value: 'qna_write', label: '댓글 작성 이벤트' },
  { value: 'achievement', label: '업적 달성 보상' },
  { value: 'stamp_reward', label: '스탬프 카드 완성' },
  { value: 'order_earn', label: '구매 적립' },
  { value: 'order_cancel', label: '주문 취소 회수' },
  { value: 'coupon_exchange', label: '쿠폰 교환' },
  { value: 'coupon_restore', label: '교환 취소 환급' },
  { value: 'expire', label: '기간 만료 소멸' },
];

export function reasonLabel(v: unknown): string {
  return REASON_OPTS.find((o) => o.value === v)?.label ?? String(v ?? '');
}

/** 목록 표기용 일시 — 날짜 + 시:분 (브라우저 현지시간, 보통 KST) */
export function fmtDateTime(v: unknown): string {
  const raw = String(v ?? '');
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 19).replace('T', ' ');
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function memberLabel(u: { name: string | null; email: string | null } | null | undefined): string {
  if (!u?.email) return '—';
  return u.name ? `${u.name} · ${u.email}` : u.email;
}

const columns: ColumnDef<PointLedgerRow, unknown>[] = [
  { accessorKey: 'created_at', header: '일시', cell: (c) => fmtDateTime(c.getValue()) },
  { id: 'member', header: '회원', cell: (c) => memberLabel(c.row.original.user) },
  { accessorKey: 'reason', header: '구분', cell: (c) => reasonLabel(c.getValue()) },
  { accessorKey: 'delta', header: '증감', cell: (c) => PointDelta({ value: Number(c.getValue() ?? 0) }) },
  {
    accessorKey: 'balance_after',
    header: '잔액',
    cell: (c) => `${Number(c.getValue() ?? 0).toLocaleString()} P`,
  },
  { accessorKey: 'memo', header: '메모', cell: (c) => String(c.getValue() ?? '—') },
];

export const pointLedgerConfig: ResourceConfig<PointLedgerRow> = {
  key: 'point-ledger',
  table: 'point_ledger',
  title: '포인트 내역',
  canCreate: false,
  selectColumns:
    'id, user_id, delta, balance_after, reason, memo, created_at, user:profiles!user_id(name, email)',
  defaultSort: { column: 'created_at', asc: false },
  listColumns: columns,
  filters: [
    { name: 'q', label: '회원 이메일/이름 검색', kind: 'search' },
    { name: 'reason', label: '구분', kind: 'select', options: REASON_OPTS },
  ],
  formFields: [],
  // 회원 이메일/이름으로 검색 → user_id 목록으로 변환 (원장에는 이메일이 없으므로)
  buildSearchOr: async (term, supabase) => {
    const like = `%${term}%`;
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .or(`name.ilike.${like},email.ilike.${like}`)
      .limit(500);
    const ids = (data as { id: string }[] | null)?.map((r) => r.id) ?? [];
    // 매칭 회원이 없으면 결과가 비도록 존재하지 않는 id 로 필터
    return [`user_id.in.(${ids.length ? ids.join(',') : '00000000-0000-0000-0000-000000000000'})`];
  },
};
