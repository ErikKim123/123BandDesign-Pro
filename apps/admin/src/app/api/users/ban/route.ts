// 운영자가 회원/오거나이저 로그인 계정을 차단/해제 — auth.users.banned_until 변경.
// 차단은 권한 작업이므로 (1) admin 세션 검증 후 (2) DATABASE_URL 직접연결(withPg).
// 차단은 영구가 아니라 해제 가능. 본인 계정은 차단 불가(자가 잠금 방지).
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withPg } from '@/lib/db';

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: '인증이 필요합니다.', status: 401 as const };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin') {
    return { ok: false as const, error: '관리자 권한이 필요합니다.', status: 403 as const };
  }
  return { ok: true as const, adminId: user.id };
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }

  const userId = String(body.userId ?? '');
  const ban = Boolean(body.ban);
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    return NextResponse.json({ error: '잘못된 사용자 ID 입니다.' }, { status: 400 });
  }
  if (ban && userId === auth.adminId) {
    return NextResponse.json({ error: '본인 계정은 차단할 수 없습니다.' }, { status: 400 });
  }

  // 차단: 먼 미래(~100년), 해제: null
  const until = ban ? '2125-01-01T00:00:00Z' : null;
  try {
    await withPg(async (c) => {
      await c.query('set search_path = band123, auth');
      // 로그인 계정은 울프·JNJ 와 공유한다 — 123Band 에서만 쓰는 계정만 차단할 수 있다.
      const { rowCount } = await c.query(
        `update auth.users set banned_until = $2
          where id = $1
            and raw_app_meta_data -> 'services' = '["band123"]'::jsonb`,
        [userId, until],
      );
      if (!rowCount) throw new Error('123Band 전용 계정이 아니라 차단할 수 없습니다.');
    });
    return NextResponse.json({ ok: true, banned: ban });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '처리 실패' },
      { status: 500 },
    );
  }
}
