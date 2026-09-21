// 운영자 알림 메일 수신자 — 조회/저장. 관리자 전용.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { readNotifyEmails, writeNotifyEmails } from '@/lib/settings/notify-emails';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    return NextResponse.json({ emails: await readNotifyEmails(auth.supabase) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '설정을 불러오지 못했습니다.' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { emails?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }

  try {
    const emails = await writeNotifyEmails(
      auth.supabase,
      Array.isArray(body.emails) ? body.emails.map((e) => String(e ?? '')) : [],
    );
    return NextResponse.json({ ok: true, emails });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '저장에 실패했습니다.' },
      { status: 500 },
    );
  }
}
