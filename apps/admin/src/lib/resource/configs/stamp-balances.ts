// Design Ref: 스탬프관리 — 회원별 도장 보유 현황(profiles.stamp_count).
// 진행도는 원장의 파생값이라 직접 수정 불가(DB 가드 트리거). 지급/차감은 admin_adjust_stamps RPC 로만.
import type { ColumnDef } from '@tanstack/react-table';
import type { ResourceConfig } from '@/lib/resource/types';
import { stampUnit } from '@/components/stamp/StampDelta';

export interface StampBalanceRow {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  stamp_count: number;
  created_at: string;
}

const columns: ColumnDef<StampBalanceRow, unknown>[] = [
  { accessorKey: 'email', header: '이메일' },
  { accessorKey: 'name', header: '이름', cell: (c) => String(c.getValue() ?? '—') },
  {
    accessorKey: 'stamp_count',
    header: '보유 도장',
    cell: (c) => stampUnit(Number(c.getValue() ?? 0)),
  },
];

export const stampBalancesConfig: ResourceConfig<StampBalanceRow> = {
  key: 'stamp-balances',
  table: 'profiles',
  title: '회원 스탬프',
  canCreate: false,
  // 오거나이저는 스탬프 대상이 아니다(구매 회원 전용) — 포인트와 같은 기준.
  baseFilter: { column: 'role', op: 'neq', value: 'partner' },
  selectColumns: 'id, email, name, role, stamp_count, created_at',
  defaultSort: { column: 'stamp_count', asc: false },
  listColumns: columns,
  filters: [
    { name: 'q', label: '이메일/이름 검색', kind: 'search', searchColumns: ['email', 'name'] },
  ],
  formFields: [],
};
