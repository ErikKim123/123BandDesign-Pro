// 운영자가 일반회원/관리자 계정을 직접 생성 — auth 사용자 + profiles 행.
// 오거나이저 생성(/api/partners/create)과 동일 패턴: admin 세션 검증 후 DATABASE_URL 직접연결.
import { NextResponse } from 'next/server';
import { notifyAdminSignup, type SignupKind } from '@123band/shared';
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
  return { ok: true as const };
}

// 회원관리에서 만들 수 있는 역할 — 오거나이저는 '오거나이저관리'에서 생성.
const ROLES = ['customer', 'admin'];

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }

  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const name = body.name ? String(body.name).trim() : null;
  const phone = body.phone ? String(body.phone).trim() : null;
  const country = body.country ? String(body.country).trim().toUpperCase() : null; // ISO2
  const role = ROLES.includes(String(body.role)) ? String(body.role) : 'customer';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: '올바른 이메일을 입력하세요.' }, { status: 400 });
  if (password.length < 8)
    return NextResponse.json({ error: '비밀번호는 8자 이상이어야 합니다.' }, { status: 400 });

  try {
    const result = await withPg(async (c) => {
      await c.query('begin');
      try {
        await c.query('set search_path = band123, extensions, auth');

        const dup = await c.query('select 1 from auth.users where lower(email) = $1 limit 1', [email]);
        if (dup.rowCount) {
          await c.query('rollback');
          return { conflict: true as const };
        }

        const u = await c.query<{ id: string }>(
          `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
             raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
             confirmation_token, recovery_token, email_change_token_new, email_change)
           values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', $1,
             crypt($2, gen_salt('bf')), now(),
             '{"provider":"email","providers":["email"]}'::jsonb, '{"service":"band123"}'::jsonb, now(), now(), '', '', '', '')
           returning id`,
          [email, password],
        );
        const id = u.rows[0]?.id;
        if (!id) throw new Error('사용자 생성에 실패했습니다.');

        await c.query(
          `insert into auth.identities (id, user_id, identity_data, provider, provider_id,
             last_sign_in_at, created_at, updated_at)
           values (gen_random_uuid(), $1::uuid, jsonb_build_object('sub', $1::text, 'email', $2::text), 'email', $1::text,
             now(), now(), now())`,
          [id, email],
        );
        await c.query(
          `insert into band123.profiles (id, email, role, name, phone, country)
           values ($1, $2, $3, $4, $5, $6)
           on conflict (id) do update set role = excluded.role, email = excluded.email,
             name = excluded.name, phone = excluded.phone, country = excluded.country`,
          [id, email, role, name, phone, country],
        );

        await c.query('commit');
        return { conflict: false as const, id };
      } catch (e) {
        await c.query('rollback');
        throw e;
      }
    });

    if (result.conflict) {
      return NextResponse.json({ error: '이미 존재하는 이메일입니다.' }, { status: 409 });
    }
    // 운영자에게 신규 회원 가입 알림 (실패해도 생성은 성공 처리)
    await notifyAdminSignup(role as SignupKind, { email, name });
    return NextResponse.json({ ok: true, userId: result.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '회원 생성 실패' },
      { status: 500 },
    );
  }
}
