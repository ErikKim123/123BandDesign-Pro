// 하트를 준 직후 받는 사람에게 웹푸시를 쏜다.
//
// 하트 자체는 클라이언트가 give_social_heart RPC 로 직접 넣는다(판정이 전부 DB 에 있다).
// 그래서 발송을 DB 트리거가 아니라 이 라우트로 뺐다 — 트리거에서 HTTP 를 쏘려면 pg_net 을
// 켜고 DB 안에 서버 시크릿을 둬야 하는데, 얻는 것에 비해 운영 부담이 크다.
//
// 남용 방지: "방금(2분 이내) 내가 그 사람에게 하트를 준 기록"이 실제로 있을 때만 보낸다.
// 즉 이 라우트만 반복 호출해서 남에게 알림을 퍼붓는 건 불가능하다.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyUser } from '@/lib/push/notify-user';
import { reactionEmoji } from '@/lib/social/reactions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 푸시 본문은 서버가 발송 시점에 만든다. 받는 사람의 언어를 서버가 알 방법이 없어
// (프로필에 언어 컬럼이 없다) 보낸 쪽 화면의 로케일을 따른다 — 같은 현장에 있는 두 사람이라
// 대체로 일치한다. 문구가 늘어나면 i18n 사전으로 옮길 것.
const TEXT = {
  ko: {
    title: (emoji: string) => `${emoji} 반응을 받았어요`,
    body: (who: string) => `${who} 님이 반응을 보냈어요`,
  },
  en: {
    title: (emoji: string) => `${emoji} You got a reaction`,
    body: (who: string) => `${who} sent you a reaction`,
  },
} as const;

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { code?: string; locale?: string; kind?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const code = String(body.code ?? '').trim().toUpperCase();
  if (!code) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const locale = body.locale === 'ko' ? 'ko' : 'en';

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: true, sent: 0, reason: 'no_service_role' });

  // 받는 사람 찾기
  const { data: target } = await admin
    .from('profiles')
    .select('id, role')
    .eq('social_code', code)
    .maybeSingle();
  if (!target || target.role !== 'customer' || target.id === user.id) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no_target' });
  }

  // 방금 준 하트가 실제로 있는지 확인 — 이게 이 라우트의 인가 조건이다.
  const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { count } = await admin
    .from('social_hearts')
    .select('id', { count: 'exact', head: true })
    .eq('from_user_id', user.id)
    .eq('to_user_id', target.id)
    .gte('created_at', since);
  if (!count) return NextResponse.json({ ok: true, sent: 0, reason: 'no_recent_heart' });

  // 보낸 사람 표시 이름 — 없으면 코드로 대체(이메일은 절대 노출하지 않는다).
  const { data: me } = await admin
    .from('profiles')
    .select('name, social_code')
    .eq('id', user.id)
    .maybeSingle();
  const who = (me?.name ?? '').trim() || me?.social_code || '?';

  const t = TEXT[locale];
  const sent = await notifyUser(target.id, {
    title: t.title(reactionEmoji(body.kind)),
    body: t.body(who),
    url: `/${locale}/account/social`,
    // 하트마다 다른 tag — 같은 tag 로 덮어쓰면 알림이 늘 1개라 삼성·안드로이드 런처가 아이콘에 숫자를 못 센다
    // (안드로이드 웹앱은 Badging API 가 없고, 런처가 떠 있는 알림 수로 숫자를 매긴다). 4개 이상은 OS 가 묶는다.
    tag: `band-heart-${Date.now()}`,
  });

  return NextResponse.json({ ok: true, sent });
}
