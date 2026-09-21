// 일회성: d2(BAND-TK-001) 티켓에 샘플 이벤트 콘텐츠 적용 (ko/en)
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import pg from 'pg';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
function loadEnv() {
  const p = join(ROOT, '.env'); if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i); if (!m) continue;
    let [, k, v] = m; v = v.replace(/^["']|["']$/g, ''); if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnv();

const EVENT = {
  badge: { ko: '123Band와 함께하는 라이브', en: 'Live with 123Band' },
  subtitle: { ko: '잊지 못할 밤, 123Band 라이브 콘서트', en: 'An unforgettable night — 123Band Live Concert' },
  startAt: '2026-09-01T19:00',
  endAt: '2026-09-01T22:00',
  applyStart: '2026-06-01T00:00',
  applyEnd: '2026-08-25T23:30',
  location: { ko: '서울 마포구 마포대로 122 프론트원 공연장', en: 'Front1 Hall, 122 Mapo-daero, Mapo-gu, Seoul' },
  sections: {
    about: {
      ko: '<p>123Band가 선보이는 단 하루의 라이브 무대. 밴드의 대표곡과 신곡을 한자리에서 만나는 특별한 밤입니다.</p><p>몰입감 있는 사운드와 무대 연출로 잊지 못할 경험을 선사합니다.</p>',
      en: '<p>A one-night-only live stage by 123Band. Hear the band’s greatest hits and new songs all in one place.</p><p>Immersive sound and stage production for an unforgettable night.</p>',
    },
    venue: {
      ko: '<p><strong>프론트원 공연장</strong> (서울 마포구 마포대로 122)</p><ul><li>지하철 5호선 공덕역 7번 출구 도보 5분</li><li>건물 내 유료 주차 가능</li></ul>',
      en: '<p><strong>Front1 Hall</strong> (122 Mapo-daero, Mapo-gu, Seoul)</p><ul><li>5 min walk from Gongdeok Stn. (Line 5) Exit 7</li><li>Paid parking available in the building</li></ul>',
    },
    notice: {
      ko: '<ul><li>공연 시작 30분 전부터 입장 가능합니다.</li><li>티켓 1매당 1인 입장입니다.</li><li>공연장 내 취식은 제한됩니다.</li></ul>',
      en: '<ul><li>Doors open 30 minutes before showtime.</li><li>One admission per ticket.</li><li>Food and drink are restricted inside the hall.</li></ul>',
    },
    contact: {
      ko: '<p>문의: <a href="mailto:events@123band.test">events@123band.test</a> / 02-1234-5678 (평일 10:00~18:00)</p>',
      en: '<p>Contact: <a href="mailto:events@123band.test">events@123band.test</a> / +82-2-1234-5678 (Weekdays 10:00–18:00)</p>',
    },
    channel: {
      ko: '<p>인스타그램 @wolf_live · 유튜브 123Band Official 에서 최신 소식을 확인하세요.</p>',
      en: '<p>Follow @wolf_live on Instagram and 123Band Official on YouTube for the latest updates.</p>',
    },
    recommend: {
      ko: '<ul><li>123Band의 라이브를 직접 경험하고 싶은 분</li><li>특별한 밤을 함께할 친구·연인과 함께</li></ul>',
      en: '<ul><li>Anyone who wants to experience 123Band live</li><li>Great for a night out with friends or a partner</li></ul>',
    },
    refund: {
      ko: '<ul><li>공연 7일 전까지: 전액 환불</li><li>공연 3일 전까지: 50% 환불</li><li>이후 및 당일: 환불 불가</li></ul>',
      en: '<ul><li>Up to 7 days before: full refund</li><li>Up to 3 days before: 50% refund</li><li>After that / same day: no refund</li></ul>',
    },
  },
};

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
async function main() {
  await client.connect();
  // 울프·JNJ(public)와 같은 DB — 123Band 테이블(band123)만 보도록 public 을 뺀다
  await client.query('set search_path = band123, extensions');
  const r = await client.query(
    `update products set event_content = $1::jsonb where code = 'BAND-TK-001' returning id, name_i18n->>'ko' as name`,
    [JSON.stringify(EVENT)],
  );
  console.log(r.rowCount === 1 ? `✅ 적용: ${JSON.stringify(r.rows[0])}` : `⚠️ 대상 없음 (${r.rowCount}행)`);
}
main().catch(e => { console.error('💥', e.message); process.exitCode = 1; })
  .finally(async () => { await client.end().catch(() => {}); });
