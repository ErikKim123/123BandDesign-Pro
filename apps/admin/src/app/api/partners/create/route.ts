// 운영자가 오거나이저 계정을 직접 생성 — auth 사용자 + profiles(role=partner) + partners 행.
// 권한 상승 작업이므로 (1) admin 세션 검증 후 (2) DATABASE_URL 직접연결로 처리.
// 비밀번호는 pgcrypto crypt(bf) 로 GoTrue 호환 해시 저장(seed.sql 과 동일 규약).
import { NextResponse } from 'next/server';
import { notifyAdminSignup } from '@123band/shared';
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

const LOCALES = ['en', 'ko', 'ja', 'zh-TW'];
const STATUSES = ['pending', 'active', 'suspended'];

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
  const companyName = String(body.company_name ?? '').trim();
  const country = body.country ? String(body.country).trim() : null;
  const bizNo = body.biz_no ? String(body.biz_no).trim() : null;
  const name = body.name ? String(body.name).trim() : companyName;
  const locale = LOCALES.includes(String(body.locale)) ? String(body.locale) : 'en';
  const status = STATUSES.includes(String(body.status)) ? String(body.status) : 'active';
  const rate = Number(body.commission_rate);

  // 검증
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: '올바른 이메일을 입력하세요.' }, { status: 400 });
  if (password.length < 8)
    return NextResponse.json({ error: '비밀번호는 8자 이상이어야 합니다.' }, { status: 400 });
  if (!companyName) return NextResponse.json({ error: '회사명을 입력하세요.' }, { status: 400 });
  if (!Number.isFinite(rate) || rate < 0 || rate > 1)
    return NextResponse.json({ error: '수수료율은 0~1 사이여야 합니다 (예: 0.15).' }, { status: 400 });

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
          `insert into band123.profiles (id, email, role, name, locale)
           values ($1, $2, 'partner', $3, $4)
           on conflict (id) do update set role = 'partner', email = excluded.email, name = excluded.name`,
          [id, email, name, locale],
        );
        await c.query(
          `insert into band123.partners (user_id, company_name, country, biz_no, commission_rate, status)
           values ($1, $2, $3, $4, $5, $6)
           on conflict (user_id) do update set
             company_name = excluded.company_name, country = excluded.country,
             biz_no = excluded.biz_no, commission_rate = excluded.commission_rate, status = excluded.status`,
          [id, companyName, country, bizNo, rate, status],
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
    // 운영자에게 신규 오거나이저 가입 알림 (실패해도 생성은 성공 처리)
    await notifyAdminSignup('partner', { email, name, company: companyName });
    return NextResponse.json({ ok: true, userId: result.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '오거나이저 생성 실패' },
      { status: 500 },
    );
  }
}
