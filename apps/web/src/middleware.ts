// Design Ref: §6 — locale 라우팅 + §4.2 세션 갱신.
// (1) /경로 에 활성 locale 없으면 기본 locale(en)로 리다이렉트.
// (2) @supabase/ssr 권장 패턴: 매 요청에서 getUser() 로 세션 토큰을 갱신하고 쿠키를 재기록.
//     이게 없으면 액세스 토큰 만료 후 서버 컴포넌트(마이페이지 가드)가 세션을 못 읽어
//     "로그인했는데 마이페이지 누르면 다시 로그인" 증상이 난다.
import { isBand123Member } from '@123band/shared/supabase/schema';
import { DB_SCHEMA } from '@123band/shared/supabase/schema';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { activeLocales, defaultLocale } from '@/i18n/config';
import { SITE } from '@/lib/seo'; // canonical 호스트 단일 소스 — apex→www 정규화에 사용
import { WEB_AUTH_COOKIE, VISITOR_ID_COOKIE } from '@/lib/supabase/cookie';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// canonical 호스트(www). apex(worldoflatinfestivals.com)도 Vercel 별칭이라 200 을 내주고 있었고,
// 그 페이지의 canonical 은 www 를 가리켜 Google 이 전부 '적절한 표준 태그가 포함된 대체 페이지'로 분류했다.
// → 호스트 자체를 www 로 308 정규화해서 apex 사본을 없앤다.
const CANONICAL_HOST = new URL(SITE).host;

// 응답에 방문자 식별 쿠키가 없으면 새로 발급 — /api/track 이 이 값으로 순 방문자를 센다.
function withVisitorCookie(request: NextRequest, response: NextResponse): NextResponse {
  const existing = request.cookies.get(VISITOR_ID_COOKIE)?.value;
  if (existing && UUID_RE.test(existing)) return response;
  response.cookies.set(VISITOR_ID_COOKIE, crypto.randomUUID(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  });
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // (0) 호스트 정규화: apex/기타 별칭 → canonical 호스트로 308.
  //     locale 리다이렉트보다 먼저 처리해야 apex/shop 이 apex/en/shop 을 거치지 않고 한 번에 넘어간다.
  //     프리뷰 배포(*.vercel.app)·localhost 는 건드리지 않는다 — 정확히 apex 일 때만 매칭.
  const rawHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  const host = (rawHost.split(':')[0] ?? '').toLowerCase();
  if (host && CANONICAL_HOST.startsWith('www.') && host === CANONICAL_HOST.slice(4)) {
    const url = request.nextUrl.clone();
    url.host = CANONICAL_HOST;
    url.port = '';
    url.protocol = 'https';
    return NextResponse.redirect(url, 308);
  }

  const hasLocale = activeLocales.some(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
  );

  // locale 없는 경로 → 기본 locale 로 리다이렉트 (세션 갱신 불필요)
  // SEO: 항상 defaultLocale 로 가는 '결정론적·영구' 리다이렉트이므로 308(영구) 로 반환.
  // 기본값 307(임시)이면 Google 이 로케일 없는 URL(/shop 등)을 색인에 계속 남기고
  // 순위 신호를 /en 경로로 합치지 않아 '리디렉션이 포함된 페이지'로 계속 잡힌다.
  // (주의: 추후 Accept-Language 자동 감지를 넣으면 이 리다이렉트는 상태 의존적이 되므로 307 로 되돌릴 것)
  if (!hasLocale) {
    const url = request.nextUrl.clone();
    url.pathname = `/${defaultLocale}${pathname === '/' ? '' : pathname}`;
    return NextResponse.redirect(url, 308);
  }

  // SEO: 대소문자만 다른 주소는 검색엔진에게 '다른 URL' 이다 → 소문자 정식 주소로 308.
  // 로케일 세그먼트는 건드리지 않는다 — zh-TW 처럼 대문자가 정식인 로케일이 있다(활성화 시 무한 리다이렉트 방지).
  const [, localeSeg, ...restSegs] = pathname.split('/');
  const rest = restSegs.join('/');
  if (rest && rest !== rest.toLowerCase()) {
    const url = request.nextUrl.clone();
    url.pathname = `/${localeSeg}/${rest.toLowerCase()}`;
    return NextResponse.redirect(url, 308);
  }

  // 세션 갱신 — 환경변수 없으면 스킵(페이지는 그대로 렌더)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return withVisitorCookie(request, NextResponse.next());

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    // admin/partner 와 세션 분리 — web 전용 쿠키명
    db: { schema: DB_SCHEMA },

    cookieOptions: { name: WEB_AUTH_COOKIE },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser() 가 만료 임박 토큰을 갱신하고 setAll 로 새 쿠키를 응답에 기록
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // 로그인 계정은 울프·JNJ 와 공유한다 — 123Band 회원이 아닌 세션은 이 기기에서만 끊는다(비로그인으로 계속).
  // (scope: 'local' — 기본값 global 은 울프 쪽 세션까지 전부 끊는다)
  if (user && !isBand123Member(user)) await supabase.auth.signOut({ scope: 'local' });
  return withVisitorCookie(request, response);
}

export const config = {
  // _next, 정적 파일(.확장자), api 제외 전 경로
  matcher: ['/((?!_next|api|favicon.ico|.*\\..*).*)'],
};
