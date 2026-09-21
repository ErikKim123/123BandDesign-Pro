// 회원 로그인 상태 조회 — auth.users.last_sign_in_at + auth.sessions(활성 세션) 집계.
// auth 스키마 조회는 권한 작업이므로 (1) admin 세션 검증 후 (2) DATABASE_URL 직접연결(withPg).
// 주의: Supabase 는 로그아웃 없이 브라우저를 닫으면 세션 행이 남는다 →
// "로그인 중" 판별은 세션 존재가 아니라 마지막 토큰 갱신 시각(last_active_at) 기준으로 클라이언트가 한다.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { withPg } from '@/lib/db';

export const dynamic = 'force-dynamic';

export interface LoginStatusRow {
  id: string;
  last_sign_in_at: string | null; // 최근 로그인 시각
  last_active_at: string | null; // 활성 세션의 마지막 활동(토큰 갱신) 시각
  active_sessions: number; // 만료되지 않은 세션 수 (로그아웃 시 0)
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const users = await withPg(async (c) => {
      const r = await c.query(`
        select u.id::text as id,
               u.last_sign_in_at,
               max(greatest(coalesce(s.refreshed_at, s.created_at), s.updated_at)) as last_active_at,
               count(s.id)::int as active_sessions
        from auth.users u
        left join auth.sessions s
          on s.user_id = u.id and (s.not_after is null or s.not_after > now())
        -- 로그인 계정은 울프·JNJ 와 공유한다 — 123Band 회원만
        where (u.raw_app_meta_data -> 'services') ? 'band123'
        group by u.id, u.last_sign_in_at
      `);
      return r.rows as unknown as LoginStatusRow[];
    });
    return NextResponse.json({ users });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '조회 실패' },
      { status: 500 },
    );
  }
}
