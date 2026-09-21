// Design Ref: 업적관리 — 회원 획득 현황(user_achievements). 조회 전용.
import type { ColumnDef } from '@tanstack/react-table';
import type { ResourceConfig } from '@/lib/resource/types';
import { fmtDateTime } from './point-ledger';

export interface UserAchievementRow {
  id: string;
  earned_at: string;
  user?: { name: string | null; email: string | null } | null;
  achievement?: { code: string; name_i18n: Record<string, string>; badge_image_url: string | null } | null;
}

const columns: ColumnDef<UserAchievementRow, unknown>[] = [
  { accessorKey: 'earned_at', header: '획득일시', cell: (c) => fmtDateTime(c.getValue()) },
  {
    id: 'member',
    header: '회원',
    cell: (c) => {
      const u = c.row.original.user;
      return u?.email ? (u.name ? `${u.name} · ${u.email}` : u.email) : '—';
    },
  },
  {
    id: 'achievement',
    header: '업적',
    cell: (c) => {
      const a = c.row.original.achievement;
      return a?.name_i18n?.ko || a?.code || '—';
    },
  },
  {
    id: 'badge',
    header: '뱃지',
    cell: (c) => (c.row.original.achievement?.badge_image_url ? '등록됨' : '미등록'),
  },
];

export const userAchievementsConfig: ResourceConfig<UserAchievementRow> = {
  key: 'user-achievements',
  table: 'user_achievements',
  title: '회원 획득 현황',
  canCreate: false,
  selectColumns:
    'id, earned_at, user:profiles!user_id(name, email), ' +
    'achievement:achievements!achievement_id(code, name_i18n, badge_image_url)',
  defaultSort: { column: 'earned_at', asc: false },
  listColumns: columns,
  filters: [{ name: 'q', label: '회원 이메일/이름 검색', kind: 'search' }],
  formFields: [],
  buildSearchOr: async (term, supabase) => {
    const like = `%${term}%`;
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .or(`name.ilike.${like},email.ilike.${like}`)
      .limit(500);
    const ids = (data as { id: string }[] | null)?.map((r) => r.id) ?? [];
    return [`user_id.in.(${ids.length ? ids.join(',') : '00000000-0000-0000-0000-000000000000'})`];
  },
};
