// 여행 어필리에이트(항공·숙박) 링크 생성 — 상세페이지 '항공' / '숙박' 섹션에서 사용.
//  · 숙박 = Stay22 지도 임베드(iframe). 행사 좌표(lat/lng)와 행사 기간을 그대로 넘겨
//    베뉴 주변 숙소를 보여준다. (https://www.stay22.com/mapdocumentation)
//  · 항공 = Travelpayouts(Aviasales) 프리셋 검색 링크. 외부 스크립트를 붙이지 않고
//    쿼리스트링만으로 목적지·날짜가 채워진 검색 결과를 연다.
// 제휴 ID 는 환경변수로만 주입한다(코드/DB 에 상수로 박지 않음). 값이 없으면 섹션 자체를 렌더하지 않는다.
import { addrText, type EventAddress, type Locale } from '@123band/shared';
import { currencyForLocale } from '@/lib/locale';

/** Stay22 제휴 ID — Stay22 Hub > 계정. 없으면 숙박 섹션 숨김. */
export const STAY22_AID = (process.env.NEXT_PUBLIC_STAY22_AID ?? '').trim();
/** Travelpayouts 파트너 마커(숫자 ID) — 대시보드 우상단 프로필. 없으면 항공 섹션 숨김. */
export const TRAVELPAYOUTS_MARKER = (process.env.NEXT_PUBLIC_TRAVELPAYOUTS_MARKER ?? '').trim();

/** datetime-local(KST 기준, TZ 없음) → YYYY-MM-DD. 서버=클라 동일 결과(문자열만 자름). */
function ymd(iso?: string): string {
  if (!iso) return '';
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso.trim());
  return m?.[1] ?? '';
}

/** YYYY-MM-DD 에 일수 더하기 (종료일 없을 때 체크아웃/귀국일 보정용) */
export function addDays(date: string, days: number): string {
  if (!date) return '';
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * 행사 일정 → 숙박/항공 기본 날짜.
 * 체크인=행사 시작일, 체크아웃=행사 종료일(없거나 같은 날이면 +1박).
 */
export function travelDates(startAt?: string, endAt?: string): { checkin: string; checkout: string } {
  const checkin = ymd(startAt);
  if (!checkin) return { checkin: '', checkout: '' };
  const end = ymd(endAt);
  const checkout = end && end > checkin ? end : addDays(checkin, 1);
  return { checkin, checkout };
}

// ── 목적지 공항 ────────────────────────────────────────────────
// Aviasales 는 도시/공항 IATA 코드를 받는다. 도시명이 맞으면 도시코드, 아니면 국가 관문공항으로 폴백.

/** 국가(ISO2) → 대표 관문 공항/도시 코드. 도시 매칭 실패 시 폴백. */
const COUNTRY_IATA: Record<string, string> = {
  KR: 'SEL', JP: 'TYO', CN: 'BJS', TW: 'TPE', HK: 'HKG', SG: 'SIN', TH: 'BKK',
  VN: 'SGN', PH: 'MNL', ID: 'CGK', MY: 'KUL', IN: 'DEL',
  US: 'NYC', CA: 'YTO', MX: 'MEX', BR: 'SAO', AR: 'BUE', CO: 'BOG', CL: 'SCL', PE: 'LIM',
  GB: 'LON', FR: 'PAR', DE: 'BER', ES: 'MAD', IT: 'ROM', NL: 'AMS', PT: 'LIS',
  CH: 'ZRH', SE: 'STO', PL: 'WAW', RU: 'MOW', TR: 'IST',
  AU: 'SYD', NZ: 'AKL', AE: 'DXB', EG: 'CAI', ZA: 'JNB',
};

/**
 * 도시명(영문 소문자) → IATA. 라틴댄스 페스티벌이 실제로 열리는 도시 위주.
 * 여기 없으면 국가 관문공항으로 떨어지므로, 새 개최 도시가 생기면 한 줄 추가하면 된다.
 */
const CITY_IATA: Record<string, string> = {
  // 한국·일본·중화권
  seoul: 'SEL', incheon: 'SEL', busan: 'PUS', jeju: 'CJU',
  tokyo: 'TYO', osaka: 'OSA', kyoto: 'OSA', fukuoka: 'FUK', nagoya: 'NGO', okinawa: 'OKA', sapporo: 'SPK',
  taipei: 'TPE', kaohsiung: 'KHH', taichung: 'RMQ', 'hong kong': 'HKG', macau: 'MFM',
  shanghai: 'SHA', beijing: 'BJS', guangzhou: 'CAN', shenzhen: 'SZX', chengdu: 'CTU',
  // 동남아
  bangkok: 'BKK', phuket: 'HKT', 'chiang mai': 'CNX', pattaya: 'UTP', 'koh samui': 'USM',
  singapore: 'SIN', 'kuala lumpur': 'KUL', penang: 'PEN', langkawi: 'LGK',
  jakarta: 'CGK', bali: 'DPS', denpasar: 'DPS', surabaya: 'SUB',
  manila: 'MNL', cebu: 'CEB', bohol: 'TAG', panglao: 'TAG', tagbilaran: 'TAG',
  boracay: 'MPH', caticlan: 'MPH', davao: 'DVO', palawan: 'PPS', 'puerto princesa': 'PPS',
  'ho chi minh': 'SGN', 'ho chi minh city': 'SGN', saigon: 'SGN', hanoi: 'HAN',
  // 붕따우·바리아는 공항이 없어 호치민(SGN)이 관문. 화면에는 SGN 도시명으로 표기된다.
  'vung tau': 'SGN', 'ba ria': 'SGN', 'ba ria vung tau': 'SGN',
  'da nang': 'DAD', danang: 'DAD', 'phu quoc': 'PQC', 'nha trang': 'CXR', 'hoi an': 'DAD',
  'duong dong': 'PQC', 'an thoi': 'PQC', // 푸꾸옥 섬 안의 지명 — 도시 칸에 이게 들어오는 경우가 있다
  'da lat': 'DLI', dalat: 'DLI', hue: 'HUI', 'hai phong': 'HPH', haiphong: 'HPH', 'can tho': 'VCA',
  'siem reap': 'REP', 'phnom penh': 'PNH', vientiane: 'VTE', yangon: 'RGN',
  // 오세아니아
  sydney: 'SYD', melbourne: 'MEL', brisbane: 'BNE', perth: 'PER', adelaide: 'ADL',
  'gold coast': 'OOL', canberra: 'CBR', auckland: 'AKL', wellington: 'WLG', christchurch: 'CHC',
  // 그 외 자주 쓰는 허브
  dubai: 'DXB', 'abu dhabi': 'AUH', delhi: 'DEL', mumbai: 'BOM', goa: 'GOI',
  london: 'LON', paris: 'PAR', barcelona: 'BCN', madrid: 'MAD', rome: 'ROM', milan: 'MIL',
  amsterdam: 'AMS', berlin: 'BER', lisbon: 'LIS', istanbul: 'IST',
  'new york': 'NYC', 'los angeles': 'LAX', 'san francisco': 'SFO', miami: 'MIA',
  chicago: 'CHI', 'las vegas': 'LAS', toronto: 'YTO', vancouver: 'YVR',
  'mexico city': 'MEX', cancun: 'CUN', 'sao paulo': 'SAO', 'rio de janeiro': 'RIO',
  'buenos aires': 'BUE', bogota: 'BOG', medellin: 'MDE', cali: 'CLO', lima: 'LIM', santiago: 'SCL',
  cairo: 'CAI', johannesburg: 'JNB', 'cape town': 'CPT',
};

/** 비교용 정규화 — 소문자 + 발음기호 제거 + 공백 정리. ('São Paulo' → 'sao paulo') */
function normalizeCity(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 한글 도시명 → IATA. 영문 표기가 비어 있는 행사(한글로만 입력)를 국가 폴백으로 흘리지 않기 위한 보조 테이블.
 * 국내 + 123Band 가 자주 다루는 아시아·오세아니아 도시만.
 */
const CITY_IATA_KO: Record<string, string> = {
  서울: 'SEL', 인천: 'SEL', 부산: 'PUS', 제주: 'CJU', 대구: 'TAE', 광주: 'KWJ',
  도쿄: 'TYO', 동경: 'TYO', 오사카: 'OSA', 후쿠오카: 'FUK', 오키나와: 'OKA', 삿포로: 'SPK',
  타이베이: 'TPE', 타이페이: 'TPE', 홍콩: 'HKG', 마카오: 'MFM', 상하이: 'SHA', 베이징: 'BJS',
  방콕: 'BKK', 푸켓: 'HKT', 치앙마이: 'CNX', 파타야: 'UTP',
  싱가포르: 'SIN', 쿠알라룸푸르: 'KUL', 자카르타: 'CGK', 발리: 'DPS', 세부: 'CEB',
  마닐라: 'MNL', 보홀: 'TAG', 보라카이: 'MPH',
  호치민: 'SGN', 하노이: 'HAN', 다낭: 'DAD', 푸꾸옥: 'PQC', 푸꾹: 'PQC', 나트랑: 'CXR',
  붕따우: 'SGN', 바리아붕따우: 'SGN', 달랏: 'DLI', 후에: 'HUI', 하이퐁: 'HPH', 껀터: 'VCA',
  시드니: 'SYD', 멜버른: 'MEL', 브리즈번: 'BNE', 오클랜드: 'AKL',
  두바이: 'DXB', 런던: 'LON', 파리: 'PAR', 바르셀로나: 'BCN', 마드리드: 'MAD',
  뉴욕: 'NYC', 로스앤젤레스: 'LAX', 엘에이: 'LAX', 마이애미: 'MIA',
};

// 부분 일치용 키 목록 — 긴 이름부터 본다('ho chi minh city' 가 'ho chi minh' 보다 먼저).
const CITY_KEYS_EN = Object.keys(CITY_IATA).sort((a, b) => b.length - a.length);
const CITY_KEYS_KO = Object.keys(CITY_IATA_KO).sort((a, b) => b.length - a.length);

/** 앞뒤를 공백으로 감싸 단어 단위로만 맞춘다. ('cali' 가 'california' 안에서 잡히지 않게) */
function containsCity(text: string, key: string): boolean {
  return ` ${text} `.includes(` ${key} `);
}

/**
 * 행사 주소 → 목적지 공항 코드.
 *
 * 정확히 일치(영문 → 한글) → 부분 일치(영문 → 한글) → 국가 관문공항 순.
 * 부분 일치가 필요한 이유: 주소의 도시 칸에 행정구역 수식어가 붙어 들어오는 경우가 많다.
 * 예) 'Phu Quoc Special Zone' 은 'phu quoc' 키와 정확히 일치하지 않아
 *     예전에는 베트남 국가 폴백(SGN 호치민)으로 흘러버렸다.
 */
export function destinationIata(address: EventAddress | undefined, country?: string): string {
  const en = [addrText(address?.city, 'en'), addrText(address?.province, 'en')].map((s) =>
    normalizeCity(s ?? ''),
  );
  const ko = [addrText(address?.city, 'ko'), addrText(address?.province, 'ko')].map((s) =>
    (s ?? '').replace(/\s+/g, ''),
  );

  for (const key of en) if (key && CITY_IATA[key]) return CITY_IATA[key];
  for (const key of ko) if (key && CITY_IATA_KO[key]) return CITY_IATA_KO[key];

  for (const text of en) {
    if (!text) continue;
    const hit = CITY_KEYS_EN.find((k) => containsCity(text, k));
    const code = hit && CITY_IATA[hit];
    if (code) return code;
  }
  for (const text of ko) {
    if (!text) continue;
    const hit = CITY_KEYS_KO.find((k) => text.includes(k));
    const code = hit && CITY_IATA_KO[hit];
    if (code) return code;
  }

  return COUNTRY_IATA[(country ?? '').toUpperCase()] ?? '';
}

// ── 출발지 선택지 ──────────────────────────────────────────────
// 목록이 길어 지역별 <optgroup> 으로 묶는다. 순서 = 한국 방문객 기준 가까운 지역부터.
// value = IATA '도시' 코드(공항 코드 아님) — 도시코드가 있으면 그쪽이 해당 도시 전 공항을 함께 검색한다.

export type OriginRegion = 'ea' | 'sea' | 'sa' | 'oc' | 'me' | 'eu' | 'na' | 'latam' | 'af';

export const ORIGIN_REGIONS: { key: OriginRegion; en: string; ko: string }[] = [
  { key: 'ea', en: 'East Asia', ko: '동아시아' },
  { key: 'sea', en: 'Southeast Asia', ko: '동남아시아' },
  { key: 'sa', en: 'South Asia', ko: '남아시아' },
  { key: 'oc', en: 'Oceania & Pacific', ko: '오세아니아·태평양' },
  { key: 'me', en: 'Middle East', ko: '중동' },
  { key: 'eu', en: 'Europe', ko: '유럽' },
  { key: 'na', en: 'North America', ko: '북미' },
  { key: 'latam', en: 'Latin America', ko: '중남미' },
  { key: 'af', en: 'Africa', ko: '아프리카' },
];

export interface OriginOption {
  iata: string;
  en: string;
  ko: string;
  region: OriginRegion;
}

/** 항공 검색 출발지 선택지. 새 도시가 필요하면 해당 지역 블록에 한 줄 추가하면 된다. */
export const ORIGIN_OPTIONS: OriginOption[] = [
  // 동아시아
  { iata: 'SEL', en: 'Seoul', ko: '서울', region: 'ea' },
  { iata: 'PUS', en: 'Busan', ko: '부산', region: 'ea' },
  { iata: 'CJU', en: 'Jeju', ko: '제주', region: 'ea' },
  { iata: 'TAE', en: 'Daegu', ko: '대구', region: 'ea' },
  { iata: 'KWJ', en: 'Gwangju', ko: '광주', region: 'ea' },
  { iata: 'CJJ', en: 'Cheongju', ko: '청주', region: 'ea' },
  { iata: 'TYO', en: 'Tokyo', ko: '도쿄', region: 'ea' },
  { iata: 'OSA', en: 'Osaka', ko: '오사카', region: 'ea' },
  { iata: 'NGO', en: 'Nagoya', ko: '나고야', region: 'ea' },
  { iata: 'FUK', en: 'Fukuoka', ko: '후쿠오카', region: 'ea' },
  { iata: 'SPK', en: 'Sapporo', ko: '삿포로', region: 'ea' },
  { iata: 'OKA', en: 'Okinawa', ko: '오키나와', region: 'ea' },
  { iata: 'TPE', en: 'Taipei', ko: '타이베이', region: 'ea' },
  { iata: 'KHH', en: 'Kaohsiung', ko: '가오슝', region: 'ea' },
  { iata: 'HKG', en: 'Hong Kong', ko: '홍콩', region: 'ea' },
  { iata: 'MFM', en: 'Macau', ko: '마카오', region: 'ea' },
  { iata: 'SHA', en: 'Shanghai', ko: '상하이', region: 'ea' },
  { iata: 'BJS', en: 'Beijing', ko: '베이징', region: 'ea' },
  { iata: 'CAN', en: 'Guangzhou', ko: '광저우', region: 'ea' },
  { iata: 'SZX', en: 'Shenzhen', ko: '선전', region: 'ea' },
  { iata: 'CTU', en: 'Chengdu', ko: '청두', region: 'ea' },
  // 동남아시아
  { iata: 'BKK', en: 'Bangkok', ko: '방콕', region: 'sea' },
  { iata: 'HKT', en: 'Phuket', ko: '푸껫', region: 'sea' },
  { iata: 'CNX', en: 'Chiang Mai', ko: '치앙마이', region: 'sea' },
  { iata: 'USM', en: 'Koh Samui', ko: '코사무이', region: 'sea' },
  { iata: 'SIN', en: 'Singapore', ko: '싱가포르', region: 'sea' },
  { iata: 'KUL', en: 'Kuala Lumpur', ko: '쿠알라룸푸르', region: 'sea' },
  { iata: 'PEN', en: 'Penang', ko: '페낭', region: 'sea' },
  { iata: 'CGK', en: 'Jakarta', ko: '자카르타', region: 'sea' },
  { iata: 'DPS', en: 'Bali (Denpasar)', ko: '발리(덴파사르)', region: 'sea' },
  { iata: 'SUB', en: 'Surabaya', ko: '수라바야', region: 'sea' },
  { iata: 'MNL', en: 'Manila', ko: '마닐라', region: 'sea' },
  { iata: 'CEB', en: 'Cebu', ko: '세부', region: 'sea' },
  { iata: 'DVO', en: 'Davao', ko: '다바오', region: 'sea' },
  { iata: 'SGN', en: 'Ho Chi Minh City', ko: '호치민', region: 'sea' },
  { iata: 'HAN', en: 'Hanoi', ko: '하노이', region: 'sea' },
  { iata: 'DAD', en: 'Da Nang', ko: '다낭', region: 'sea' },
  { iata: 'PQC', en: 'Phu Quoc', ko: '푸꾸옥', region: 'sea' },
  { iata: 'PNH', en: 'Phnom Penh', ko: '프놈펜', region: 'sea' },
  { iata: 'REP', en: 'Siem Reap', ko: '시엠립', region: 'sea' },
  { iata: 'VTE', en: 'Vientiane', ko: '비엔티안', region: 'sea' },
  { iata: 'RGN', en: 'Yangon', ko: '양곤', region: 'sea' },
  // 남아시아
  { iata: 'DEL', en: 'Delhi', ko: '델리', region: 'sa' },
  { iata: 'BOM', en: 'Mumbai', ko: '뭄바이', region: 'sa' },
  { iata: 'BLR', en: 'Bengaluru', ko: '벵갈루루', region: 'sa' },
  { iata: 'MAA', en: 'Chennai', ko: '첸나이', region: 'sa' },
  { iata: 'GOI', en: 'Goa', ko: '고아', region: 'sa' },
  { iata: 'CMB', en: 'Colombo', ko: '콜롬보', region: 'sa' },
  { iata: 'MLE', en: 'Malé', ko: '말레', region: 'sa' },
  { iata: 'KTM', en: 'Kathmandu', ko: '카트만두', region: 'sa' },
  { iata: 'DAC', en: 'Dhaka', ko: '다카', region: 'sa' },
  // 오세아니아·태평양
  { iata: 'SYD', en: 'Sydney', ko: '시드니', region: 'oc' },
  { iata: 'MEL', en: 'Melbourne', ko: '멜버른', region: 'oc' },
  { iata: 'BNE', en: 'Brisbane', ko: '브리즈번', region: 'oc' },
  { iata: 'OOL', en: 'Gold Coast', ko: '골드코스트', region: 'oc' },
  { iata: 'PER', en: 'Perth', ko: '퍼스', region: 'oc' },
  { iata: 'ADL', en: 'Adelaide', ko: '애들레이드', region: 'oc' },
  { iata: 'AKL', en: 'Auckland', ko: '오클랜드', region: 'oc' },
  { iata: 'WLG', en: 'Wellington', ko: '웰링턴', region: 'oc' },
  { iata: 'CHC', en: 'Christchurch', ko: '크라이스트처치', region: 'oc' },
  { iata: 'GUM', en: 'Guam', ko: '괌', region: 'oc' },
  { iata: 'SPN', en: 'Saipan', ko: '사이판', region: 'oc' },
  { iata: 'NAN', en: 'Nadi (Fiji)', ko: '나디(피지)', region: 'oc' },
  // 중동
  { iata: 'DXB', en: 'Dubai', ko: '두바이', region: 'me' },
  { iata: 'AUH', en: 'Abu Dhabi', ko: '아부다비', region: 'me' },
  { iata: 'DOH', en: 'Doha', ko: '도하', region: 'me' },
  { iata: 'RUH', en: 'Riyadh', ko: '리야드', region: 'me' },
  { iata: 'JED', en: 'Jeddah', ko: '제다', region: 'me' },
  { iata: 'KWI', en: 'Kuwait City', ko: '쿠웨이트', region: 'me' },
  { iata: 'TLV', en: 'Tel Aviv', ko: '텔아비브', region: 'me' },
  // 유럽
  { iata: 'LON', en: 'London', ko: '런던', region: 'eu' },
  { iata: 'PAR', en: 'Paris', ko: '파리', region: 'eu' },
  { iata: 'AMS', en: 'Amsterdam', ko: '암스테르담', region: 'eu' },
  { iata: 'BRU', en: 'Brussels', ko: '브뤼셀', region: 'eu' },
  { iata: 'FRA', en: 'Frankfurt', ko: '프랑크푸르트', region: 'eu' },
  { iata: 'MUC', en: 'Munich', ko: '뮌헨', region: 'eu' },
  { iata: 'BER', en: 'Berlin', ko: '베를린', region: 'eu' },
  { iata: 'ZRH', en: 'Zurich', ko: '취리히', region: 'eu' },
  { iata: 'VIE', en: 'Vienna', ko: '빈', region: 'eu' },
  { iata: 'PRG', en: 'Prague', ko: '프라하', region: 'eu' },
  { iata: 'WAW', en: 'Warsaw', ko: '바르샤바', region: 'eu' },
  { iata: 'BUD', en: 'Budapest', ko: '부다페스트', region: 'eu' },
  { iata: 'CPH', en: 'Copenhagen', ko: '코펜하겐', region: 'eu' },
  { iata: 'STO', en: 'Stockholm', ko: '스톡홀름', region: 'eu' },
  { iata: 'OSL', en: 'Oslo', ko: '오슬로', region: 'eu' },
  { iata: 'HEL', en: 'Helsinki', ko: '헬싱키', region: 'eu' },
  { iata: 'DUB', en: 'Dublin', ko: '더블린', region: 'eu' },
  { iata: 'MAD', en: 'Madrid', ko: '마드리드', region: 'eu' },
  { iata: 'BCN', en: 'Barcelona', ko: '바르셀로나', region: 'eu' },
  { iata: 'LIS', en: 'Lisbon', ko: '리스본', region: 'eu' },
  { iata: 'OPO', en: 'Porto', ko: '포르투', region: 'eu' },
  { iata: 'ROM', en: 'Rome', ko: '로마', region: 'eu' },
  { iata: 'MIL', en: 'Milan', ko: '밀라노', region: 'eu' },
  { iata: 'ATH', en: 'Athens', ko: '아테네', region: 'eu' },
  { iata: 'IST', en: 'Istanbul', ko: '이스탄불', region: 'eu' },
  // 북미
  { iata: 'NYC', en: 'New York', ko: '뉴욕', region: 'na' },
  { iata: 'WAS', en: 'Washington, D.C.', ko: '워싱턴 D.C.', region: 'na' },
  { iata: 'BOS', en: 'Boston', ko: '보스턴', region: 'na' },
  { iata: 'CHI', en: 'Chicago', ko: '시카고', region: 'na' },
  { iata: 'ATL', en: 'Atlanta', ko: '애틀랜타', region: 'na' },
  { iata: 'MIA', en: 'Miami', ko: '마이애미', region: 'na' },
  { iata: 'MCO', en: 'Orlando', ko: '올랜도', region: 'na' },
  { iata: 'DFW', en: 'Dallas', ko: '댈러스', region: 'na' },
  { iata: 'IAH', en: 'Houston', ko: '휴스턴', region: 'na' },
  { iata: 'DEN', en: 'Denver', ko: '덴버', region: 'na' },
  { iata: 'PHX', en: 'Phoenix', ko: '피닉스', region: 'na' },
  { iata: 'LAS', en: 'Las Vegas', ko: '라스베이거스', region: 'na' },
  { iata: 'SEA', en: 'Seattle', ko: '시애틀', region: 'na' },
  { iata: 'SFO', en: 'San Francisco', ko: '샌프란시스코', region: 'na' },
  { iata: 'LAX', en: 'Los Angeles', ko: '로스앤젤레스', region: 'na' },
  { iata: 'SAN', en: 'San Diego', ko: '샌디에이고', region: 'na' },
  { iata: 'HNL', en: 'Honolulu', ko: '호놀룰루', region: 'na' },
  { iata: 'YTO', en: 'Toronto', ko: '토론토', region: 'na' },
  { iata: 'YVR', en: 'Vancouver', ko: '밴쿠버', region: 'na' },
  { iata: 'YMQ', en: 'Montreal', ko: '몬트리올', region: 'na' },
  { iata: 'YYC', en: 'Calgary', ko: '캘거리', region: 'na' },
  // 중남미
  { iata: 'MEX', en: 'Mexico City', ko: '멕시코시티', region: 'latam' },
  { iata: 'GDL', en: 'Guadalajara', ko: '과달라하라', region: 'latam' },
  { iata: 'CUN', en: 'Cancún', ko: '칸쿤', region: 'latam' },
  { iata: 'GUA', en: 'Guatemala City', ko: '과테말라시티', region: 'latam' },
  { iata: 'SJO', en: 'San José', ko: '산호세', region: 'latam' },
  { iata: 'PTY', en: 'Panama City', ko: '파나마시티', region: 'latam' },
  { iata: 'HAV', en: 'Havana', ko: '아바나', region: 'latam' },
  { iata: 'SDQ', en: 'Santo Domingo', ko: '산토도밍고', region: 'latam' },
  { iata: 'PUJ', en: 'Punta Cana', ko: '푼타카나', region: 'latam' },
  { iata: 'SJU', en: 'San Juan', ko: '산후안', region: 'latam' },
  { iata: 'BOG', en: 'Bogotá', ko: '보고타', region: 'latam' },
  { iata: 'MDE', en: 'Medellín', ko: '메데인', region: 'latam' },
  { iata: 'CLO', en: 'Cali', ko: '칼리', region: 'latam' },
  { iata: 'CTG', en: 'Cartagena', ko: '카르타헤나', region: 'latam' },
  { iata: 'CCS', en: 'Caracas', ko: '카라카스', region: 'latam' },
  { iata: 'LIM', en: 'Lima', ko: '리마', region: 'latam' },
  { iata: 'UIO', en: 'Quito', ko: '키토', region: 'latam' },
  { iata: 'GYE', en: 'Guayaquil', ko: '과야킬', region: 'latam' },
  { iata: 'SCL', en: 'Santiago', ko: '산티아고', region: 'latam' },
  { iata: 'BUE', en: 'Buenos Aires', ko: '부에노스아이레스', region: 'latam' },
  { iata: 'MVD', en: 'Montevideo', ko: '몬테비데오', region: 'latam' },
  { iata: 'SAO', en: 'São Paulo', ko: '상파울루', region: 'latam' },
  { iata: 'RIO', en: 'Rio de Janeiro', ko: '리우데자네이루', region: 'latam' },
  { iata: 'BSB', en: 'Brasília', ko: '브라질리아', region: 'latam' },
  { iata: 'SSA', en: 'Salvador', ko: '사우바도르', region: 'latam' },
  // 아프리카
  { iata: 'CAI', en: 'Cairo', ko: '카이로', region: 'af' },
  { iata: 'CMN', en: 'Casablanca', ko: '카사블랑카', region: 'af' },
  { iata: 'RAK', en: 'Marrakesh', ko: '마라케시', region: 'af' },
  { iata: 'TUN', en: 'Tunis', ko: '튀니스', region: 'af' },
  { iata: 'ADD', en: 'Addis Ababa', ko: '아디스아바바', region: 'af' },
  { iata: 'NBO', en: 'Nairobi', ko: '나이로비', region: 'af' },
  { iata: 'LOS', en: 'Lagos', ko: '라고스', region: 'af' },
  { iata: 'ACC', en: 'Accra', ko: '아크라', region: 'af' },
  { iata: 'JNB', en: 'Johannesburg', ko: '요하네스버그', region: 'af' },
  { iata: 'CPT', en: 'Cape Town', ko: '케이프타운', region: 'af' },
  { iata: 'MRU', en: 'Mauritius', ko: '모리셔스', region: 'af' },
];

/**
 * <optgroup> 렌더용 — 지역 순서대로 묶고, 그룹 안은 화면 언어 기준 가나다/알파벳 순.
 * exclude(=목적지)는 출발지에서 빼고, 그 때문에 비는 그룹도 함께 제거한다.
 */
export function originGroups(
  locale: Locale,
  exclude?: string,
): { key: OriginRegion; label: string; options: OriginOption[] }[] {
  const collator = new Intl.Collator(locale === 'ko' ? 'ko' : 'en');
  return ORIGIN_REGIONS.map((r) => ({
    key: r.key,
    label: locale === 'ko' ? r.ko : r.en,
    options: ORIGIN_OPTIONS.filter((o) => o.region === r.key && o.iata !== exclude).sort((a, b) =>
      collator.compare(locale === 'ko' ? a.ko : a.en, locale === 'ko' ? b.ko : b.en),
    ),
  })).filter((g) => g.options.length > 0);
}

// ── 목적지 표기 ────────────────────────────────────────────────

/** ORIGIN_OPTIONS 에는 없지만 목적지로는 나올 수 있는 코드들의 표기명. */
const EXTRA_AIRPORT_NAMES: Record<string, { en: string; ko: string }> = {
  RMQ: { en: 'Taichung', ko: '타이중' },
  UTP: { en: 'Pattaya', ko: '파타야' },
  LGK: { en: 'Langkawi', ko: '랑카위' },
  TAG: { en: 'Bohol (Tagbilaran)', ko: '보홀(타그빌라란)' },
  MPH: { en: 'Boracay (Caticlan)', ko: '보라카이(카티클란)' },
  PPS: { en: 'Palawan (Puerto Princesa)', ko: '팔라완(푸에르토프린세사)' },
  CXR: { en: 'Nha Trang', ko: '나트랑' },
  DLI: { en: 'Da Lat', ko: '달랏' },
  HUI: { en: 'Hue', ko: '후에' },
  HPH: { en: 'Hai Phong', ko: '하이퐁' },
  VCA: { en: 'Can Tho', ko: '껀터' },
  CBR: { en: 'Canberra', ko: '캔버라' },
  MOW: { en: 'Moscow', ko: '모스크바' },
};

/** IATA → 표기명. destinationIata 가 돌려줄 수 있는 코드는 전부 여기서 이름이 나와야 한다. */
const AIRPORT_NAMES: Record<string, { en: string; ko: string }> = {
  ...EXTRA_AIRPORT_NAMES,
  ...Object.fromEntries(ORIGIN_OPTIONS.map((o) => [o.iata, { en: o.en, ko: o.ko }])),
};

/** 코드에 해당하는 도시명. 모르는 코드면 코드 자체를 돌려준다. */
export function airportLabel(iata: string, locale: Locale): string {
  const name = AIRPORT_NAMES[iata];
  return name ? (locale === 'ko' ? name.ko : name.en) : iata;
}

/**
 * 목적지 공항 + 화면 표기.
 *
 * 행사 도시에 공항이 없으면 관문공항으로 떨어진다(예: 붕따우 → SGN 호치민).
 * 이때 화면에 행사 도시명을 그대로 쓰면 실제 검색 결과(호치민)와 달라 보이므로,
 * 표기는 항상 '검색에 쓰는 공항의 도시'로 하고 행사 도시는 nearCity 로 따로 넘긴다.
 */
export function destinationAirport(
  address: EventAddress | undefined,
  country: string | undefined,
  locale: Locale,
): { iata: string; label: string; nearCity: string } {
  const iata = destinationIata(address, country);
  if (!iata) return { iata: '', label: '', nearCity: '' };
  const label = airportLabel(iata, locale);
  const city = (addrText(address?.city, locale) || addrText(address?.province, locale) || '').trim();
  // 표기명이 행사 도시를 이미 담고 있으면(서울=서울, 보홀⊂'보홀(타그빌라란)') 덧붙일 게 없다.
  const a = label.toLowerCase();
  const b = city.toLowerCase();
  const covered = !city || a.includes(b) || b.includes(a);
  return { iata, label, nearCity: covered ? '' : city };
}

/** YYYY-MM-DD → DDMM (Aviasales 경로 코드가 쓰는 날짜 표기) */
function ddmm(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return m ? `${m[3]}${m[2]}` : '';
}

/**
 * Aviasales(Travelpayouts) 프리셋 검색 링크.
 * marker 가 파트너 식별자 — 이게 없으면 수수료가 잡히지 않으므로 빈 문자열을 돌려준다.
 *
 * 호스트는 반드시 www.aviasales.com (국제판, 항상 영어).
 * search.aviasales.com/flights/?... 는 302 로 www.aviasales.ru 로 넘겨 러시아어 첫 화면을 띄우고
 * 검색 조건도 잃어버린다. 국제판은 경로 코드 방식만 받는다:
 *   /search/{출발지}{출발일DDMM}{목적지}{귀국일DDMM}{성인수}   왕복
 *   /search/{출발지}{출발일DDMM}{목적지}{성인수}               편도
 * 예) 11/05 서울 → 방콕, 11/09 귀국, 성인 1 = /search/SEL0511BKK09111
 */
export function flightSearchUrl(opts: {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  locale: Locale;
  campaign?: string;
}): string {
  const { origin, destination, departDate, returnDate, locale, campaign } = opts;
  if (!TRAVELPAYOUTS_MARKER || !origin || !destination) return '';
  const depart = ddmm(departDate);
  if (!depart) return '';
  const back = returnDate && returnDate > departDate ? ddmm(returnDate) : '';
  const route = `${origin}${depart}${destination}${back}1`; // 끝의 1 = 성인 1명
  // SubID 로 어떤 행사에서 넘어온 클릭인지 구분 (marker=123456.evt-slug)
  const sub = (campaign ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  const p = new URLSearchParams({
    marker: sub ? `${TRAVELPAYOUTS_MARKER}.${sub}` : TRAVELPAYOUTS_MARKER,
    // 국제판은 UI 언어가 영어 고정이라 통화만 화면 언어에 맞춘다(티켓 가격과 같은 기준).
    currency: currencyForLocale(locale).toLowerCase(),
    locale: 'en',
  });
  return `https://www.aviasales.com/search/${route}?${p.toString()}`;
}

/**
 * Stay22 지도 임베드 URL. 좌표가 있으면 좌표로, 없으면 주소 문자열로 위치를 잡는다.
 * aid 는 Stay22 문서 권고대로 첫 파라미터로 둔다(오류 탐지·리포팅 정확도).
 */
export function stayEmbedUrl(opts: {
  address?: EventAddress;
  addressText?: string;
  checkin: string;
  checkout: string;
  locale: Locale;
  campaign?: string;
}): string {
  const { address, addressText, checkin, checkout, locale, campaign } = opts;
  if (!STAY22_AID) return '';
  const hasGeo = typeof address?.lat === 'number' && typeof address?.lng === 'number';
  if (!hasGeo && !addressText?.trim()) return '';
  const p = new URLSearchParams({ aid: STAY22_AID });
  if (hasGeo) {
    p.set('lat', String(address!.lat));
    p.set('lng', String(address!.lng));
  }
  if (addressText?.trim()) p.set('address', addressText.trim());
  if (checkin) p.set('checkin', checkin);
  if (checkout) p.set('checkout', checkout);
  p.set('maincolor', 'fa520f'); // 123Band 프라이머리(선셋 오렌지)
  p.set('hidebrand', 'true');
  p.set('lang', locale === 'ko' ? 'ko' : 'en');
  // 매물(=공급사) 다양성. Stay22 는 부킹닷컴·익스피디아·호텔스닷컴·아고다·브르보·에어비앤비 등을
  // 한꺼번에 물어보고 지도에 얹는데, 노출 개수와 지도 반경이 좁으면 특정 공급사만 남는다.
  //  · limit  — 기본값은 미설정(=적게). 허용 최대치(5~99)까지 올린다.
  //  · zoom   — 기본 16 은 골목 단위라 반경이 너무 좁다. 14 ≈ 행사장 주변 동네 전체.
  // hotelsapi/rentalsapi 는 '한 공급사로 고정'하는 옵션이라 다양성을 오히려 줄인다 — 쓰지 않는다.
  p.set('limit', '99');
  p.set('zoom', '14');
  // 통화를 안 넘기면 Stay22 가 접속 위치로 추정한다(한국에서 EN 화면을 봐도 ₩ 로 나옴).
  // 티켓 가격과 같은 기준으로 고정한다: KO=KRW, 그 외=USD.
  p.set('currency', currencyForLocale(locale));
  if (campaign) p.set('campaign', campaign.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40));
  return `https://www.stay22.com/embed/gm?${p.toString()}`;
}
