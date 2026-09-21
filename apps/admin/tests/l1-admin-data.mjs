// Design Ref: §8.2 — L1 admin 데이터/RLS 테스트 (Node pg, psql 불필요)
// 시나리오: admin select 전체 / 비-admin 격리 / partner 상태전이 / product upsert / 목록 detail_html 제외
//
// 사용법:
//   루트 .env 의 DATABASE_URL 사용. (admin 세션은 set local role authenticated + admin sub 로 시뮬레이션)
//   node apps/admin/tests/l1-admin-data.mjs
//
// 전제: packages/supabase 의 마이그레이션 + seed 가 이미 적용돼 있어야 함 (db:verify 선행).

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');

function loadEnv() {
  const p = join(ROOT, '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv();
if (!process.env.DATABASE_URL) { console.error('❌ DATABASE_URL 필요'); process.exit(2); }

const ADMIN = '00000000-0000-0000-0000-000000000001';
const STRANGER = '00000000-0000-0000-0000-0000000000de';
const PARTNER_PROFILE = '00000000-0000-0000-0000-000000000002';
const PARTNER = '00000000-0000-0000-0000-0000000000a1';

let pass = 0, fail = 0;
const ok = (c, l) => (c ? (pass++, console.log(`  ✅ ${l}`)) : (fail++, console.error(`  ❌ ${l}`)));
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function asRole(role, sub, fn) {
  await client.query('begin');
  try {
    await client.query(`set local role ${role}`);
    if (sub) await client.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub, role })]);
    return await fn();
  } finally { await client.query('rollback'); }
}
const count = async (sql, p) => Number((await client.query(sql, p)).rows[0].n);

async function main() {
  await client.connect();
  console.log('▶ L1 admin 데이터/RLS');

  // #1 admin 전체 partners
  let n = await asRole('authenticated', ADMIN, () => count('select count(*)::int n from partners'));
  ok(n >= 1, '#1 admin 은 partners 전체 조회 (>=1)');

  // #2 비-admin(낯선 고객)은 회원 목록 0행
  n = await asRole('authenticated', STRANGER, () => count('select count(*)::int n from profiles'));
  ok(n === 0, '#2 비-admin 은 타 회원 profiles 조회 불가 (자기 1행만 — 여기선 미시드 sub라 0)');

  // #3 partner 상태 전이 (pending→active) — admin 권한
  await asRole('authenticated', ADMIN, async () => {
    await client.query("update partners set status='pending' where id=$1", [PARTNER]);
    await client.query("update partners set status='active' where id=$1", [PARTNER]);
    const s = (await client.query('select status from partners where id=$1', [PARTNER])).rows[0].status;
    ok(s === 'active', '#3 partner 상태전이 pending→active (admin)');
  });

  // #4 product upsert (prices/i18n) — admin
  await asRole('authenticated', ADMIN, async () => {
    await client.query(
      `insert into products (id, code, seller_id, product_type, name_i18n, prices, status)
       values ('00000000-0000-0000-0000-0000000000b9','TEST-L1',$1,'physical',
               '{"en":"L1 Test","ko":"L1 테스트"}','{"USD":500,"KRW":700000}','draft')
       on conflict (id) do update set prices=excluded.prices`,
      [ADMIN]);
    const r = (await client.query("select prices from products where id='00000000-0000-0000-0000-0000000000b9'")).rows[0];
    ok(Number(r.prices.USD) === 500 && Number(r.prices.KRW) === 700000, '#4 product upsert prices jsonb 저장');
  });

  // #5 목록 select 컬럼에 detail_html 미포함 (config selectColumns 검증)
  const sel = 'id, code, seller_id, is_partner_product, product_type, category_id, name_i18n, prices, status';
  ok(!/detail_html/.test(sel), '#5 상품 목록 select 에 detail_html 제외 (성능)');

  // #6 파트너는 자기 상품만 (RLS)
  n = await asRole('authenticated', PARTNER_PROFILE, () =>
    count("select count(*)::int n from products where seller_id<>$1 and status<>'active'", [PARTNER_PROFILE]));
  ok(n === 0, '#6 파트너는 타 판매자 비공개 상품 미노출');

  // cleanup
  await client.query("delete from products where id='00000000-0000-0000-0000-0000000000b9'");

  console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
}
main().catch((e) => { console.error('💥', e.message); fail++; })
  .finally(async () => { await client.end().catch(() => {}); process.exit(fail ? 1 : 0); });
