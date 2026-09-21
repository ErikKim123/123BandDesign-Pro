// Design Ref: §4.1 / §7 — service_role 클라이언트 (RLS 우회, 서버 전용)
// ⚠️ 절대 브라우저 번들에 포함 금지. apps/api(NestJS)·배치/적재 스크립트에서만.
import { createClient } from '@supabase/supabase-js';
import { DB_SCHEMA } from './schema';

/**
 * service_role key 기반 Supabase 클라이언트. RLS 를 우회하여 전체 접근.
 * NEXT_PUBLIC_ 접두사가 붙은 곳(클라이언트)에서 호출되면 안 된다.
 */
export function createAdminClient(
  url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY,
) {
  if (typeof window !== 'undefined') {
    throw new Error(
      'createAdminClient 는 서버 전용입니다. 브라우저에서 service_role 키 사용 금지.',
    );
  }
  if (!url || !serviceRoleKey) {
    throw new Error(
      'Supabase 환경변수 누락: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (.env 확인)',
    );
  }
  return createClient(url, serviceRoleKey, {
    db: { schema: DB_SCHEMA },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
