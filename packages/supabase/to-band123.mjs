// 일회성 변환: 울프에서 가져온 SQL(public 스키마 기준)을 123Band 전용 band123 스키마 기준으로 바꾼다.
// 사용: node packages/supabase/to-band123.mjs [--write]
//
// 123Band 는 울프·JNJ 와 같은 Supabase 프로젝트를 쓴다. 이름이 겹치는 공용 객체
// (storage 버킷/정책, auth.users·JNJ 테이블 트리거)를 그대로 만들면 울프 것을 덮어쓰므로
// 전부 band123 접두어로 바꾼다. JNJ Dash 테이블(online_judges)은 public 에 그대로 둔다.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WRITE = process.argv.includes('--write');
const BUCKETS = ['badges', 'banners', 'instagram-media', 'jnj', 'product-images', 'member-avatars'];
const TRIGGERS = ['on_auth_user_created', 'online_judge_evaluate_achievements'];
const JNJ_TABLES = ['online_judges']; // JNJ Dash 소유 — public 유지

/** 문장 단위로 storage 관련 문장만 골라 버킷 id·정책 이름을 바꾼다. */
function convertStorage(sql) {
  return sql.replace(/[^;]*;/g, (stmt) => {
    if (!/storage\.(objects|buckets)/.test(stmt)) return stmt;
    let s = stmt;
    for (const b of BUCKETS) s = s.split(`'${b}'`).join(`'band123-${b}'`);
    if (/on storage\.objects/.test(s)) {
      s = s.replace(/policy\s+(if exists\s+)?"([^"]+)"/g, (m, ie, n) =>
        n.startsWith('band123_') ? m : `policy ${ie ?? ''}"band123_${n}"`);
      s = s.replace(/policy\s+(if exists\s+)?([a-z_][a-z0-9_]*)(\s+on\s)/g, (m, ie, n, rest) =>
        n.startsWith('band123_') || n === 'if' ? m : `policy ${ie ?? ''}band123_${n}${rest}`);
    }
    return s;
  });
}

function convert(sql) {
  let s = sql;
  s = s.replace(/\bpublic\./g, 'band123.');
  s = s.replace(/(search_path\s*=\s*)public\b/gi, '$1band123');
  s = s.replace(/(search_path\s+to\s+)'public'/gi, "$1'band123'");
  s = s.replace(/(nspname\s*=\s*)'public'/g, "$1'band123'");
  s = convertStorage(s);
  for (const t of TRIGGERS) s = s.replace(new RegExp(`\\b${t}\\b`, 'g'), `band123_${t}`);
  for (const t of JNJ_TABLES) {
    s = s.replace(new RegExp(`\\bband123\\.${t}\\b`, 'g'), `public.${t}`);
    s = s.replace(new RegExp(`(from|join)\\s+${t}\\b`, 'gi'), `$1 public.${t}`);
  }
  return s;
}

const targets = [
  ...readdirSync(join(__dirname, 'migrations')).filter((f) => f.endsWith('.sql')).map((f) => join('migrations', f)),
  'seed.sql',
  'schema.sql',
  ...readdirSync(join(__dirname, 'tests/db')).filter((f) => f.endsWith('.sql')).map((f) => join('tests/db', f)),
];

let changed = 0;
for (const rel of targets) {
  const p = join(__dirname, rel);
  const src = readFileSync(p, 'utf8');
  const out = convert(src);
  if (out !== src) {
    changed++;
    if (WRITE) writeFileSync(p, out);
  }
}
console.log(`${WRITE ? 'changed' : 'would change'} ${changed}/${targets.length} files`);
