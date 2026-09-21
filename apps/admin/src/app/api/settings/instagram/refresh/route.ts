// 인스타 토큰 자동 갱신 — Vercel Cron 등에서 주기 호출(하루 1회면 충분).
// 만료 14일 이내로 남았을 때만 교환해 다시 60일로 늘린다. ?force=1 이면 남은 기간과 무관하게 갱신.
// 보호: newsletter cron 과 동일하게 CRON_SECRET + ?key= (또는 Authorization: Bearer).
// vercel.json crons 예: { "path": "/api/settings/instagram/refresh?key=...", "schedule": "0 3 * * *" }
import { NextResponse } from 'next/server';
import { refreshIgTokenIfNeeded } from '@/lib/instagram/token';

export const maxDuration = 30;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET 미설정' }, { status: 503 });
  const url = new URL(req.url);
  const key = url.searchParams.get('key') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (key !== secret) return NextResponse.json({ error: '권한 없음' }, { status: 401 });

  try {
    const result = await refreshIgTokenIfNeeded({ force: url.searchParams.get('force') === '1' });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '갱신 실패' },
      { status: 500 },
    );
  }
}
