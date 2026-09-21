// 하트 요약 메일 — 하루 1회. 하트 하나마다 메일을 보내면 스팸이 되므로 전날치를 묶어 보낸다.
// 보호: env CRON_SECRET 와 ?key= (또는 Authorization: Bearer) 일치해야 실행.
//       (admin 앱의 newsletter/instagram cron 과 동일한 방식)
// vercel.json crons: { "path": "/api/cron/heart-digest", "schedule": "0 0 * * *" } → 09:00 KST
//   ⚠️ Vercel Hobby 플랜은 cron 이 하루 1회로 제한된다. 주기를 더 잦게 바꾸면 배포가 막힌다.
import { NextResponse } from 'next/server';
import { sendUserEmail, tryRenderTemplate, wrapUserHtml, stripHtml } from '@123band/shared';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DigestRow {
  user_id: string;
  email: string;
  name: string | null;
  heart_count: number;
  giver_names: string[] | null;
}

/** KST 기준 날짜 문자열(YYYY-MM-DD). social_hearts.created_date 가 KST 기준이라 맞춰야 한다. */
function kstDate(offsetDays = 0): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET 미설정' }, { status: 503 });
  const url = new URL(req.url);
  const key =
    url.searchParams.get('key') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (key !== secret) return NextResponse.json({ error: '권한 없음' }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY 미설정' }, { status: 503 });
  }

  // 기본은 어제(KST). ?date=YYYY-MM-DD 로 특정 날짜 재발송 가능(운영 중 누락 복구용).
  const date = url.searchParams.get('date') || kstDate(-1);

  const { data, error } = await admin.rpc('heart_digest', { p_date: date });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as DigestRow[];
  let sent = 0;

  for (const row of rows) {
    const names = (row.giver_names ?? []).filter(Boolean);
    const who = names.length > 0 ? names.join(', ') : '';
    const more = row.heart_count > names.length ? ` 외 ${row.heart_count - names.length}명` : '';

    const html = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6">
      <p style="margin:4px 0">${row.name ? `${row.name} 님, ` : ''}어제 하트 <b>${row.heart_count}개</b>를 받았어요.</p>
      ${who ? `<p style="margin:4px 0;color:#555">보낸 사람: ${who}${more}</p>` : ''}
      <p style="margin:16px 0 4px">
        <a href="https://123band-web.vercel.app/ko/account/social"
           style="display:inline-block;background:#fa520f;color:#fff;text-decoration:none;padding:10px 18px;border-radius:24px;font-weight:600">
          소셜 탭에서 보기
        </a>
      </p>
      <p style="margin:12px 0 0;color:#888;font-size:12px">
        이 메일이 필요 없으면 마이페이지 &gt; 소셜 탭의 알림 설정에서 끌 수 있습니다.
      </p>
    </div>`;

    // 어드민 '메일링 관리' 템플릿이 있으면 그걸로, 없으면 위 하드코딩 본문(폴백).
    const tpl = await tryRenderTemplate(
      'user_heart_digest',
      {
        name: row.name ?? '',
        heartCount: row.heart_count,
        who,
        more,
        socialUrl: 'https://123band-web.vercel.app/ko/account/social',
      },
      'ko',
    );
    const subject = tpl?.subject ?? `[123Band] 어제 받은 하트 ${row.heart_count}개`;
    const body = tpl ? wrapUserHtml(tpl.html) : html;

    if (await sendUserEmail(row.email, subject, body, tpl ? stripHtml(tpl.html) : undefined)) {
      sent += 1;
    }
  }

  return NextResponse.json({ ok: true, date, recipients: rows.length, sent });
}
