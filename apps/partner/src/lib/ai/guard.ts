// Design Ref: §5 / §4.2 — AI 라우트 가드 (관리/오거나이저만, 비용 보호). 세션 쿠키 기반.
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

type StaffOk = { ok: true; supabase: SupabaseClient; userId: string };
type StaffErr = { ok: false; error: string; status: 401 | 403 };

export async function requireStaff(): Promise<StaffOk | StaffErr> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: '인증이 필요합니다.', status: 401 };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'admin' && profile.role !== 'partner')) {
    return { ok: false, error: '권한이 없습니다 (관리자/오거나이저 전용).', status: 403 };
  }
  return { ok: true, supabase, userId: user.id };
}
