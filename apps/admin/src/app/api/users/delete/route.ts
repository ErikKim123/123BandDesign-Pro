// 운영자가 회원 계정을 완전 삭제 — auth.users 삭제(연쇄로 profiles/partners 제거).
// 권한 작업: (1) admin 세션 검증 후 (2) DATABASE_URL 직접연결(withPg). 본인 계정은 삭제 불가.
// 주문 등 참조(FK)가 있으면 삭제 불가 → 친절한 안내(대신 '차단' 사용 권장).
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
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    return NextResponse.json({ error: '잘못된 사용자 ID 입니다.' }, { status: 400 });
  }
  if (userId === auth.adminId) {
    return NextResponse.json({ error: '본인 계정은 삭제할 수 없습니다.' }, { status: 400 });
  }

  try {
    await withPg(async (c) => {
      await c.query('set search_path = band123, auth');
      // 로그인 계정은 울프·JNJ 와 공유한다 — 123Band 에서만 쓰는 계정만 삭제할 수 있다.
      const { rowCount } = await c.query(
        `delete from auth.users
          where id = $1
            and raw_app_meta_data -> 'services' = '["band123"]'::jsonb`,
        [userId],
      );
      if (!rowCount) throw new Error('대상 계정이 없거나 123Band 전용 계정이 아니라 삭제할 수 없습니다.');
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    // 23503 = foreign_key_violation: 주문/참조가 있어 삭제 불가
    if (/foreign key|23503/i.test(msg)) {
      return NextResponse.json(
        { error: '주문 등 참조 데이터가 있어 완전 삭제할 수 없어요. 대신 "차단"을 사용하세요.' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: msg || '삭제 실패' }, { status: 500 });
  }
}
