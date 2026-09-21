// 운영자가 추가하는 파트너 계정 시드 + 누락 마이그레이션(0009/0010/0011) 적용.
// DATABASE_URL(직접 postgres 연결) 사용 — RLS/권한 우회로 auth.users 까지 생성.
// idempotent: 고정 UUID + on conflict.
//
// 사용법: node packages/supabase/seed_partners_admin.mjs
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
const PARTNERS = [
  { uid: '12300000-0000-0000-0000-000000000012', pid: '00000000-0000-0000-0000-0000000000a2',
    email: 'partner2@123band.test', name: 'Aurora Trading', company: 'Aurora Trading Co.', country: 'KR', biz: '220-81-00002', rate: 0.10, locale: 'ko' },
  { uid: '12300000-0000-0000-0000-000000000013', pid: '00000000-0000-0000-0000-0000000000a3',
    email: 'partner3@123band.test', name: 'Nordic Goods', company: 'Nordic Goods Ltd.', country: 'US', biz: 'EIN-00003', rate: 0.12, locale: 'en' },
  { uid: '12300000-0000-0000-0000-000000000014', pid: '00000000-0000-0000-0000-0000000000a4',
    email: 'partner4@123band.test', name: 'Sakura Imports', company: 'Sakura Imports K.K.', country: 'JP', biz: 'JP-00004', rate: 0.15, locale: 'ja' },
];

const MIGRATIONS = ['0009_partner_country.sql', '0010_newsletter.sql', '0011_partner_order_visibility.sql'];

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();
// 울프·JNJ(public)와 같은 DB — 123Band 테이블(band123)만 보도록 public 을 뺀다
await client.query('set search_path = band123, extensions');
try {
  // 1) 누락 마이그레이션 적용 (idempotent)
  for (const f of MIGRATIONS) {
    const sql = readFileSync(join(__dirname, 'migrations', f), 'utf8');
    await client.query(sql);
    console.log(`✓ migration applied: ${f}`);
  }

  // 2) 파트너 계정 시드 (auth.users → identities → profiles → partners)
  await client.query('set search_path = band123, extensions, auth');
  for (const p of PARTNERS) {
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
      [p.uid, p.email, PASSWORD],
    );
    await client.query(
      `insert into auth.identities (id, user_id, identity_data, provider, provider_id,
         last_sign_in_at, created_at, updated_at)
       values (gen_random_uuid(), $1::uuid, jsonb_build_object('sub', $1::text, 'email', $2::text), 'email', $1::text,
         now(), now(), now())
       on conflict (provider, provider_id) do nothing`,
      [p.uid, p.email],
    );
    await client.query(
      `insert into profiles (id, email, role, name, locale)
       values ($1, $2, 'partner', $3, $4)
       on conflict (id) do update set role = 'partner', email = excluded.email, name = excluded.name`,
      [p.uid, p.email, p.name, p.locale],
    );
    await client.query(
      `insert into partners (id, user_id, company_name, country, biz_no, commission_rate, status)
       values ($1, $2, $3, $4, $5, $6, 'active')
       on conflict (id) do update set
         company_name = excluded.company_name, country = excluded.country,
         biz_no = excluded.biz_no, commission_rate = excluded.commission_rate, status = excluded.status`,
      [p.pid, p.uid, p.company, p.country, p.biz, p.rate],
    );
    console.log(`✓ partner seeded: ${p.email} (${p.company})`);
  }

  // 3) 결과 확인
  const { rows } = await client.query(
    `select company_name, country, biz_no, commission_rate, status from partners order by created_at`,
  );
  console.log('\n=== partners now ===');
  for (const r of rows) console.log(r);
} finally {
  await client.end();
}
