// Design Ref: 스탬프관리 — 도장 적립/소진 내역(stamp_ledger) 읽기 전용 목록.
// 원장은 RPC 로만 생성되므로 어드민에서도 조회만 한다(수정/삭제 없음).
import type { ColumnDef } from '@tanstack/react-table';
import type { ResourceConfig } from '@/lib/resource/types';
import { StampDelta, stampUnit } from '@/components/stamp/StampDelta';
import { fmtDateTime } from '@/lib/resource/configs/point-ledger';

export interface StampLedgerRow {
  id: string;
  user_id: string;
  delta: number;
  balance_after: number;
  reason: string;
  memo: string | null;
  created_at: string;
  user?: { name: string | null; email: string | null } | null;
}

// stamp_ledger.reason 의 check 제약과 같은 목록 — 여기 없는 값은 원문이 그대로 나온다.
export const STAMP_REASON_OPTS = [
  { value: 'order_paid', label: '결제 완료' },
  { value: 'checkin', label: '행사 참석' },
  { value: 'review_write', label: '후기 작성' },
  { value: 'qna_write', label: '문의 작성' },
  { value: 'admin_grant', label: '관리자 지급' },
  { value: 'admin_deduct', label: '관리자 차감' },
  { value: 'point_reward', label: '카드 완성 — 포인트 적립' },
  // (지난 기록) 0065 이전에는 카드 완성 보상이 쿠폰이었다
  { value: 'coupon_reward', label: '카드 완성 — 쿠폰 발급' },
];

export function stampReasonLabel(v: unknown): string {
  return STAMP_REASON_OPTS.find((o) => o.value === v)?.label ?? String(v ?? '');
}

function memberLabel(u: { name: string | null; email: string | null } | null | undefined): string {
  if (!u?.email) return '—';
  return u.name ? `${u.name} · ${u.email}` : u.email;
}

const columns: ColumnDef<StampLedgerRow, unknown>[] = [
  { accessorKey: 'created_at', header: '일시', cell: (c) => fmtDateTime(c.getValue()) },
  { id: 'member', header: '회원', cell: (c) => memberLabel(c.row.original.user) },
  { accessorKey: 'reason', header: '구분', cell: (c) => stampReasonLabel(c.getValue()) },
  {
    accessorKey: 'delta',
    header: '증감',
    cell: (c) => StampDelta({ value: Number(c.getValue() ?? 0) }),
  },
  {
    accessorKey: 'balance_after',
    header: '카드 진행',
    cell: (c) => stampUnit(Number(c.getValue() ?? 0)),
  },
  { accessorKey: 'memo', header: '메모', cell: (c) => String(c.getValue() ?? '—') },
];

export const stampLedgerConfig: ResourceConfig<StampLedgerRow> = {
  key: 'stamp-ledger',
  table: 'stamp_ledger',
  title: '스탬프 내역',
  canCreate: false,
  selectColumns:
    'id, user_id, delta, balance_after, reason, memo, created_at, user:profiles!user_id(name, email)',
  defaultSort: { column: 'created_at', asc: false },
  listColumns: columns,
  filters: [
    { name: 'q', label: '회원 이메일/이름 검색', kind: 'search' },
    { name: 'reason', label: '구분', kind: 'select', options: STAMP_REASON_OPTS },
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
