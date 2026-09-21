// Design Ref: §8 Test Plan — psql 없이 Node(pg)로 Runtime 검증
// migrate(0001~0003) → seed → RLS/제약 10 시나리오 (§8.2)
//
// 사용법:
//   1) 루트 .env 에 DATABASE_URL 추가 (Supabase: Settings > Database > Connection string > URI)
//      DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"
//      ⚠️ service_role/postgres 직접 연결이어야 RLS 우회로 migrate/seed 가능
//   2) pnpm --filter @123band/supabase install   (pg 설치)
//   3) pnpm --filter @123band/supabase db:verify
//
// 옵션: SKIP_MIGRATE=1 / SKIP_SEED=1 로 단계 건너뛰기

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

// ── .env 파서 (의존성 없이) ─────────────────────────────────
function loadEnv() {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let [, k, v] = m;
    v = v.replace(/^["']|["']$/g, '');
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnv();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL 누락. 루트 .env 에 Supabase 연결 문자열을 넣으세요.');
  console.error('   예: DATABASE_URL="postgresql://postgres:[PW]@db.[REF].supabase.co:5432/postgres"');
  process.exit(2);
}

// ── 테스트 결과 집계 ─────────────────────────────────────────
let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.error(`  ❌ FAIL: ${label}`); }
}

const ADMIN = '00000000-0000-0000-0000-000000000001';
const PARTNER = '00000000-0000-0000-0000-000000000002';
const STRANGER = '00000000-0000-0000-0000-0000000000de';

const client = new pg.Client({ connectionString: DATABASE_URL });

/** authenticated/anon 역할 + jwt.sub 로 RLS 적용 상태에서 fn 실행 (트랜잭션 후 롤백) */
async function asRole(role, sub, fn) {
  await client.query('begin');
  try {
    await client.query(`set local role ${role}`);
    if (sub) {
      await client.query("select set_config('request.jwt.claims', $1, true)",
        [JSON.stringify({ sub, role })]);
    }
    return await fn();
  } finally {
    await client.query('rollback'); // 역할/세션 변수 원복
  }
}

async function count(sql, params) {
  const r = await client.query(sql, params);
  return Number(r.rows[0].n);
}

async function runFile(rel) {
  const sql = readFileSync(join(__dirname, rel), 'utf8');
  await client.query(sql);
}

async function main() {
  await client.connect();
  // 울프·JNJ(public)와 같은 DB — 123Band 테이블(band123)만 보도록 public 을 뺀다
  await client.query('set search_path = band123, extensions');
  console.log(`🔌 연결됨: ${DATABASE_URL.replace(/:[^:@/]+@/, ':****@')}`);

  // ── migrate ──
  if (process.env.SKIP_MIGRATE !== '1') {
    console.log('\n▶ Migrate (0001 → 0002 → 0003)');
    await runFile('migrations/0001_init_tables.sql');
    await runFile('migrations/0002_indexes_triggers.sql');
    await runFile('migrations/0003_rls_policies.sql');
    const t = await count(
      `select count(*)::int n from information_schema.tables
        where table_schema='public' and table_type='BASE TABLE'`);
    assert(t >= 12, `#1 마이그레이션 — public 테이블 ${t}개 (>=12)`);
  }

  // ── seed ──
  if (process.env.SKIP_SEED !== '1') {
    console.log('\n▶ Seed');
    await runFile('seed.sql');
    assert(true, '시드 적용 (on conflict 안전)');
  }

  console.log('\n▶ L1 DB/RLS 시나리오');

  // #2 role check 제약
  let ok = false;
  try {
    await client.query(
      "insert into profiles(id,email,role) values (gen_random_uuid(),'x@x','hacker')");
  } catch (e) { ok = e.code === '23514'; /* check_violation */ }
  assert(ok, '#2 role check 제약이 잘못된 값 거부');

  // #3 prices jsonb 왕복
  const pr = await client.query(
    "select prices from products where id='00000000-0000-0000-0000-0000000000d1'");
  assert(pr.rows[0] && Number(pr.rows[0].prices.USD) === 1990
    && Number(pr.rows[0].prices.KRW) === 2900000, '#3 prices jsonb 통화별 왕복');

  // #4 FK 위반 거부
  ok = false;
  try {
    await client.query(
      `insert into products(seller_id,category_id,name_i18n,prices)
       values ($1,'00000000-0000-0000-0000-0000000000ff','{"en":"x"}','{"USD":100}')`,
      [ADMIN]);
  } catch (e) { ok = e.code === '23503'; /* fk_violation */ }
  assert(ok, '#4 FK 위반(잘못된 category_id) 거부');

  // #5 파트너 자기 상품 조회
  let n = await asRole('authenticated', PARTNER, () =>
    count("select count(*)::int n from products where id='00000000-0000-0000-0000-0000000000d1'"));
  assert(n === 1, '#5 파트너가 자기 상품(p1) 조회 가능');

  // #6 파트너에게 타 판매자 비-active 상품은 안 보임
  n = await asRole('authenticated', PARTNER, () =>
    count(`select count(*)::int n from products
            where seller_id<>$1 and status<>'active'`, [PARTNER]));
  assert(n === 0, '#6 파트너에게 타 판매자 비공개(non-active) 상품 미노출');

  // #7 익명 공개읽기 active
  n = await asRole('anon', null, () =>
    count("select count(*)::int n from products where status='active'"));
  assert(n >= 3, '#7 익명/공개읽기로 active 상품 조회 (>=3)');

  // #8 타 고객은 남의 주문 못 봄
  n = await asRole('authenticated', STRANGER, () =>
    count('select count(*)::int n from orders'));
  assert(n === 0, '#8 타 고객은 남의 주문 조회 불가 (0행)');

  // #9 admin 전체 주문
  n = await asRole('authenticated', ADMIN, () =>
    count('select count(*)::int n from orders'));
  assert(n >= 1, '#9 admin 전체 주문 조회 (>=1)');

  // #10 파트너 자기 정산 항목
  n = await asRole('authenticated', PARTNER, () =>
    count('select count(*)::int n from order_items where seller_id=$1', [PARTNER]));
  assert(n === 1, '#10 파트너 자기 판매(정산) 항목 조회');

  // #11 정산 집계 + 수수료
  const agg = await client.query(
    `select coalesce(sum(line_amount),0)::int total,
            (select commission_rate from partners where user_id=$1) rate
       from order_items where seller_id=$1`, [PARTNER]);
  const total = agg.rows[0].total;
  const settle = Math.round(total * (1 - Number(agg.rows[0].rate)));
  assert(total === 3980, '#11a 파트너 매출 집계 = 3980 (USD minor)');
  assert(settle === 3383, '#11b 수수료(0.15) 차감 정산액 = 3383');

  // ── 요약 ──
  console.log(`\n──────────────────────────────`);
  console.log(`결과: ${pass} PASS / ${fail} FAIL`);
  console.log(`──────────────────────────────`);
}

main()
  .catch((e) => { console.error('\n💥 실행 오류:', e.message); fail++; })
  .finally(async () => {
    await client.end().catch(() => {});
    process.exit(fail > 0 ? 1 : 0);
  });
