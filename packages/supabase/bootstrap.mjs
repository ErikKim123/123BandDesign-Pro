// band123 스키마 구축 — migrations/*.sql 전부를 번호순으로, 한 트랜잭션 안에서 적용한다.
//
// 사용: node packages/supabase/bootstrap.mjs [--commit] [--wolf-side] [--seed]   (루트 .env 의 DATABASE_URL)
//   (기본)       시험 실행: 전부 적용해 보고 ROLLBACK — DB 에는 아무것도 남지 않는다
//   --commit     실제 반영
//   --wolf-side  wolf-side/*.sql(울프 가입 트리거가 123Band 가입을 건너뛰게 하는 변경)도 함께 적용
//   --seed       seed.sql(테스트 계정·샘플 상품)까지 적용
//   --replace-existing  이미 있는 band123(예전 시도)을 지우고 새로 만든다 — 행이 10개 이하일 때만
//
// 123Band 는 울프·JNJ 와 같은 Supabase 프로젝트를 쓴다. 울프 객체를 건드리지 않도록
//   1) 적용 전에 SQL 을 정적 검사해 public·공용 트리거/정책/버킷 이름을 쓰면 거부하고
//   2) search_path 에서 public 을 빼서(band123, extensions) 이름 없는 참조가 울프 테이블로 새지 않게 하고
//   3) lock_timeout 으로 울프 운영 트래픽과 잠금이 겹치면 기다리지 않고 중단한다.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const envPath = join(ROOT, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const COMMIT = process.argv.includes('--commit');
const WOLF_SIDE = process.argv.includes('--wolf-side');
const SEED = process.argv.includes('--seed');
const REPLACE_EXISTING = process.argv.includes('--replace-existing');
const MAX_REPLACE_ROWS = 10; // 이보다 많으면 '실제로 쓰는 스키마'로 보고 지우지 않는다

const JNJ_TABLES = ['online_judges']; // JNJ Dash 소유 — 읽기·트리거 부착만 허용

/** 울프·JNJ 객체를 건드리는 문장을 찾아 사유 목록으로 돌려준다(빈 배열 = 통과). */
function audit(file, raw) {
  const sql = raw.replace(/--[^\n]*/g, '');
  const bad = [];
  const pub = sql.match(new RegExp(`\\bpublic\\.(?!(${JNJ_TABLES.join('|')})\\b)[a-z_]+`, 'g'));
  if (pub) bad.push(`public 객체 참조: ${[...new Set(pub)].join(', ')}`);
  for (const m of sql.matchAll(/policy\s+(?:if exists\s+)?"?([a-z0-9_]+)"?\s+on\s+storage\.objects/g))
    if (!m[1].startsWith('band123_')) bad.push(`storage 정책 이름: ${m[1]}`);
  for (const m of sql.matchAll(/bucket_id\s*=\s*'([^']+)'/g))
    if (!m[1].startsWith('band123-')) bad.push(`버킷: ${m[1]}`);
  for (const m of sql.matchAll(/insert\s+into\s+storage\.buckets[^;]*?values\s*\(\s*'([^']+)'/g))
    if (!m[1].startsWith('band123-')) bad.push(`버킷 생성: ${m[1]}`);
  for (const m of sql.matchAll(/trigger\s+(?:if exists\s+)?([a-z0-9_]+)[^;]*?\bon\s+(auth|public|storage)\.[a-z_]+/g))
    if (!m[1].startsWith('band123_')) bad.push(`공용 테이블 트리거: ${m[1]} (${m[2]})`);
  for (const m of sql.matchAll(/\b(drop|alter|truncate)\s+(table|function|view|type|schema|trigger|policy|index)?\s*(if exists\s+)?(auth|public|storage|extensions|battle|div|ai_judge)\.[a-z_]+/g))
    bad.push(`공용 스키마 변경: ${m[0]}`);
  if (/\b(delete\s+from|update|insert\s+into)\s+(auth\.users|public\.|battle\.|div\.|ai_judge\.)/.test(sql))
    bad.push('공용 스키마 데이터 변경');
  return bad.map((b) => `${file}: ${b}`);
}

const migDir = join(__dirname, 'migrations');
const plan = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort().map((f) => ({ name: `migrations/${f}`, sql: readFileSync(join(migDir, f), 'utf8'), audited: true }));
if (SEED) plan.push({ name: 'seed.sql', sql: readFileSync(join(__dirname, 'seed.sql'), 'utf8'), audited: true });
if (WOLF_SIDE) {
  const wd = join(__dirname, 'wolf-side');
  for (const f of readdirSync(wd).filter((x) => x.endsWith('.sql')).sort())
    plan.push({ name: `wolf-side/${f}`, sql: readFileSync(join(wd, f), 'utf8'), audited: false });
}

const violations = plan.filter((p) => p.audited).flatMap((p) => audit(p.name, p.sql));
if (violations.length) {
  console.error('✗ 울프·JNJ 객체를 건드리는 SQL 이 있어 중단합니다:\n  ' + violations.join('\n  '));
  process.exit(1);
}
console.log(`정적 검사 통과 — ${plan.length}개 파일${WOLF_SIDE ? ' (울프 쪽 변경 포함)' : ''}`);

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL 이 없습니다 — 루트 .env 에 넣으세요.');

const authTriggers = `select tgname, pg_get_triggerdef(t.oid) as def
                        from pg_trigger t join pg_class c on c.oid = t.tgrelid
                        join pg_namespace n on n.oid = c.relnamespace
                       where n.nspname = 'auth' and c.relname = 'users' and not t.tgisinternal
                       order by tgname`;

/** 울프·JNJ 쪽 객체의 지문 — 적용 전후로 같아야 한다. */
async function wolfFingerprint() {
  // 함수 정의·정책 식은 search_path 기준으로 스키마를 생략해 출력된다 — 비교 전후가 같도록
  // pg_catalog 로 고정해 모든 이름이 스키마까지 찍히게 하고, 끝나면 되돌린다.
  const { rows: [{ search_path: saved }] } = await client.query('show search_path');
  await client.query('set search_path = pg_catalog');
  const { rows: [r] } = await client.query(`
    select
      (select count(*) from pg_tables where schemaname in ('public','battle','div','ai_judge'))::int as tables,
      (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('public','battle','div','ai_judge'))::int as functions,
      (select md5(coalesce(string_agg(p.oid::text || md5(pg_get_functiondef(p.oid)), ',' order by p.oid), ''))
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('public','battle','div','ai_judge') and p.prokind = 'f') as function_bodies,
      (select md5(coalesce(string_agg(n.nspname || '.' || c.relname || '.' || t.tgname, ',' order by 1), ''))
         from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
        where not t.tgisinternal and n.nspname in ('public','battle','div','ai_judge')
          and t.tgname not like 'band123_%') as triggers,
      (select md5(coalesce(string_agg(schemaname || '.' || tablename || '.' || policyname || coalesce(qual,'') || coalesce(with_check,''), ',' order by 1), ''))
         from pg_policies where schemaname in ('public','battle','div','ai_judge')) as policies,
      (select md5(coalesce(string_agg(policyname || coalesce(qual,'') || coalesce(with_check,''), ',' order by 1), ''))
         from pg_policies where schemaname = 'storage' and policyname not like 'band123_%') as storage_policies,
      (select md5(coalesce(string_agg(id || public::text, ',' order by id), '')) from storage.buckets where id not like 'band123-%') as buckets,
      (select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and schemaname <> 'band123')::int as realtime_tables
  `);
  await client.query(`select set_config('search_path', $1, false)`, [saved]);
  return r;
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const { rows: [pre] } = await client.query(
    `select exists(select 1 from pg_namespace where nspname = 'band123') as has_schema,
            (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'band123')::int as objects`,
  );
  let replace = false;
  if (pre.objects > 0) {
    // 예전 시도(123Band-old, 울프 0035 기준)가 남긴 band123 을 새 구조로 갈아엎는 경우만 허용한다.
    // 실제 데이터가 쌓인 스키마를 실수로 지우지 않도록 행 수가 적을 때만.
    const { rows: [{ rows_total }] } = await client.query(
      `select coalesce(sum(n_live_tup), 0)::int as rows_total from pg_stat_user_tables where schemaname = 'band123'`,
    );
    if (!REPLACE_EXISTING)
      throw new Error(`band123 스키마에 이미 객체 ${pre.objects}개(행 ${rows_total}개)가 있습니다. 지우고 새로 만들려면 --replace-existing`);
    if (rows_total > MAX_REPLACE_ROWS)
      throw new Error(`band123 에 행이 ${rows_total}개 있어 지우지 않습니다(한도 ${MAX_REPLACE_ROWS}) — 데이터를 먼저 확인하세요.`);
    console.log(`기존 band123 (객체 ${pre.objects}개, 행 ${rows_total}개)를 지우고 새로 만듭니다.`);
    replace = true;
  }
  console.log('\n[적용 전] auth.users 트리거:');
  for (const r of (await client.query(authTriggers)).rows) console.log(`  ${r.tgname}`);

  const wolfBefore = await wolfFingerprint();

  await client.query('begin');
  await client.query(`set local lock_timeout = '5s'`);
  if (replace) {
    // 예전 가입 트리거 + 스키마. cascade 로 band123 함수를 쓰던 storage 정책(band123_*)도 같이 지워지고,
    // 아래 마이그레이션이 다시 만든다. 버킷(band123-*)은 남겨 두고 재사용한다(on conflict).
    await client.query('drop trigger if exists on_auth_user_created_band123 on auth.users');
    await client.query('drop schema band123 cascade');
    console.log('ok 기존 band123 삭제');
  }
  await client.query('set local search_path = band123, extensions');
  for (const p of plan) {
    try {
      await client.query(p.sql);
      console.log(`ok ${p.name}`);
    } catch (e) {
      console.error(`✗ ${p.name}: ${e.message}`);
      throw e;
    }
  }

  const { rows: [sum] } = await client.query(
    `select (select count(*) from pg_tables where schemaname = 'band123')::int as tables,
            (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'band123')::int as functions,
            (select count(*) from storage.buckets where id like 'band123-%')::int as buckets,
            (select count(*) from pg_policies where schemaname = 'storage' and policyname like 'band123_%')::int as storage_policies`,
  );
  console.log(`\n[적용 후] band123 테이블 ${sum.tables} · 함수 ${sum.functions} · 버킷 ${sum.buckets} · storage 정책 ${sum.storage_policies}`);
  console.log('[적용 후] auth.users 트리거:');
  for (const r of (await client.query(authTriggers)).rows) console.log(`  ${r.def}`);

  // 울프·JNJ 영향 검사 — 다르면 되돌린다(울프 가입 트리거 조건 변경은 --wolf-side 로 의도한 것이라 제외)
  const wolfAfter = await wolfFingerprint();
  const diff = Object.keys(wolfBefore).filter((k) => wolfBefore[k] !== wolfAfter[k]);
  if (diff.length) {
    for (const k of diff) console.error(`  ✗ ${k}: ${wolfBefore[k]} → ${wolfAfter[k]}`);
    throw new Error('울프·JNJ 객체가 바뀌었습니다 — 되돌립니다.');
  }
  console.log(`[울프 영향] 없음 — ${Object.entries(wolfAfter).map(([k, v]) => `${k} ${String(v).length > 12 ? '✓' : v}`).join(' · ')}`);

  if (COMMIT) {
    await client.query('commit');
    console.log('\n✅ 반영(commit) 완료');
  } else {
    await client.query('rollback');
    console.log('\nℹ️ 시험 실행 — 전부 되돌렸습니다(rollback). 실제 반영은 --commit');
  }
} catch (e) {
  await client.query('rollback').catch(() => undefined);
  console.error('\n되돌림(rollback) — DB 에는 아무것도 반영되지 않았습니다.');
  throw e;
} finally {
  await client.end();
}
