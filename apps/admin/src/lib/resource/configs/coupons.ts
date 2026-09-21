// Design Ref: 설명.txt 쿠폰관리 — coupons CRUD. 비율(%)/정액 할인 + 노출기간/사용제한.
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import type { ResourceConfig } from '@/lib/resource/types';
import { StatusBadge } from '@/components/form/StatusBadge';

export interface CouponRow {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  min_amount: number;
  currency: string;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  used_count: number;
  is_active: boolean;
  // 포인트 교환(0038) — 켜면 고객 마이페이지의 '포인트로 교환' 목록에 노출된다.
  is_exchangeable: boolean;
  point_cost: number | null;
  name_i18n: Record<string, string>;
  valid_days: number | null;
  per_user_limit: number | null;
}

const TYPE_OPTS = [
  { value: 'percent', label: '비율(%)' },
  { value: 'fixed', label: '정액' },
];
const CURRENCY_OPTS = [
  { value: 'USD', label: 'USD' },
  { value: 'KRW', label: 'KRW' },
];

function fmtValue(row: CouponRow): string {
  if (row.discount_type === 'percent') return `${row.discount_value}%`;
  const v = row.currency === 'KRW' ? row.discount_value : row.discount_value / 100;
  return `${row.currency} ${v.toLocaleString()}`;
}

const columns: ColumnDef<CouponRow, unknown>[] = [
  { accessorKey: 'code', header: '코드' },
  { accessorKey: 'discount_type', header: '유형', cell: (c) => TYPE_OPTS.find((o) => o.value === c.getValue())?.label ?? String(c.getValue()) },
  { id: 'value', header: '할인', cell: (c) => fmtValue(c.row.original) },
  { id: 'usage', header: '사용', cell: (c) => `${c.row.original.used_count}${c.row.original.usage_limit != null ? ` / ${c.row.original.usage_limit}` : ''}` },
  { accessorKey: 'ends_at', header: '종료일', cell: (c) => String(c.getValue() ?? '—').slice(0, 10) },
  {
    id: 'exchange',
    header: '포인트 교환',
    cell: (c) =>
      c.row.original.is_exchangeable && (c.row.original.point_cost ?? 0) > 0
        ? `${Number(c.row.original.point_cost).toLocaleString()} P`
        : '—',
  },
  { accessorKey: 'is_active', header: '상태', cell: (c) => StatusBadge({ status: c.getValue() ? '활성' : '비활성' }) },
];

export const couponsConfig: ResourceConfig<CouponRow> = {
  key: 'coupons',
  table: 'coupons',
  title: '쿠폰관리',
  canCreate: true,
  selectColumns:
    'id, code, discount_type, discount_value, min_amount, currency, starts_at, ends_at, usage_limit, used_count, is_active, ' +
    'is_exchangeable, point_cost, name_i18n, valid_days, per_user_limit',
  defaultSort: { column: 'created_at', asc: false },
  listColumns: columns,
  filters: [
    { name: 'q', label: '코드 검색', kind: 'search', searchColumns: ['code'] },
    { name: 'discount_type', label: '유형', kind: 'select', options: TYPE_OPTS },
  ],
  formFields: [
    { name: 'code', label: '쿠폰코드', kind: 'text', required: true, placeholder: 'WELCOME10' },
    { name: 'discount_type', label: '할인 유형', kind: 'select', options: TYPE_OPTS, required: true },
    { name: 'discount_value', label: '할인 값 (비율=%, 정액=최소단위 정수 예 USD 1000=$10)', kind: 'number', required: true },
    { name: 'currency', label: '통화 (정액일 때)', kind: 'select', options: CURRENCY_OPTS },
    { name: 'min_amount', label: '최소 주문금액 (최소단위, 0=제한없음)', kind: 'number' },
    { name: 'starts_at', label: '시작일', kind: 'date' },
    { name: 'ends_at', label: '종료일', kind: 'date' },
    { name: 'usage_limit', label: '총 사용제한 (비우면 무제한)', kind: 'number' },
    { name: 'is_active', label: '활성', kind: 'toggle' },
    // ── 포인트 교환 (마이페이지 '포인트로 교환' 목록 노출 조건) ──────────────
    { name: 'is_exchangeable', label: '포인트 교환 상품으로 노출', kind: 'toggle' },
    { name: 'point_cost', label: '교환에 필요한 포인트 (교환 노출 시 필수)', kind: 'number' },
    { name: 'name_i18n', label: '교환샵 표시명 (고객 노출)', kind: 'i18n' },
    { name: 'valid_days', label: '발급 후 유효일수 (비우면 정책 기본값)', kind: 'number' },
    { name: 'per_user_limit', label: '1인 교환 한도 (비우면 무제한)', kind: 'number' },
  ],
  schema: z
    .object({
      discount_type: z.enum(['percent', 'fixed']).optional(),
      discount_value: z.number().int('정수').nonnegative('0 이상').optional(),
      min_amount: z.number().int('정수').nonnegative('0 이상').optional(),
      currency: z.enum(['USD', 'KRW']).optional(),
      point_cost: z.number().int('정수').positive('1 이상').nullable().optional(),
      valid_days: z.number().int('정수').positive('1 이상').nullable().optional(),
      per_user_limit: z.number().int('정수').positive('1 이상').nullable().optional(),
    })
    .passthrough()
    // 교환 노출을 켰으면 필요 포인트가 있어야 한다 (없으면 고객 화면에서 교환 불가)
    .refine(
      (v) => !(v as { is_exchangeable?: boolean }).is_exchangeable || Number((v as { point_cost?: number }).point_cost ?? 0) > 0,
      { message: '포인트 교환을 켰다면 필요 포인트를 입력해 주세요.', path: ['point_cost'] },
    ),
};
