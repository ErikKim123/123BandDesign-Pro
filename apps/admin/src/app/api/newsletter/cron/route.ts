// 예약 뉴스레터 자동 발송 — Vercel Cron 등에서 주기 호출. 세션이 없으므로 DATABASE_URL 직접연결.
// 보호: env CRON_SECRET 와 ?key= (또는 Authorization: Bearer) 일치해야 실행.
// vercel.json crons 예: { "path": "/api/newsletter/cron?key=...", "schedule": "*/10 * * * *" }
import { NextResponse } from 'next/server';
import { withPg } from '@/lib/db';
import { brevoBulkSend, wrapNewsletterHtmlAsync } from '@/lib/newsletter';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET 미설정' }, { status: 503 });
  const url = new URL(req.url);
  const key = url.searchParams.get('key') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (key !== secret) return NextResponse.json({ error: '권한 없음' }, { status: 401 });

  try {
    const result = await withPg(async (c) => {
      await c.query('set search_path = band123');
      // 발송 대상: 예약시각 도래한 scheduled 뉴스레터
      const due = await c.query<{ id: string; subject: string; content_html: string }>(
        `select id, subject, content_html from band123.newsletters
         where status = 'scheduled' and scheduled_at is not null and scheduled_at <= now()
         order by scheduled_at asc limit 20`,
      );
      const subs = await c.query<{ email: string }>(
        `select email from band123.newsletter_subscribers where email is not null`,
      );
      const emails = subs.rows.map((r) => r.email).filter(Boolean);

      const sent: { id: string; count: number }[] = [];
      for (const nl of due.rows) {
        if (emails.length === 0) break;
        const count = await brevoBulkSend(emails, nl.subject, await wrapNewsletterHtmlAsync(nl.content_html, nl.subject));
        await c.query(
          `update band123.newsletters set status='sent', sent_at=now(), recipient_count=$2, updated_at=now() where id=$1`,
          [nl.id, count],
        );
        sent.push({ id: nl.id, count });
      }
      return sent;
    });
    return NextResponse.json({ ok: true, sent: result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'cron 실패' },
      { status: 500 },
    );
  }
}
