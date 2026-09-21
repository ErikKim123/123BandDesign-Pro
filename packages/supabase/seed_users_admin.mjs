// 테스트용 고객(customer) 계정 5개 추가 시드.
// DATABASE_URL(직접 postgres 연결) 사용 — RLS/권한 우회로 auth.users 까지 생성.
// idempotent: 고정 UUID + on conflict.
//
// 사용법: node packages/supabase/seed_users_admin.mjs
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

const env = readFileSync(join(ROOT, '.env'), 'utf8');
const DATABASE_URL = env.match(/DATABASE_URL\s*=\s*"?([^"\n\r]+)/)?.[1];
if (!DATABASE_URL) throw new Error('.env 에 DATABASE_URL 이 없습니다.');

const PASSWORD = 'Band!2026';
const USERS = [
  { uid: '12300000-0000-0000-0000-000000000020', email: 'user1@123band.test', name: 'Test User 1', locale: 'ko' },
  { uid: '12300000-0000-0000-0000-000000000021', email: 'user2@123band.test', name: 'Test User 2', locale: 'ko' },
  { uid: '12300000-0000-0000-0000-000000000022', email: 'user3@123band.test', name: 'Test User 3', locale: 'en' },
  { uid: '12300000-0000-0000-0000-000000000023', email: 'user4@123band.test', name: 'Test User 4', locale: 'en' },
  { uid: '12300000-0000-0000-0000-000000000024', email: 'user5@123band.test', name: 'Test User 5', locale: 'ja' },
];

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();
// 울프·JNJ(public)와 같은 DB — 123Band 테이블(band123)만 보도록 public 을 뺀다
await client.query('set search_path = band123, extensions');
try {
  await client.query('set search_path = band123, extensions, auth');
  for (const u of USERS) {
    await client.query(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
         raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
         confirmation_token, recovery_token, email_change_token_new, email_change)
       values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2,
         crypt($3, gen_salt('bf')), now(),
         '{"provider":"email","providers":["email"]}'::jsonb, '{"service":"band123"}'::jsonb, now(), now(), '', '', '', '')
       on conflict (id) do update set
         encrypted_password = excluded.encrypted_password,
         email_confirmed_at = excluded.email_confirmed_at,
         aud = excluded.aud, role = excluded.role, updated_at = now()`,
      [u.uid, u.email, PASSWORD],
    );
    await client.query(
      `insert into auth.identities (id, user_id, identity_data, provider, provider_id,
         last_sign_in_at, created_at, updated_at)
       values (gen_random_uuid(), $1::uuid, jsonb_build_object('sub', $1::text, 'email', $2::text), 'email', $1::text,
         now(), now(), now())
       on conflict (provider, provider_id) do nothing`,
      [u.uid, u.email],
    );
    await client.query(
      `insert into profiles (id, email, role, name, locale)
       values ($1, $2, 'customer', $3, $4)
       on conflict (id) do update set role = 'customer', email = excluded.email, name = excluded.name, locale = excluded.locale`,
      [u.uid, u.email, u.name, u.locale],
    );
    console.log(`✓ user seeded: ${u.email}`);
  }

  const { rows } = await client.query(
    `select email, role, name, locale from profiles where email like 'user%@123band.test' order by email`,
  );
  console.log('\n=== test users now ===');
  for (const r of rows) console.log(r);
} finally {
  await client.end();
}
