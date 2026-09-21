// 업적 뱃지 이미지를 badges 버킷에 올리고 achievements.badge_image_url 을 연결한다.
//
// 어드민 '업적관리' 화면에서도 올릴 수 있지만, 기획서에서 받은 아트를 여러 개 한꺼번에 넣을 때 쓴다.
// 뱃지는 배경이 투명한 정사각 PNG 가 기준이다(배지 페이지가 object-contain 으로 그린다).
//
// 사용: node packages/supabase/upload_badge.mjs <achievement_code> <png 경로>
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let [, k, v] = m;
    v = v.replace(/^["']|["']$/g, '');
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnv(join(ROOT, 'apps/web/.env.local'));
loadEnv(join(ROOT, '.env'));

const [code, file] = process.argv.slice(2);
if (!code || !file || !existsSync(file)) {
  console.error('사용: node packages/supabase/upload_badge.mjs <achievement_code> <png 경로>');
  process.exit(1);
}
if (!/^[a-z0-9_]+$/.test(code)) {
  console.error('업적 코드는 영문 소문자·숫자·밑줄만 됩니다.');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.');
  process.exit(1);
}
// 123Band 테이블은 band123 스키마에 있다(울프·JNJ 와 같은 프로젝트) — PostgREST 에 스키마를 지정한다.
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Accept-Profile': 'band123', 'Content-Profile': 'band123' };

// 업적이 실제로 있는지 먼저 본다 — 없는 코드로 파일만 올라가 고아가 되지 않게.
const found = await fetch(`${url}/rest/v1/achievements?code=eq.${code}&select=id`, { headers });
const rows = await found.json();
if (!Array.isArray(rows) || rows.length === 0) {
  console.error(`업적 '${code}' 가 없습니다.`);
  process.exit(1);
}

// 코드 이름 + 시각 — 같은 코드의 뱃지를 바꿔 올려도 CDN 캐시에 옛 그림이 남지 않게.
const path = `achievements/${code}-${Date.now()}.png`;
const up = await fetch(`${url}/storage/v1/object/band123-badges/${path}`, {
  method: 'POST',
  headers: { ...headers, 'content-type': 'image/png', 'x-upsert': 'true' },
  body: readFileSync(file),
});
if (!up.ok) {
  console.error('업로드 실패:', up.status, await up.text());
  process.exit(1);
}

const publicUrl = `${url}/storage/v1/object/public/band123-badges/${path}`;
const patch = await fetch(`${url}/rest/v1/achievements?code=eq.${code}`, {
  method: 'PATCH',
  headers: { ...headers, 'content-type': 'application/json', Prefer: 'return=minimal' },
  body: JSON.stringify({ badge_image_url: publicUrl, updated_at: new Date().toISOString() }),
});
if (!patch.ok) {
  console.error('연결 실패:', patch.status, await patch.text());
  process.exit(1);
}
console.log(`✓ ${code} ← ${publicUrl}`);
