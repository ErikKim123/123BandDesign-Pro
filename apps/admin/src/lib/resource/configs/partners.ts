// Design Ref: §5.4 오거나이저관리 — partners, 승인 전이 + commission_rate
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import type { ResourceConfig } from '@/lib/resource/types';
import { StatusBadge } from '@/components/form/StatusBadge';

export interface PartnerRow {
  id: string;
  user_id: string;
  company_name: string | null;
  country: string | null;
  biz_no: string | null;
  commission_rate: number;
  status: string;
  created_at: string;
  /** 연결된 로그인 계정 (partners.user_id → profiles.id) */
  profiles?: { email: string | null } | null;
}

const STATUS_OPTS = [
  { value: 'pending', label: '대기' },
  { value: 'active', label: '활성' },
  { value: 'suspended', label: '정지' },
];

// Design Ref: §3.2 허용 상태 전이
export const PARTNER_TRANSITIONS: Record<string, { to: string; label: string }[]> = {
  pending: [
    { to: 'active', label: '승인' },
    { to: 'suspended', label: '반려' },
  ],
  active: [{ to: 'suspended', label: '정지' }],
  suspended: [{ to: 'active', label: '복구' }],
};

const columns: ColumnDef<PartnerRow, unknown>[] = [
  { accessorKey: 'company_name', header: '회사명' },
  { id: 'login_email', header: '로그인 ID', cell: (c) => c.row.original.profiles?.email ?? '—' },
  { accessorKey: 'country', header: '국가', cell: (c) => String(c.getValue() ?? '—') },
  { accessorKey: 'biz_no', header: '사업자번호' },
  { accessorKey: 'commission_rate', header: '수수료율', cell: (c) => `${(Number(c.getValue()) * 100).toFixed(1)}%` },
  { accessorKey: 'status', header: '상태', cell: (c) => StatusBadge({ status: String(c.getValue()) }) },
  { accessorKey: 'created_at', header: '신청일', cell: (c) => String(c.getValue() ?? '').slice(0, 10) },
];

export const partnersConfig: ResourceConfig<PartnerRow> = {
  key: 'partners',
  table: 'partners',
  title: '오거나이저회원 관리',
  canCreate: false, // 입점 신청은 가입 흐름, 어드민은 승인/편집
  // 0116 으로 partners→profiles 경로가 둘이 됐다(신청자 user_id · 승인자 approved_by).
  // 관계를 지정하지 않으면 PostgREST 가 300(모호함)을 돌려준다.
  selectColumns:
    'id, user_id, company_name, country, biz_no, commission_rate, status, created_at, profiles!partners_user_id_fkey(email)',
  omitOnWrite: ['profiles', 'created_at'], // 조인/생성시각은 쓰기 제외
  defaultSort: { column: 'created_at', asc: false },
  listColumns: columns,
  filters: [
    { name: 'q', label: '회사명 검색', kind: 'search', searchColumns: ['company_name', 'biz_no'] },
    { name: 'status', label: '상태', kind: 'select', options: STATUS_OPTS },
  ],
  formFields: [
    { name: 'company_name', label: '회사명', kind: 'text', required: true },
    { name: 'country', label: '국가', kind: 'text' },
    { name: 'biz_no', label: '사업자번호', kind: 'text' },
    { name: 'commission_rate', label: '수수료율 (0~1, 예 0.15)', kind: 'number', required: true },
  ],
  // G2: 보안 검증 (Design §7) — 수수료율 0~1, 상태 enum
  schema: z
    .object({
      company_name: z.string().min(1, '회사명을 입력하세요').optional(),
      commission_rate: z.coerce.number().min(0, '0 이상').max(1, '1 이하(예 0.15)').optional(),
      status: z.enum(['pending', 'active', 'suspended']).optional(),
    })
    .passthrough(),
};
