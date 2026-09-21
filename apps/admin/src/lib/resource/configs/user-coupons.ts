// Design Ref: 포인트관리 — 포인트로 교환된 개인 쿠폰(user_coupons) 발급/사용 현황. 조회 전용.
import type { ColumnDef } from '@tanstack/react-table';
import type { ResourceConfig } from '@/lib/resource/types';
import { StatusBadge } from '@/components/form/StatusBadge';
import { fmtDateTime } from './point-ledger';

export interface UserCouponRow {
  id: string;
  code: string;
  status: string;
  source: string;
  point_cost: number;
  expires_at: string | null;
  used_at: string | null;
  created_at: string;
  user?: { name: string | null; email: string | null } | null;
  coupon?: { code: string; discount_type: string; discount_value: number; currency: string } | null;
}

const STATUS_OPTS = [
  { value: 'active', label: '사용가능' },
  { value: 'used', label: '사용완료' },
  { value: 'expired', label: '기간만료' },
];

function discountLabel(c: UserCouponRow['coupon']): string {
  if (!c) return '—';
  if (c.discount_type === 'percent') return `${c.discount_value}%`;
  const v = c.currency === 'KRW' ? c.discount_value : c.discount_value / 100;
  return `${c.currency} ${v.toLocaleString()}`;
}

const columns: ColumnDef<UserCouponRow, unknown>[] = [
  { accessorKey: 'created_at', header: '교환일', cell: (c) => fmtDateTime(c.getValue()) },
  {
    id: 'member',
    header: '회원',
    cell: (c) => {
      const u = c.row.original.user;
      return u?.email ? (u.name ? `${u.name} · ${u.email}` : u.email) : '—';
    },
  },
  { accessorKey: 'code', header: '발급 코드' },
  { id: 'origin', header: '원본 쿠폰', cell: (c) => c.row.original.coupon?.code ?? '—' },
  { id: 'discount', header: '할인', cell: (c) => discountLabel(c.row.original.coupon) },
  {
    accessorKey: 'point_cost',
    header: '사용 포인트',
    cell: (c) => `${Number(c.getValue() ?? 0).toLocaleString()} P`,
  },
  { accessorKey: 'expires_at', header: '유효기한', cell: (c) => String(c.getValue() ?? '—').slice(0, 10) },
  {
    accessorKey: 'status',
    header: '상태',
    cell: (c) => StatusBadge({ status: STATUS_OPTS.find((o) => o.value === c.getValue())?.label ?? String(c.getValue()) }),
  },
];

export const userCouponsConfig: ResourceConfig<UserCouponRow> = {
  key: 'user-coupons',
  table: 'user_coupons',
  title: '쿠폰 교환 내역',
  canCreate: false,
  selectColumns:
    'id, code, status, source, point_cost, expires_at, used_at, created_at, ' +
    'user:profiles!user_id(name, email), coupon:coupons!coupon_id(code, discount_type, discount_value, currency)',
  defaultSort: { column: 'created_at', asc: false },
  listColumns: columns,
  filters: [
    { name: 'q', label: '회원/코드 검색', kind: 'search', searchColumns: ['code'] },
    { name: 'status', label: '상태', kind: 'select', options: STATUS_OPTS },
  ],
  formFields: [],
  buildSearchOr: async (term, supabase) => {
    const like = `%${term}%`;
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .or(`name.ilike.${like},email.ilike.${like}`)
      .limit(500);
    const ids = (data as { id: string }[] | null)?.map((r) => r.id) ?? [];
    return ids.length ? [`user_id.in.(${ids.join(',')})`] : [];
  },
};
