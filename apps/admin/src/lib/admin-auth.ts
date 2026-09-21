// 어드민 API 라우트 공통 가드 — 세션 사용자가 profiles.role='admin' 인지 검증.
// 성공 시 RLS 가 걸린 supabase 서버 클라이언트와 adminId 를 함께 돌려준다.
import { createClient } from '@/lib/supabase/server';

export async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: '인증이 필요합니다.', status: 401 as const };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin') {
    return { ok: false as const, error: '관리자 권한이 필요합니다.', status: 403 as const };
  }
  return { ok: true as const, supabase, adminId: user.id };
}
