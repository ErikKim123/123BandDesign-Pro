// Design Ref: 소셜관리 — 현황/랭킹. admin_social_stats RPC 한 번으로 요약 + 상위 목록을 받는다.
// (집계 쿼리를 브라우저에서 여러 번 돌리지 않도록 DB 함수에 모아 두었다.)
'use client';
import { useQuery } from '@tanstack/react-query';
import { Heart, Users, UserPlus, Ban } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { createClient } from '@/lib/supabase/client';

interface RankRow {
  user_id: string;
  name: string;
  count: number;
}

interface Stats {
  hearts_total: number;
  hearts_today: number;
  hearts_week: number;
  participants: number;
  referrals_total: number;
  blocked_members: number;
  top_receivers: RankRow[];
  top_givers: RankRow[];
  top_referrers: RankRow[];
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-grey-200 p-4">
      <div className="flex items-center gap-2 text-grey-500">
        {icon}
        <span className="label-caps">{label}</span>
      </div>
      <p className="mt-2 text-2xl tabular-nums">{value.toLocaleString()}</p>
      {sub && <p className="mt-0.5 text-xs text-grey-500">{sub}</p>}
    </div>
  );
}

function RankList({ title, rows }: { title: string; rows: RankRow[] }) {
  return (
    <div className="rounded-lg border border-grey-200 p-4">
      <h3 className="label-caps text-grey-500">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-grey-500">{tr('아직 데이터가 없습니다.')}</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {rows.map((r, i) => (
            <li key={`${r.user_id}-${i}`} className="flex items-center gap-3 text-sm">
              <span className="w-5 shrink-0 tabular-nums text-grey-400">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">{r.name}</span>
              <span className="shrink-0 font-medium tabular-nums">{Number(r.count).toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function SocialStats() {
  const { data, isLoading } = useQuery({
    queryKey: ['social-stats'],
    queryFn: async () => {
      const { data: raw, error } = await createClient().rpc('admin_social_stats', { p_limit: 10 });
      if (error) throw error;
      return (raw ?? null) as Stats | null;
    },
  });

  if (isLoading) return <p className="text-sm text-grey-500">{tr('불러오는 중…')}</p>;
  if (!data) return <p className="text-sm text-grey-500">{tr('아직 데이터가 없습니다.')}</p>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<Heart size={15} />}
          label={tr('전체 하트')}
          value={data.hearts_total}
          sub={`${tr('오늘')} ${data.hearts_today.toLocaleString()} · ${tr('최근 7일')} ${data.hearts_week.toLocaleString()}`}
        />
        <StatCard
          icon={<Users size={15} />}
          label={tr('참여 회원')}
          value={data.participants}
          sub={tr('하트를 주고받은 회원 수')}
        />
        <StatCard
          icon={<UserPlus size={15} />}
          label={tr('추천 가입')}
          value={data.referrals_total}
          sub={tr('추천인이 기록된 회원')}
        />
        <StatCard
          icon={<Ban size={15} />}
          label={tr('소셜 정지')}
          value={data.blocked_members}
          sub={tr('하트 주고받기 차단된 회원')}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <RankList title={tr('하트 많이 받은 회원')} rows={data.top_receivers ?? []} />
        <RankList title={tr('하트 많이 보낸 회원')} rows={data.top_givers ?? []} />
        <RankList title={tr('추천 많이 한 회원')} rows={data.top_referrers ?? []} />
      </div>
    </div>
  );
}
