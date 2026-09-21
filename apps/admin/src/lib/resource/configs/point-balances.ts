// Design Ref: 포인트관리 — 회원별 포인트 보유 현황(profiles.point_balance).
// 잔액은 원장의 파생값이라 직접 수정 불가(DB 가드 트리거). 지급/차감은 admin_adjust_points RPC 로만.
import type { ColumnDef } from '@tanstack/react-table';
import type { ResourceConfig } from '@/lib/resource/types';

export interface PointBalanceRow {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  point_balance: number;
  created_at: string;
}

const columns: ColumnDef<PointBalanceRow, unknown>[] = [
  { accessorKey: 'email', header: '이메일' },
  { accessorKey: 'name', header: '이름', cell: (c) => String(c.getValue() ?? '—') },
  {
    accessorKey: 'point_balance',
    header: '보유 포인트',
    cell: (c) => `${Number(c.getValue() ?? 0).toLocaleString()} P`,
  },
];

export const pointBalancesConfig: ResourceConfig<PointBalanceRow> = {
  key: 'point-balances',
  table: 'profiles',
  title: '회원 포인트',
  canCreate: false,
  // 오거나이저는 포인트 대상이 아니다(구매 회원 전용)
  baseFilter: { column: 'role', op: 'neq', value: 'partner' },
  selectColumns: 'id, email, name, role, point_balance, created_at',
  defaultSort: { column: 'point_balance', asc: false },
  listColumns: columns,
  filters: [{ name: 'q', label: '이메일/이름 검색', kind: 'search', searchColumns: ['email', 'name'] }],
  formFields: [],
};
