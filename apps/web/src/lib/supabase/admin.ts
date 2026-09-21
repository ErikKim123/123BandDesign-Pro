// service_role 클라이언트 (RLS 우회) — 서버 전용(API 라우트에서만 import). 회원 탈퇴 등 권한 작업.
// 키 미설정 시 null 반환 → 호출부에서 안내. ⚠️ 절대 클라이언트 컴포넌트에서 import 금지.
import { DB_SCHEMA } from '@123band/shared/supabase/schema';
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    db: { schema: DB_SCHEMA },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
