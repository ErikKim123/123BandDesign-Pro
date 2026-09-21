// Design Ref: §4.2 — role=admin 서버 가드 (2차 방어, RLS가 3차) + 반응형 셸
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdminSidebar } from '@/components/layout/AdminSidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Plan SC: 비-admin 차단 — profiles.role 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    redirect('/login?error=forbidden');
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AdminSidebar email={profile.email ?? user.email ?? ''} />
      <main className="flex-1 overflow-x-auto p-4 md:p-8">{children}</main>
    </div>
  );
}
