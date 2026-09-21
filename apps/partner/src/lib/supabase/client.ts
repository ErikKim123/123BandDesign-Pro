// Design Ref: §4 — 브라우저 Supabase 클라이언트 (anon 키, RLS 적용)
'use client';
import { DB_SCHEMA } from '@123band/shared/supabase/schema';
import { createBrowserClient } from '@supabase/ssr';
import { PARTNER_AUTH_COOKIE } from './cookie';

// 싱글톤 — 여러 GoTrueClient 인스턴스의 락 경쟁(로그인 교착) 방지
let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (browserClient) return browserClient;
  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // admin/web 과 세션이 섞이지 않도록 전용 쿠키명 사용 (cookieOptions.name → storageKey)
    { db: { schema: DB_SCHEMA }, cookieOptions: { name: PARTNER_AUTH_COOKIE } },
  );
  return browserClient;
}
