// 시드된 템플릿이 실제로 렌더되는지 왕복 확인 — DB 에서 읽어 표본값으로 채워 본다.
// 사용: node verify_mail_templates.mjs  (mail-template.ts 를 미리 컴파일해 둔 경로를 인자로)
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

const enginePath = process.argv[2];
const { renderMailTemplate, sampleVars, unknownVariables } = await import(enginePath);

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
// 울프·JNJ(public)와 같은 DB — 123Band 테이블(band123)만 보도록 public 을 뺀다
await client.query('set search_path = band123, extensions');
const { rows } = await client.query('select * from mail_templates order by sort_order, key');

let bad = 0;
for (const tpl of rows) {
  const vars = sampleVars(tpl.variables);
  const locales = tpl.audience === 'user' ? ['ko', 'en'] : ['ko'];
  for (const loc of locales) {
    const out = renderMailTemplate(tpl, vars, loc);
    if (!out) { console.log(`  X ${tpl.key} [${loc}] 렌더 실패`); bad++; continue; }

    // 채워지지 않고 남은 자리표시자 = 변수 정의 누락
    const left = [...out.html.matchAll(/\{\{[^}]*\}\}/g)].map((m) => m[0]);
    // 본문에서 쓰였는데 정의가 없는 변수 (반복 블록 안 필드는 제외)
    const unknown = unknownVariables(
      `${tpl.subject ?? JSON.stringify(tpl.subject_i18n)} ${tpl.body_html ?? JSON.stringify(tpl.body_html_i18n)}`,
      tpl.variables,
    );

    const flag = left.length || unknown.length ? 'WARN' : ' OK ';
    if (left.length) bad++;
    console.log(
      `  ${flag} ${tpl.key.padEnd(26)} [${loc}] 제목 ${out.subject.length}자 / 본문 ${out.html.length}자` +
        (left.length ? `  남은자리표시자=${left.slice(0, 3).join(',')}` : '') +
        (unknown.length ? `  정의없는변수=${unknown.join(',')}` : ''),
    );
    if (tpl.key === 'user_order_confirmation' && loc === 'ko') {
      console.log(`       제목: ${out.subject}`);
      console.log(`       QR 안내 포함: ${out.html.includes('입장은 QR 코드로 합니다') ? 'yes' : 'NO'}`);
    }
    if (tpl.key === 'admin_alert') console.log(`       본문: ${out.html}`);
  }
}
console.log(bad ? `\n실패/경고 ${bad}건` : '\n전부 정상 렌더');
await client.end();
process.exit(bad ? 1 : 0);
