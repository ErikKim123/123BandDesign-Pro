// 일회성: 행사 캘린더 데모용 티켓 이벤트 9건 시드 (code BAND-EV-001~009). 멱등(delete 후 insert).
// 날짜 기준 = event_content.startAt. 6~7월 분산, 일부 무료.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import pg from 'pg';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
function loadEnv() {
  const p = join(ROOT, '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let [, k, v] = m;
    v = v.replace(/^["']|["']$/g, '');
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnv();

const SELLER = '00000000-0000-0000-0000-000000000001';
const CAT_EVENTS = '00000000-0000-0000-0000-0000000000c3';

// 행사 1건 헬퍼: 공통 event_content 구조 채움
function ev({ badge, subtitle, loc, startAt, endAt, applyEnd, about, notice }) {
  return {
    badge,
    subtitle,
    location: loc,
    banner: undefined,
    startAt,
    endAt,
    applyStart: '2026-06-01T00:00',
    applyEnd,
    sections: {
      about: about ? { ko: `<p>${about.ko}</p>`, en: `<p>${about.en}</p>` } : undefined,
      notice: notice
        ? { ko: `<ul><li>${notice.ko}</li></ul>`, en: `<ul><li>${notice.en}</li></ul>` }
        : undefined,
      refund: {
        ko: '<ul><li>행사 7일 전까지 전액 환불, 이후 50%, 당일 불가</li></ul>',
        en: '<ul><li>Full refund up to 7 days before, 50% after, none on the day</li></ul>',
      },
    },
  };
}

// banner 는 안정적 placeholder (picsum seed)
const banner = (seed) => ({
  ko: `https://picsum.photos/seed/${seed}/1200/600`,
  en: `https://picsum.photos/seed/${seed}/1200/600`,
});

const EVENTS = [
  {
    code: 'BAND-EV-001',
    name: { ko: '서울 재즈 페스티벌 2026', en: 'Seoul Jazz Festival 2026' },
    prices: { KRW: 88000, USD: 6500 },
    ev: ev({
      badge: { ko: '재즈 라이브', en: 'Jazz Live' },
      subtitle: { ko: '초여름 밤의 재즈', en: 'Jazz on an early summer night' },
      loc: { ko: '올림픽공원 88잔디마당', en: 'Olympic Park, Seoul' },
      startAt: '2026-06-03T18:00',
      endAt: '2026-06-03T22:00',
      applyEnd: '2026-06-02T23:30',
      about: { ko: '국내외 재즈 아티스트가 함께하는 야외 페스티벌입니다.', en: 'An outdoor festival with jazz artists from home and abroad.' },
      notice: { ko: '우천 시에도 진행됩니다.', en: 'Held rain or shine.' },
    }),
  },
  {
    code: 'BAND-EV-002',
    name: { ko: '스타트업 IR 데모데이', en: 'Startup IR Demo Day' },
    prices: {},
    ev: ev({
      badge: { ko: '무료 · 네트워킹', en: 'Free · Networking' },
      subtitle: { ko: '투자자와 만나는 데모데이', en: 'Meet investors at demo day' },
      loc: { ko: '서울 강남구 디캠프', en: 'D.CAMP, Gangnam-gu, Seoul' },
      startAt: '2026-06-05T14:00',
      endAt: '2026-06-05T18:00',
      applyEnd: '2026-06-04T18:00',
      about: { ko: '초기 스타트업 10팀의 피칭과 네트워킹.', en: 'Pitching and networking for 10 early-stage startups.' },
      notice: { ko: '명함을 지참해 주세요.', en: 'Please bring your business cards.' },
    }),
  },
  {
    code: 'BAND-EV-003',
    name: { ko: '프론트엔드 컨퍼런스', en: 'Frontend Conference' },
    prices: { KRW: 55000, USD: 4000 },
    ev: ev({
      badge: { ko: '개발 컨퍼런스', en: 'Dev Conference' },
      subtitle: { ko: '실무자가 말하는 프론트엔드', en: 'Frontend by practitioners' },
      loc: { ko: '코엑스 컨퍼런스룸', en: 'COEX Conference Room, Seoul' },
      startAt: '2026-06-07T10:00',
      endAt: '2026-06-07T17:00',
      applyEnd: '2026-06-05T23:30',
      about: { ko: 'React·Next.js 실전 세션 8개로 구성됩니다.', en: 'Eight hands-on sessions on React and Next.js.' },
      notice: { ko: '노트북을 지참하면 실습에 참여할 수 있습니다.', en: 'Bring a laptop to join the hands-on labs.' },
    }),
  },
  {
    code: 'BAND-EV-004',
    name: { ko: '도심 플리마켓 & 푸드트럭', en: 'Urban Flea Market & Food Trucks' },
    prices: {},
    ev: ev({
      badge: { ko: '무료 입장', en: 'Free Entry' },
      subtitle: { ko: '주말 도심 마켓', en: 'A weekend city market' },
      loc: { ko: '성수동 연무장길', en: 'Seongsu-dong, Seoul' },
      startAt: '2026-06-13T11:00',
      endAt: '2026-06-13T20:00',
      applyEnd: '2026-06-13T10:00',
      about: { ko: '수공예·빈티지 셀러와 푸드트럭이 모이는 마켓.', en: 'A market of craft, vintage sellers and food trucks.' },
      notice: { ko: '반려동물 동반 가능합니다.', en: 'Pets are welcome.' },
    }),
  },
  {
    code: 'BAND-EV-005',
    name: { ko: '와인 테이스팅 클래스', en: 'Wine Tasting Class' },
    prices: { KRW: 65000, USD: 4800 },
    ev: ev({
      badge: { ko: '원데이 클래스', en: 'One-day Class' },
      subtitle: { ko: '소믈리에와 함께하는 6종 시음', en: 'Six wines with a sommelier' },
      loc: { ko: '한남동 와인바 Cellar', en: 'Cellar Wine Bar, Hannam-dong' },
      startAt: '2026-06-16T19:30',
      endAt: '2026-06-16T21:30',
      applyEnd: '2026-06-15T18:00',
      about: { ko: '입문자를 위한 와인 테이스팅과 페어링 가이드.', en: 'Wine tasting and pairing guide for beginners.' },
      notice: { ko: '만 19세 이상만 참여 가능합니다.', en: 'Ages 19 and over only.' },
    }),
  },
  {
    code: 'BAND-EV-006',
    name: { ko: '현대미술 기획전 〈빛과 시간〉', en: 'Contemporary Art Exhibition: Light & Time' },
    prices: { KRW: 18000, USD: 1300 },
    ev: ev({
      badge: { ko: '전시', en: 'Exhibition' },
      subtitle: { ko: '빛을 주제로 한 미디어아트', en: 'Media art on the theme of light' },
      loc: { ko: '서울시립미술관', en: 'Seoul Museum of Art' },
      startAt: '2026-06-20T10:00',
      endAt: '2026-06-20T19:00',
      applyEnd: '2026-06-20T09:00',
      about: { ko: '국내 미디어아트 작가 12인의 기획전.', en: 'A curated show of 12 Korean media artists.' },
      notice: { ko: '내부 사진 촬영은 플래시 없이 가능합니다.', en: 'Photography allowed without flash.' },
    }),
  },
  {
    code: 'BAND-EV-007',
    name: { ko: '한강 나이트 러닝 크루', en: 'Hangang Night Running Crew' },
    prices: { KRW: 15000, USD: 1100 },
    ev: ev({
      badge: { ko: '러닝 · 소셜', en: 'Running · Social' },
      subtitle: { ko: '함께 달리는 여름밤 10K', en: 'A 10K summer night run together' },
      loc: { ko: '뚝섬한강공원', en: 'Ttukseom Hangang Park' },
      startAt: '2026-06-24T20:00',
      endAt: '2026-06-24T22:00',
      applyEnd: '2026-06-23T23:30',
      about: { ko: '페이스별 그룹으로 안전하게 달립니다.', en: 'Run safely in pace-based groups.' },
      notice: { ko: '러닝화와 개인 물병을 준비해 주세요.', en: 'Bring running shoes and a water bottle.' },
    }),
  },
  {
    code: 'BAND-EV-008',
    name: { ko: 'AI 프로덕트 밋업', en: 'AI Product Meetup' },
    prices: {},
    ev: ev({
      badge: { ko: '무료 · 밋업', en: 'Free · Meetup' },
      subtitle: { ko: 'AI 제품을 만드는 사람들', en: 'People building AI products' },
      loc: { ko: '온라인 (Zoom)', en: 'Online (Zoom)' },
      startAt: '2026-06-27T19:00',
      endAt: '2026-06-27T21:00',
      applyEnd: '2026-06-27T18:00',
      about: { ko: 'AI 프로덕트 사례 공유와 Q&A 세션.', en: 'AI product case studies and a Q&A session.' },
      notice: { ko: '신청자에게 접속 링크를 메일로 보냅니다.', en: 'A join link is emailed to registrants.' },
    }),
  },
  {
    code: 'BAND-EV-009',
    name: { ko: '여름 클래식 갈라 콘서트', en: 'Summer Classical Gala Concert' },
    prices: { KRW: 120000, USD: 9000 },
    ev: ev({
      badge: { ko: '클래식 공연', en: 'Classical' },
      subtitle: { ko: '오케스트라와 성악의 밤', en: 'A night of orchestra and voice' },
      loc: { ko: '예술의전당 콘서트홀', en: 'Seoul Arts Center Concert Hall' },
      startAt: '2026-07-04T19:30',
      endAt: '2026-07-04T21:40',
      applyEnd: '2026-07-03T23:30',
      about: { ko: '여름밤을 수놓는 갈라 프로그램.', en: 'A gala program for a summer night.' },
      notice: { ko: '8세 이상 입장 가능합니다.', en: 'Admission for ages 8 and over.' },
    }),
  },
];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
async function main() {
  await client.connect();
  // 울프·JNJ(public)와 같은 DB — 123Band 테이블(band123)만 보도록 public 을 뺀다
  await client.query('set search_path = band123, extensions');
  await client.query(`delete from products where code like 'BAND-EV-%'`);
  let n = 0;
  for (const e of EVENTS) {
    const content = { ...e.ev, banner: banner(e.code.toLowerCase()) };
    await client.query(
      `insert into products (code, seller_id, is_partner_product, product_type, category_id, name_i18n, prices, status, event_content)
       values ($1,$2,false,'ticket',$3,$4::jsonb,$5::jsonb,'active',$6::jsonb)`,
      [e.code, SELLER, CAT_EVENTS, JSON.stringify(e.name), JSON.stringify(e.prices), JSON.stringify(content)],
    );
    n++;
  }
  console.log(`✅ 행사 ${n}건 시드 완료 (BAND-EV-001~${String(n).padStart(3, '0')})`);
}
main()
  .catch((e) => {
    console.error('💥', e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end().catch(() => {});
  });
