// 발송 코드가 실제로 DB 템플릿을 타는지 끝단 확인.
// 익명 키로 PostgREST 를 읽는 경로(loadMailTemplate 이 쓰는 그 경로)를 그대로 흉내 내
// RLS 가 막지 않는지, 그리고 비활성/삭제 시 폴백으로 떨어지는지까지 본다.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
for (const line of existsSync(join(ROOT, '.env')) ? readFileSync(join(ROOT, '.env'), 'utf8').split('\n') : []) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const { renderMailTemplate, sampleVars } = await import(process.argv[2]);
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const COLS = 'key,name,audience,description,subject,body_html,subject_i18n,body_html_i18n,variables,is_active';

/** 발송 코드와 똑같이 익명 키로 읽는다. */
async function loadAsSender(key) {
  const res = await fetch(`${URL_}/rest/v1/mail_templates?key=eq.${key}&select=${COLS}&limit=1`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  if (!res.ok) return { err: res.status };
  const rows = await res.json();
  return { tpl: rows[0] ?? null };
}

console.log('== 익명 키로 템플릿 조회 (발송 코드와 동일 경로)');
let fail = 0;
for (const key of [
  'admin_signup', 'admin_order_paid', 'admin_transfer', 'admin_qna', 'admin_review',
  'admin_coupon_issued', 'admin_stamp_reward', 'admin_approval', 'admin_alert',
  'user_order_confirmation', 'user_heart_digest', 'user_newsletter_wrapper',
]) {
  const { tpl, err } = await loadAsSender(key);
  if (err || !tpl) { console.log(`  X ${key.padEnd(26)} 조회 실패 ${err ?? '(없음)'}`); fail++; continue; }
  const out = renderMailTemplate(tpl, sampleVars(tpl.variables), tpl.audience === 'user' ? 'ko' : 'ko');
  if (!out) { console.log(`  X ${key.padEnd(26)} 렌더 실패`); fail++; continue; }
  console.log(`  OK ${key.padEnd(26)} -> ${out.subject.slice(0, 46)}`);
}

console.log('\n== 안전망: 비활성 / 미등록이면 폴백(null)로 떨어지는가');
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
// 울프·JNJ(public)와 같은 DB — 123Band 테이블(band123)만 보도록 public 을 뺀다
await c.query('set search_path = band123, extensions');
await c.query('begin');
await c.query(`update mail_templates set is_active = false where key = 'admin_signup'`);
await c.query('commit');
{
  const { tpl } = await loadAsSender('admin_signup');
  const out = tpl ? renderMailTemplate(tpl, sampleVars(tpl.variables), 'ko') : null;
  console.log(`  비활성 admin_signup -> ${out === null ? 'null (폴백 동작) OK' : 'X 여전히 렌더됨'}`);
  if (out !== null) fail++;
}
await c.query(`update mail_templates set is_active = true where key = 'admin_signup'`);
{
  const { tpl } = await loadAsSender('nonexistent_key_xyz');
  console.log(`  없는 키 -> ${tpl === null ? 'null (폴백 동작) OK' : 'X 무언가 반환됨'}`);
  if (tpl !== null) fail++;
}

console.log('\n== 익명 키로 쓰기 시도(막혀야 정상)');
const res = await fetch(`${URL_}/rest/v1/mail_templates?key=eq.admin_signup`, {
  method: 'PATCH',
  headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'content-type': 'application/json', Prefer: 'return=representation' },
  body: JSON.stringify({ subject: '해킹됨' }),
});
const patched = res.ok ? await res.json() : null;
const blocked = !res.ok || (Array.isArray(patched) && patched.length === 0);
console.log(`  PATCH -> ${res.status} ${blocked ? '차단됨 OK' : 'X 수정이 통과했다'}`);
if (!blocked) fail++;

const { rows: check } = await c.query(`select subject, is_active from mail_templates where key='admin_signup'`);
console.log(`  admin_signup 현재 제목: ${check[0].subject}  활성=${check[0].is_active}`);
if (check[0].subject === '해킹됨') { console.log('  X 값이 실제로 바뀌었다'); fail++; }

await c.end();
console.log(fail ? `\n실패 ${fail}건` : '\n전부 통과');
process.exit(fail ? 1 : 0);
