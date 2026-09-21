// 예약 게시 자동 실행 — Vercel Cron 등에서 주기 호출(5~10분 간격 권장).
// 브라우저가 꺼져 있어도 이 경로가 예약 시각이 지난 게시물을 발행한다.
// 보호: newsletter cron 과 동일하게 CRON_SECRET + ?key= (또는 Authorization: Bearer).
// vercel.json crons 예: { "path": "/api/instagram/cron?key=...", "schedule": "*/5 * * * *" }
import { NextResponse } from 'next/server';
import { publishDuePosts } from '@/lib/instagram/posts';

// 여러 건 × 릴스 처리 대기를 감안한 여유.
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET 미설정' }, { status: 503 });
  const url = new URL(req.url);
  const key = url.searchParams.get('key') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (key !== secret) return NextResponse.json({ error: '권한 없음' }, { status: 401 });

  try {
    const results = await publishDuePosts();
    return NextResponse.json({ ok: true, processed: results.length, results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'cron 실패' },
      { status: 500 },
    );
  }
}
