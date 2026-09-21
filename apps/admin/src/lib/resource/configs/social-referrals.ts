// Design Ref: 소셜관리 — 친구 추천 현황(social_referrals_v). 조회 전용.
// 추천 기록은 apply_referral RPC 가 가입 7일 이내 1회만 남긴다(수정 불가).
import type { ColumnDef } from '@tanstack/react-table';
import type { ResourceConfig } from '@/lib/resource/types';
import { fmtDateTime } from './point-ledger';

export interface SocialReferralRow {
  id: string;
  name: string | null;
  email: string | null;
  social_code: string | null;
  country: string | null;
  created_at: string;
  referred_at: string | null;
  referred_by: string;
  referrer_name: string | null;
  referrer_email: string | null;
  referrer_code: string | null;
}

function memberLabel(name: string | null, email: string | null, code: string | null): string {
  if (name) return email ? `${name} · ${email}` : name;
  return email || code || '—';
}

const columns: ColumnDef<SocialReferralRow, unknown>[] = [
  { accessorKey: 'referred_at', header: '추천 등록일', cell: (c) => fmtDateTime(c.getValue()) },
  {
    id: 'referrer',
    header: '추천한 회원',
    cell: (c) =>
      memberLabel(
        c.row.original.referrer_name,
        c.row.original.referrer_email,
        c.row.original.referrer_code,
      ),
  },
  {
    id: 'member',
    header: '가입한 회원',
    cell: (c) => memberLabel(c.row.original.name, c.row.original.email, c.row.original.social_code),
  },
  { accessorKey: 'country', header: '국가', cell: (c) => String(c.getValue() ?? '—') },
  { accessorKey: 'created_at', header: '가입일', cell: (c) => fmtDateTime(c.getValue()) },
];

export const socialReferralsConfig: ResourceConfig<SocialReferralRow> = {
  key: 'social-referrals',
  table: 'social_referrals_v',
  title: '추천 현황',
  canCreate: false,
  defaultSort: { column: 'referred_at', asc: false },
  listColumns: columns,
  filters: [
    {
      name: 'q',
      label: '회원 이메일/이름/코드 검색',
      kind: 'search',
      searchColumns: ['name', 'email', 'social_code', 'referrer_name', 'referrer_email', 'referrer_code'],
    },
  ],
  formFields: [],
};
