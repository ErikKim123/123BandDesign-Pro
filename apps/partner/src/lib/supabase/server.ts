// Design Ref: §4.2 — 서버 Supabase 클라이언트 (SSR 쿠키 세션, layout 가드/서버 컴포넌트용)
import { DB_SCHEMA } from '@123band/shared/supabase/schema';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { PARTNER_AUTH_COOKIE } from './cookie';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // admin/web 과 세션이 섞이지 않도록 전용 쿠키명 사용
      db: { schema: DB_SCHEMA },
      cookieOptions: { name: PARTNER_AUTH_COOKIE },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component 에서 set 호출 시 무시 (middleware 가 세션 갱신 담당)
          }
        },
      },
    },
  );
}
