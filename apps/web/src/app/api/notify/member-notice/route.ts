// 운영자 알림 웹푸시 — 어드민이 알림을 보낸 직후 이 라우트를 부른다. 사람이 여는 곳이 아니다.
//
// 왜 앱이 보내는가: VAPID 키(웹푸시 서명)는 이 앱의 환경변수에만 있다. 어드민에서 바로 쏘려면
// 키와 암호화 코드를 한 벌 더 두어야 해서, 발송은 여기 한 곳으로 모은다.
//
// 왜 묶음(batch) 단위인가: 전체 발송이면 회원 수만큼 행이 생긴다. 행마다 DB 트리거로 HTTP 를
// 쏘면 수천 번이 된다. 어드민이 한 번만 부르고, 여기서 그 묶음의 대상 전원에게 보낸다.
//
// 알림 자체(사이트 안 카드·알림함)는 DB INSERT 로 이미 끝나 있다. 여기서 실패해도
// 회원은 사이트에서 알림을 본다 — 푸시는 '닫아둔 사람에게도'를 위한 덤이다.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyUser } from '@/lib/push/notify-user';
import { localizeNotice } from '@/components/notices/localize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 쿠폰 웹훅(0064)과 같은 시크릿을 쓴다 — 서버 대 서버 호출은 이 하나로 통일. */
function authorized(req: Request): boolean {
  const expected = process.env.NOTIFY_WEBHOOK_SECRET ?? '';
  if (!expected) return false;
  return req.headers.get('x-notify-secret') === expected;
}

interface NoticeRow {
  user_id: string;
  title: string;
  body: string;
  link_url: string | null;
  icon_url: string | null;
  title_en: string | null;
  body_en: string | null;
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body: { batchId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const batchId = (body.batchId ?? '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(batchId)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: true, sent: 0, reason: 'no_service_role' });

  // 받는 사람 목록은 알림 행에서 그대로 읽는다 — 요청 본문에는 식별자만 오므로
  // 내용을 URL 밖으로 흘리지 않는다(쿠폰 웹훅과 같은 규칙).
  const { data, error } = await admin
    .from('member_notices')
    .select('user_id, title, body, title_en, body_en, link_url, icon_url')
    .eq('batch_id', batchId);
  if (error) return NextResponse.json({ error: 'query_failed' }, { status: 500 });

  const rows = (data ?? []) as NoticeRow[];
  if (rows.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  // 홈 화면 아이콘에 얹을 안읽음 수 — 받는 사람별로 센다.
  // 방금 넣은 알림까지 포함해야 아이콘 숫자와 사이트의 종 배지가 같은 값이 된다.
  // in() 은 URL 길이 제한이 있어 잘라서 묻는다 — 전체 발송이면 대상이 수천 명이다.
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const unread = new Map<string, number>();
  // 회원 언어(profiles.locale) — 영어 회원에게는 영어 판으로, 알림함 링크도 그 언어로.
  const locales = new Map<string, string>();
  const CHUNK = 300;
  const chunks: string[][] = [];
  for (let i = 0; i < userIds.length; i += CHUNK) chunks.push(userIds.slice(i, i + CHUNK));
  await Promise.all(
    chunks.map(async (ids) => {
      const [{ data: u }, { data: p }] = await Promise.all([
        admin.from('member_notices').select('user_id').is('read_at', null).in('user_id', ids),
        admin.from('profiles').select('id, locale').in('id', ids),
      ]);
      for (const row of (u ?? []) as { user_id: string }[]) {
        unread.set(row.user_id, (unread.get(row.user_id) ?? 0) + 1);
      }
      for (const row of (p ?? []) as { id: string; locale: string | null }[]) {
        if (row.locale) locales.set(row.id, row.locale);
      }
    }),
  );

  // 기기가 없는(푸시 미구독) 회원은 notifyUser 가 0 을 돌려준다 — 실패가 아니다.
  const counts = await Promise.all(
    rows.map((r) => {
      const locale = locales.get(r.user_id) === 'en' ? 'en' : 'ko';
      const text = localizeNotice(r, locale);
      return notifyUser(r.user_id, {
        title: text.title,
        body: text.body,
        url: r.link_url || `/${locale}/account/notices`,
        // 같은 묶음은 한 장으로 덮어쓴다 — 폰 알림창이 같은 공지로 도배되지 않게.
        tag: `band-notice-${batchId}`,
        badge: unread.get(r.user_id),
        // 업적 알림이면 뱃지 이미지가 알림의 큰 아이콘이 된다(0107). 없으면 앱 아이콘.
        icon: r.icon_url ?? undefined,
      }).catch(() => 0);
    }),
  );

  const sent = counts.reduce((a, b) => a + b, 0);
  return NextResponse.json({ ok: true, recipients: rows.length, sent });
}
