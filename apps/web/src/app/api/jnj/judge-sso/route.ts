// 관객 심사 바로가기 — 123Band 회원을 Dash 채점 화면으로, 등록 폼도 PIN 도 없이 보낸다.
//
// 버튼이 Dash 주소를 직접 가리키지 않고 이 경로를 거치는 이유:
//   · 토큰은 '누른 순간' 만들어져야 한다(120초짜리라 페이지에 미리 심어 두면 만료된다)
//   · 회원 확인·프로필 조회는 서버에서만 할 수 있다
//   · Dash 주소와 대회 코드가 비회원의 페이지 소스에 남지 않는다
//
// 토큰에는 '누구인지' 만 담는다. PIN 은 싣지 않는다 — 링크가 새면 그 사람 이름으로
// 채점할 수 있게 되기 때문이다. 계정 생성·PIN 발급은 Dash 가 자기 쪽에서 한다.
//
// 어디서 막히든 화면이 죽지 않는다: 비밀키가 없거나 이메일이 없으면 예전처럼 등록 폼으로 보낸다.
import { NextResponse } from 'next/server';
import { createJnjSsoToken } from '@123band/shared/jnj-sso';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DASH_BASE = (process.env.NEXT_PUBLIC_JNJ_DASH_URL ?? 'https://jnj-dash-db.vercel.app').replace(
  /\/+$/,
  '',
);

const LOCALES = new Set(['en', 'ko', 'ja', 'zh-TW']);

const TOMBSTONE = '@deleted.invalid';
const sealed = (email: string) => email.toLowerCase().endsWith(TOMBSTONE);

/**
 * 이 회원을 Dash 계정에 이어줄 이메일.
 *
 * 탈퇴(익명화)를 했다가 소셜로 다시 들어온 계정은 profiles·auth 의 이메일이 봉인 주소로
 * 남아 있다. 로그인은 되는데 여기서만 막혀 '회원인데 또 등록하라고 나오는' 상태가 된다.
 * 소셜 제공자가 준 진짜 주소는 그대로 남아 있으므로, 봉인된 경우 그쪽을 쓴다.
 * (계정 자체의 복구는 로그인 콜백이 한다 — 여기서는 판단만 하고 고치지 않는다.)
 */
function resolveEmail(
  profileEmail: string | null | undefined,
  user: {
    email?: string | null;
    identities?: { identity_data?: Record<string, unknown> }[] | null;
    user_metadata?: Record<string, unknown> | null;
  },
): string {
  const pick = (raw: unknown): string => {
    const mail = typeof raw === 'string' ? raw.trim() : '';
    return mail && !sealed(mail) ? mail : '';
  };
  const direct = pick(profileEmail) || pick(user.email);
  if (direct) return direct;
  for (const id of user.identities ?? []) {
    const mail = pick(id.identity_data?.email);
    if (mail) return mail;
  }
  return pick(user.user_metadata?.email);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const contestId = (url.searchParams.get('contest') ?? '').trim();
  if (!contestId) return NextResponse.json({ error: 'contest_required' }, { status: 400 });

  const raw = url.searchParams.get('locale') ?? '';
  const locale = LOCALES.has(raw) ? raw : 'en';

  // 등록 폼으로 되돌릴 때 쓰는 주소 — SSO 가 성립하지 않는 경우의 원래 동선이다.
  //
  // why 를 달고 보낸다. 이 주소는 운영자가 예전에 저장해 둔 링크와 생김새가 똑같아서,
  // 등록 폼이 떴을 때 '오래된 페이지를 누른 것'인지 '여기서 되돌려보낸 것'인지 구분할 수가 없었다.
  // 주소창만 보면 알 수 있게 이유를 남긴다(Dash 는 모르는 쿼리를 무시한다).
  const formUrl = (why: string) =>
    `${DASH_BASE}/ojudge/${encodeURIComponent(contestId)}?why=${why}`;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // 비회원은 버튼에서 이미 로그인 안내를 받는다 — 여기까지 온 건 세션이 그사이 끊긴 경우다.
  // 로그인 후에는 왔던 J&J 페이지로 돌려보낸다.
  if (!user) {
    const back = url.searchParams.get('from') || `/${locale}/jnj`;
    return NextResponse.redirect(
      new URL(`/${locale}/login?next=${encodeURIComponent(back)}`, url.origin),
      303,
    );
  }

  const secret = process.env.JNJ_SSO_SECRET;
  // 비밀키가 없으면 SSO 를 쓸 수 없다 — 등록 폼으로. 버튼이 죽는 것보다 낫다.
  if (!secret) return NextResponse.redirect(formUrl('no-key'), 303);

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, email, phone, country, avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  // 이메일이 Dash 계정을 찾는 열쇠다. 어디에서도 쓸 만한 주소가 안 나오면 등록 폼으로.
  const email = resolveEmail(profile?.email, user);
  if (!email) return NextResponse.redirect(formUrl('no-email'), 303);

  const token = createJnjSsoToken(
    {
      email,
      // 이름은 통째로 보낸다 — 성/이름 분리는 Dash 가 자기 규칙으로 한다.
      name: (profile?.name ?? '').trim(),
      phone: (profile?.phone ?? '').trim(),
      country: (profile?.country ?? '').trim(),
      photoUrl: (profile?.avatar_url ?? '').trim(),
      contestId,
      iat: Math.floor(Date.now() / 1000),
    },
    secret,
  );

  const target = new URL(`${DASH_BASE}/ovote/${encodeURIComponent(contestId)}`);
  target.searchParams.set('t', token);
  // 303 — 브라우저가 GET 으로 따라간다.
  return NextResponse.redirect(target.toString(), 303);
}
