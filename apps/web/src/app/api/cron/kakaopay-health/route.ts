// 카카오페이 개인 송금 QR(KAKAOPAY_URL)이 살아있는지 매일 확인 — 만료/비활성화되면 nginx 404를 돌려준다.
// 보호: env CRON_SECRET 와 ?key= (또는 Authorization: Bearer) 일치해야 실행.
//       (web 의 heart-digest, admin 의 newsletter/instagram cron 과 동일한 방식)
// vercel.json crons: { "path": "/api/cron/kakaopay-health", "schedule": "0 1 * * *" } → 10:00 KST
//   ⚠️ Vercel Hobby 플랜은 cron 이 하루 1회로 제한된다. 주기를 더 잦게 바꾸면 배포가 막힌다.
import { NextResponse } from 'next/server';
import { notifyAdminAlert } from '@123band/shared';
import { KAKAOPAY_URL } from '@/lib/payments/transfer-info';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET 미설정' }, { status: 503 });
  const url = new URL(req.url);
  const key =
    url.searchParams.get('key') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (key !== secret) return NextResponse.json({ error: '권한 없음' }, { status: 401 });

  let ok = false;
  let detail = '';
  try {
    const res = await fetch(KAKAOPAY_URL, { method: 'GET', redirect: 'follow' });
    ok = res.ok;
    detail = `HTTP ${res.status}`;
  } catch (err) {
    detail = err instanceof Error ? err.message : String(err);
  }

  if (!ok) {
    await notifyAdminAlert('카카오페이 송금 QR 링크가 죽었습니다', [
      `체크아웃/주문내역의 카카오페이 송금 QR(${KAKAOPAY_URL})이 정상 응답하지 않습니다.`,
      `응답: ${detail}`,
      `카카오페이 앱에서 새 QR을 발급받아 apps/web/src/lib/payments/transfer-info.ts 의 KAKAOPAY_URL 을 교체해 주세요.`,
    ]);
  }

  return NextResponse.json({ ok, detail, url: KAKAOPAY_URL });
}
