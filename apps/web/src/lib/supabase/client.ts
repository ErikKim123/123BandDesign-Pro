// Design Ref: §4 — 브라우저 Supabase 클라이언트 (anon 키, RLS). 고객 로그인/주문용.
'use client';
import { DB_SCHEMA } from '@123band/shared/supabase/schema';
import { createBrowserClient } from '@supabase/ssr';
import { WEB_AUTH_COOKIE } from './cookie';

// ⚠️ 싱글톤. 컴포넌트마다 새 인스턴스를 만들면 같은 storageKey 의 gotrue 락(navigator.locks)을
//    여러 GoTrueClient 가 경쟁해 signInWithPassword 등이 교착(버튼 멈춤)될 수 있다.
//    브라우저에서는 하나의 인스턴스를 공유한다.
let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (browserClient) return browserClient;
  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // admin/partner 와 세션이 섞이지 않도록 전용 쿠키명 사용 (cookieOptions.name → storageKey)
    { db: { schema: DB_SCHEMA }, cookieOptions: { name: WEB_AUTH_COOKIE } },
  );
  return browserClient;
}
