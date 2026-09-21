// Design Ref: §4.2 — 콘솔 셸. (dashboard) 와 같은 role=admin 가드를 쓰되 사이드바를 걸지 않는다.
// 스위처는 현장에서 8시간 켜 두는 전용 화면이라 한 화면을 통째로 쓴다(스크롤 없음).
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    redirect('/login?error=forbidden');
  }

  return <>{children}</>;
}
