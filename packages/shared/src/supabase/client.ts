// Design Ref: §4.1 / §9.4 — anon 클라이언트 (RLS 적용, 브라우저/고객·오거나이저·관리자 앱)
import { DB_SCHEMA } from './schema';
import { createClient } from '@supabase/supabase-js';

/**
 * anon key 기반 Supabase 클라이언트.
 * RLS 정책 범위 내에서만 동작한다. apps/web, apps/admin 에서 사용.
 */
export function createBrowserClient(
  url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
) {
  if (!url || !anonKey) {
    throw new Error(
      'Supabase 환경변수 누락: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (.env 확인)',
    );
  }
  return createClient(url, anonKey, { db: { schema: DB_SCHEMA } });
}
