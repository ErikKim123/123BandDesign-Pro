// 스위처 콘솔 — /live/{방송id}/switcher
// 서버에서 관리자 신원만 확인해 넘기고(전환 로그의 switched_by), 조작은 전부 클라이언트에서 한다.
import { createClient } from '@/lib/supabase/server';
import { SwitcherConsole } from '@/components/live/SwitcherConsole';

export const dynamic = 'force-dynamic';

export default async function SwitcherPage({ params }: { params: { id: string } }) {
  const {
    data: { user },
  } = await createClient().auth.getUser();

  return (
    <SwitcherConsole
      broadcastId={params.id}
      userId={user?.id ?? null}
      userEmail={user?.email ?? ''}
    />
  );
}
