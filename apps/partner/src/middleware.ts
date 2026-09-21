// Design Ref: §4.2 — 세션 라우트 가드 (1차 방어). role 체크는 (dashboard)/layout 에서.
import { isBand123Member } from '@123band/shared/supabase/schema';
import { DB_SCHEMA } from '@123band/shared/supabase/schema';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { PARTNER_AUTH_COOKIE } from '@/lib/supabase/cookie';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 환경변수 누락 시 가드 스킵 (500/MIDDLEWARE_INVOCATION_FAILED 방지).
  // 로그인 페이지는 떠야 사용자가 설정 누락을 인지할 수 있다.
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next();
  }

  try {
    let response = NextResponse.next({ request });

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      // admin/web 과 세션이 섞이지 않도록 전용 쿠키명 사용
      db: { schema: DB_SCHEMA },

      cookieOptions: { name: PARTNER_AUTH_COOKIE },
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

    const {
      data: { user },
    } = await supabase.auth.getUser();
    // 로그인 계정은 울프·JNJ 와 공유한다 — 123Band 회원이 아닌 세션은 이 기기에서만 끊고 로그인으로.
    // (scope: 'local' — 기본값 global 은 울프 쪽 세션까지 전부 끊는다)
    if (user && !isBand123Member(user)) {
      await supabase.auth.signOut({ scope: 'local' });
      if (request.nextUrl.pathname.startsWith('/login')) return response;
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.search = '?error=not_member';
      const redirect = NextResponse.redirect(url);
      response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
      return redirect;
    }
    const { pathname } = request.nextUrl;
    // 로그인·가입은 공개 경로 (미인증도 접근 가능)
    const isPublic = pathname.startsWith('/login') || pathname.startsWith('/signup');

    // 미인증 + 보호 경로 → 로그인
    if (!user && !isPublic) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    // 인증됨 + 가입 페이지 → 대시보드. 이미 계정이 있는 사람이 볼 화면이 아니다.
    //
    // 로그인(/login)은 되돌리지 않는다 — 여기가 오거나이저의 '입장 문'이라, 로그인된 채로 와도
    // 화면에 머물러 '어느 계정으로 들어가는지' 보고 직접 눌러 들어가게 한다(page.tsx 의 들어가기 카드).
    // ?error 가 붙은 경우(layout 가드가 forbidden 으로 되돌림)도 그대로 렌더해 안내를 보여준다 —
    // 안 그러면 layout↔middleware 가 무한 리다이렉트에 빠진다.
    if (user && pathname.startsWith('/signup') && !request.nextUrl.searchParams.has('error')) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
    return response;
  } catch {
    // 세션 조회 실패해도 페이지는 렌더 (가드는 (dashboard)/layout 에서 2차 방어)
    return NextResponse.next();
  }
}

export const config = {
  // 정적 파일/이미지 + API(route 자체 가드) 제외
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
