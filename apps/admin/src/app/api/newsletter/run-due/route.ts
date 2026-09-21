// 예약 도래분 자동 발송 — 어드민 세션으로 호출(뉴스레터 페이지가 주기 폴링).
// scheduled_at 이 지난 scheduled 뉴스레터를 찾아 발송하고 sent 로 갱신한다.
// (운영 환경의 cron(/api/newsletter/cron)과 같은 일을 하지만, 어드민이 화면을 켜둔 동안에도 동작.)
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { deliverNewsletter } from '@/lib/newsletter';

export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const supabase = auth.supabase;

  const { data: due, error } = await supabase
    .from('newsletters')
    .select('id')
    .eq('status', 'scheduled')
    .not('scheduled_at', 'is', null)
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const processed: { id: string; count?: number; error?: string }[] = [];
  for (const row of due ?? []) {
    const id = (row as { id: string }).id;
    try {
      const count = await deliverNewsletter(supabase, id);
      processed.push({ id, count });
    } catch (err) {
      processed.push({ id, error: err instanceof Error ? err.message : '발송 실패' });
    }
  }
  return NextResponse.json({ ok: true, processed });
}
