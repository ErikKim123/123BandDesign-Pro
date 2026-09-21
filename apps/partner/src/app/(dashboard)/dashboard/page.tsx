// 오거나이저 대시보드 — 서버에서 인증/집계 후 클라이언트 뷰(DashboardView)에 주입.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getPartnerStats } from '@/lib/queries/partner-stats';
import { DashboardView } from './DashboardView';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const stats = await getPartnerStats(user.id);
  return <DashboardView stats={stats} />;
}
