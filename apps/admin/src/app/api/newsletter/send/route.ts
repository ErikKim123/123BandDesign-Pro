// 뉴스레터 발송/예약/수정 — 어드민 전용.
// 신규: { subject, content_html, scheduled_at? }
//   - scheduled_at 이 미래면 발송하지 않고 scheduled 로 저장(예약), 아니면 즉시 발송.
// 기존: { id, subject?, content_html?, scheduled_at? }
//   - subject/content_html 이 오면 먼저 그 값으로 갱신(저장된 HTML 수정).
//   - scheduled_at 이 미래면 scheduled 로 예약, 아니면 즉시 발송.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { deliverNewsletter } from '@/lib/newsletter';

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const supabase = auth.supabase;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }

  let id = typeof body.id === 'string' ? body.id : null;

  // 예약 시각 파싱(미래면 예약, 아니면 즉시)
  const scheduledRaw = body.scheduled_at ? String(body.scheduled_at) : '';
  const scheduledAt = scheduledRaw ? new Date(scheduledRaw) : null;
  const validSchedule = scheduledAt && !Number.isNaN(scheduledAt.getTime());
  const isFuture = !!(validSchedule && scheduledAt!.getTime() > Date.now());
  const scheduleIso = validSchedule ? scheduledAt!.toISOString() : null;

  const hasSubject = typeof body.subject === 'string';
  const hasContent = typeof body.content_html === 'string';
  const subject = hasSubject ? String(body.subject).trim() : '';
  const contentHtml = hasContent ? String(body.content_html) : '';

  if (!id) {
    // 신규 작성 — 행 생성(예약 미래면 scheduled, 아니면 draft 로 만들어 바로 발송)
    if (!subject) return NextResponse.json({ error: '제목을 입력하세요.' }, { status: 400 });
    const { data, error } = await supabase
      .from('newsletters')
      .insert({
        subject,
        content_html: contentHtml,
        status: isFuture ? 'scheduled' : 'draft',
        scheduled_at: scheduleIso,
      })
      .select('id')
      .single();
    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? '저장 실패' }, { status: 500 });
    }
    if (isFuture) return NextResponse.json({ ok: true, scheduled: true, id: data.id });
    id = data.id as string;
  } else {
    // 기존 행 — 들어온 필드만 갱신(저장된 HTML 편집/예약시각 변경)
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (hasSubject) {
      if (!subject) return NextResponse.json({ error: '제목을 입력하세요.' }, { status: 400 });
      updates.subject = subject;
    }
    if (hasContent) updates.content_html = contentHtml;
    if (isFuture) {
      updates.status = 'scheduled';
      updates.scheduled_at = scheduleIso;
    } else if (scheduledRaw === '') {
      // 예약 비움 → 예약 해제(즉시 발송 경로)
      updates.scheduled_at = null;
    }
    const { error } = await supabase.from('newsletters').update(updates).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (isFuture) return NextResponse.json({ ok: true, scheduled: true, id });
  }

  try {
    const count = await deliverNewsletter(supabase, id);
    return NextResponse.json({ ok: true, count, id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '발송 실패' },
      { status: 502 },
    );
  }
}
