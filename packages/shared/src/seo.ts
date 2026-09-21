// Design Ref: §7 SEO — 타이틀 태그 작성 규칙(단일 소스). web 메타 생성 + 어드민/파트너 미리보기 공용.
//
// ── 작성 규칙 ────────────────────────────────────────────────────────────────
//  형식: [행사명] [유형] [연도] [의도어] — [도시, 국가] | [일정] | [브랜드]
//  예)   MBF Melbourne Bachata Festival 2026 Tickets — Australia
//        MBF 멜버른 바차타 페스티벌 2026 티켓 — 호주 | 123Band
//
//  1) 왼쪽 우선: 검색 매칭에 가장 중요한 고유명(행사명)이 항상 맨 앞. 브랜드는 맨 뒤.
//  2) 의도어(Tickets/티켓): "…festival tickets" 류 구매 의도 검색어에 매칭시키는 핵심 토큰.
//  3) 로컬 시그널(도시/국가): 지역 검색("bachata festival melbourne")을 잡는다.
//  4) 중복 금지: 행사명에 이미 들어있는 연도·유형·도시·국가·의도어는 다시 붙이지 않는다.
//  5) 길이 예산(TITLE_MAX_WIDTH, 한글=2폭): 초과하면 DROP_ORDER 순서로 뒤쪽 신호부터 덜어낸다.
//     날짜 → 브랜드 → 국가 → 도시 → 유형 → 의도어. (검색노출 가치가 낮은 것부터)
//  6) 수동 입력(seo.title)이 있으면 그 문구를 base 로 존중하고, 빠진 신호만 보충한다.
//     수동 입력의 ' | ' 뒤 꼬리말(예: "| Oct 2–4")은 날짜 슬롯으로 취급해 같은 우선순위로 덜어낸다.
import type { EventType, Locale } from './types/index';

export const SEO_BRAND = '123Band';
/** 검색결과 제목 표시 예산(폭). 구글은 ≈600px 에서 자른다 → 영문 60자 / 한글 30자. */
export const TITLE_MAX_WIDTH = 60;
/** 링크 공유(OG/트위터) 제목 예산 — 카드 쪽은 여유가 있어 더 길게 허용. */
export const TITLE_SHARE_MAX_WIDTH = 88;

/** 표시폭 — CJK/한글은 2, 그 외 1. (제목 잘림은 글자수가 아니라 폭 기준) */
export function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    const wide =
      (c >= 0x1100 && c <= 0x115f) ||
      (c >= 0x2e80 && c <= 0xa4cf) ||
      (c >= 0xac00 && c <= 0xd7a3) ||
      (c >= 0xf900 && c <= 0xfaff) ||
      (c >= 0xfe30 && c <= 0xfe4f) ||
      (c >= 0xff00 && c <= 0xff60) ||
      (c >= 0xffe0 && c <= 0xffe6);
    w += wide ? 2 : 1;
  }
  return w;
}

/** 폭 기준 말줄임 — 되도록 단어 경계에서 자른다. */
export function clampWidth(s: string, max: number): string {
  const t = s.trim();
  if (displayWidth(t) <= max) return t;
  let out = '';
  let w = 0;
  for (const ch of t) {
    const cw = displayWidth(ch);
    if (w + cw > max - 1) break; // 말줄임표(…) 자리 1
    out += ch;
    w += cw;
  }
  const sp = out.lastIndexOf(' ');
  const body = sp > 0 && sp >= out.length * 0.7 ? out.slice(0, sp) : out;
  return `${body.replace(/[\s|—·,]+$/, '')}…`;
}

/** 행사 유형 → 제목에 붙일 표시어. other 는 빈 문자열(붙이지 않음). */
const EVENT_TYPE_WORD: Record<EventType, Record<string, string>> = {
  festival: { en: 'Festival', ko: '페스티벌', ja: 'フェスティバル', 'zh-TW': '嘉年華' },
  congress: { en: 'Congress', ko: '콩그레스', ja: 'コングレス', 'zh-TW': '大會' },
  workshop: { en: 'Workshop', ko: '워크숍', ja: 'ワークショップ', 'zh-TW': '工作坊' },
  bootcamp: { en: 'Bootcamp', ko: '부트캠프', ja: 'ブートキャンプ', 'zh-TW': '訓練營' },
  party: { en: 'Party', ko: '파티', ja: 'パーティー', 'zh-TW': '派對' },
  social: { en: 'Social', ko: '소셜파티', ja: 'ソーシャル', 'zh-TW': '社交舞會' },
  competition: { en: 'Competition', ko: '대회', ja: '大会', 'zh-TW': '比賽' },
  other: { en: '', ko: '', ja: '', 'zh-TW': '' },
};

/** 구매 의도어 — "…tickets" 검색어 매칭용. */
const TICKETS_WORD: Record<string, string> = {
  en: 'Tickets',
  ko: '티켓',
  ja: 'チケット',
  'zh-TW': '門票',
};

const MONTHS_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function loc(map: Record<string, string>, locale: Locale): string {
  return map[locale] ?? map.en ?? '';
}

/** 'YYYY-MM-DDTHH:mm'(KST 관례) / ISO → [연, 월, 일]. 문자열에서 직접 읽어 타임존 이동을 막는다. */
function ymd(s?: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((s ?? '').trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** 일정 → 제목용 짧은 기간 표기. 연도는 제목 앞쪽(연도 토큰)이 담당하므로 넣지 않는다. */
export function titleDateRange(startAt?: string, endAt?: string, locale: Locale = 'en'): string {
  const s = ymd(startAt);
  if (!s) return '';
  const e = ymd(endAt);
  const [, sm, sd] = s;
  const sameDay = !e || (e[0] === s[0] && e[1] === sm && e[2] === sd);
  const sameMonth = !!e && e[0] === s[0] && e[1] === sm;
  if (locale === 'en') {
    const a = `${MONTHS_EN[sm - 1]} ${sd}`;
    if (sameDay) return a;
    if (sameMonth) return `${a}–${e![2]}`;
    return `${a} – ${MONTHS_EN[e![1] - 1]} ${e![2]}`;
  }
  if (locale === 'ko') {
    const a = `${sm}월 ${sd}`;
    if (sameDay) return `${a}일`;
    if (sameMonth) return `${a}~${e![2]}일`;
    return `${a}일~${e![1]}월 ${e![2]}일`;
  }
  const a = `${sm}月${sd}`;
  if (sameDay) return `${a}日`;
  if (sameMonth) return `${a}–${e![2]}日`;
  return `${a}日–${e![1]}月${e![2]}日`;
}

/** 제목에 이미 들어있는 신호인지 (대소문자 무시, 공백 정규화) */
function has(haystack: string, needle?: string | null): boolean {
  const n = (needle ?? '').trim().toLowerCase();
  if (!n) return false;
  return haystack.toLowerCase().replace(/\s+/g, ' ').includes(n);
}

/** 한글/CJK 포함 여부 — 제목 언어와 도시명 표기 언어가 어긋나는 것을 막는 판별에 쓴다. */
function hasCjk(s: string): boolean {
  return /[぀-ヿ㐀-䶿一-鿿가-힣]/.test(s);
}

/** 도시 후보의 표기 언어가 제목과 맞는지.
 *  예) 한글 제목("방콕 살사…")에 영문 'Bangkok' 을 끼워 넣으면 어색하고 검색에도 도움이 안 된다.
 *  제목 자체가 로마자면(브랜드명 등) 영문 도시명도 허용한다. */
function scriptMatches(candidate: string, base: string, locale: Locale): boolean {
  if (locale === 'en') return !hasCjk(candidate);
  return hasCjk(candidate) || !hasCjk(base);
}

/** ISO2 국가코드 → 표시명. 한국어는 검색어로 실제 쓰이는 통칭을 우선한다(오스트레일리아→호주). */
const KO_COUNTRY_ALIAS: Record<string, string> = {
  AU: '호주',
  CZ: '체코',
  DO: '도미니카',
  AE: 'UAE',
  NZ: '뉴질랜드',
};
export function countryLabel(code: string | null | undefined, locale: Locale): string {
  const c = (code ?? '').trim();
  if (!c) return '';
  if (!/^[A-Za-z]{2}$/.test(c)) return c; // 이미 표시명으로 저장된 레거시 값
  const iso = c.toUpperCase();
  if (locale === 'ko' && KO_COUNTRY_ALIAS[iso]) return KO_COUNTRY_ALIAS[iso];
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(iso) ?? iso;
  } catch {
    return iso;
  }
}

/** 날짜스러운 꼬리말인지 — 수동 입력의 "| Oct 2–4" 같은 조각을 날짜 슬롯으로 취급하기 위한 판별 */
function looksLikeDate(s: string): boolean {
  return /\d/.test(s) && (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(s) || /[월日月]/.test(s));
}

export interface EventTitleInput {
  locale: Locale;
  /** 상품명(행사명) — 필수 base */
  name: string;
  /** 오거나이저/어드민이 직접 쓴 SEO 제목. 있으면 이 문구를 base 로 존중한다. */
  manual?: string;
  eventType?: EventType | null;
  /** 도시 후보(우선순위 순) — city → province → venue → 주소 첫 조각. 첫 유효값만 사용. */
  cityCandidates?: (string | null | undefined)[];
  /** 국가 표시명(로케일 변환 완료값) */
  country?: string | null;
  startAt?: string;
  endAt?: string;
  /** 의도어(Tickets/티켓) 추가 여부 — 티켓 상품만 true. 기본 true */
  intent?: boolean;
  /** 브랜드 접미사 사용 여부. 기본 true (예산 초과 시엔 규칙에 따라 먼저 탈락) */
  brand?: boolean;
  /** 표시폭 예산. 기본 TITLE_MAX_WIDTH(60) */
  maxWidth?: number;
}

/** 예산 초과 시 덜어내는 순서 — 검색노출 기여도가 낮은 신호부터.
 *  extras = 수동 제목의 ' | ' 뒤 꼬리말 중 날짜가 아닌 것. 오거나이저가 쓴 문구라 늦게 덜어낸다. */
const DROP_ORDER = ['date', 'brand', 'country', 'city', 'extras', 'type', 'intent'] as const;
type Flag = (typeof DROP_ORDER)[number];

/**
 * 이벤트(티켓) 상세용 타이틀 태그 생성.
 * 규칙은 파일 상단 주석 참고. 반환값은 그대로 <title> 에 넣을 최종 문자열.
 */
export function buildEventTitle(input: EventTitleInput): string {
  const {
    locale,
    name,
    manual,
    eventType,
    cityCandidates = [],
    country,
    startAt,
    endAt,
    intent = true,
    brand = true,
    maxWidth = TITLE_MAX_WIDTH,
  } = input;

  // 수동 입력이 있으면 그것이 base. ' | ' 뒤 꼬리말은 뒤쪽 슬롯으로 분리한다.
  const source = (manual || name || '').trim();
  const segs = source.split(/\s*[|｜]\s*/).map((s) => s.trim()).filter(Boolean);
  let base = segs[0] || name.trim();
  const extras = segs.slice(1);
  if (!base) return SEO_BRAND;

  // "행사명 – 20th Anniversary…" / "행사명 – Dec 3-7" 처럼 대시 뒤에 부제·일정이 붙은 수동 제목은
  // 뒤를 떼어내 예산이 모자랄 때 의도어(Tickets)보다 먼저 덜어낼 수 있게 한다.
  // 단, 대시 앞이 약칭뿐이면("PSLF 2026 – Phu Quoc…") 뒤가 진짜 행사명이므로 건드리지 않는다.
  const dashTail = /^(.+?\S)\s*(?:[–—]|\s-\s)\s*(.+)$/.exec(base);
  const dashHead = dashTail?.[1] ?? '';
  const dashRest = dashTail?.[2] ?? '';
  if (
    dashHead &&
    dashRest &&
    (looksLikeDate(dashRest) ||
      (displayWidth(dashHead) >= 18 && dashHead.split(/\s+/).filter(Boolean).length >= 3))
  ) {
    base = dashHead;
    extras.unshift(dashRest);
  }

  // 중복 판정은 원문 전체(꼬리말 포함) 기준
  const full = source;

  // eventType 은 DB(jsonb) 값이라 목록 밖 문자열일 수 있다 → 없으면 유형어 생략
  const typeWord = eventType ? loc(EVENT_TYPE_WORD[eventType] ?? {}, locale) : '';
  const intentWord = intent ? loc(TICKETS_WORD, locale) : '';
  const year = ymd(startAt)?.[0];

  // 도시 후보 — 구조적으로 도시일 수 없는 값만 여기서 거른다. 중복 판정은 compose 에서 매번 다시.
  // 숫자가 섞인 값은 도시가 아니다 — 도로명("64 Dawson St")·층수("B1")·우편번호 등.
  const cities = cityCandidates
    .map((c) => (c ?? '').trim())
    .filter(
      (v) =>
        v &&
        v.length <= 24 &&
        !/\d/.test(v) &&
        scriptMatches(v, base, locale) &&
        !(country && v.toLowerCase() === country.trim().toLowerCase()),
    );

  // 날짜: 수동 꼬리말에 날짜가 있으면 그것을 쓰고 생성하지 않는다.
  const manualDate = extras.filter(looksLikeDate);
  const otherExtras = extras.filter((e) => !looksLikeDate(e));
  const dateWord = manualDate.length ? manualDate.join(' · ') : titleDateRange(startAt, endAt, locale);

  const on: Record<Flag, boolean> = {
    date: Boolean(dateWord),
    brand,
    country: Boolean(country),
    city: cities.length > 0,
    extras: otherExtras.length > 0,
    type: Boolean(typeWord),
    intent: Boolean(intentWord),
  };

  // 중복 판정은 '지금 남아있는 문구' 기준으로 매번 다시 한다.
  // (부제를 덜어내면 그 안에 있던 유형어·연도·지명이 사라지므로 그때는 다시 붙여야 한다)
  const compose = (): string => {
    const keptExtras = on.extras ? otherExtras : [];
    const kept = [base, ...keptExtras].join(' ');
    const useType = on.type && !has(kept, typeWord);
    const useIntent = on.intent && !has(kept, intentWord);
    const useYear = year && !/\b(19|20)\d{2}\b/.test(kept) ? String(year) : '';
    const useDate = on.date && dateWord && !has(kept, dateWord) ? dateWord : '';
    const useCity = (on.city && cities.find((v) => !has(kept, v))) || '';
    const useCountry =
      on.country && country && !has(kept, country) && !has(useCity, country) ? country.trim() : '';

    const head = [base, useType ? typeWord : '', useYear, useIntent ? intentWord : '']
      .filter(Boolean)
      .join(' ');
    const place = [useCity, useCountry].filter(Boolean).join(', ');
    const tail = [...keptExtras, useDate, on.brand ? SEO_BRAND : ''].filter(Boolean);
    return [place ? `${head} — ${place}` : head, ...tail].join(' | ');
  };

  let title = compose();
  const dropped: Flag[] = [];
  for (const flag of DROP_ORDER) {
    if (displayWidth(title) <= maxWidth) break;
    on[flag] = false;
    dropped.push(flag);
    title = compose();
  }
  // 덩치 큰 항목(부제 등)을 덜어내 예산이 남았으면, 가치 높은 순으로 되살린다.
  // 이게 없으면 "…Fiesta 2026 Tickets"(42폭)처럼 자리가 18폭 남는데 국가를 못 넣는 일이 생긴다.
  for (const flag of dropped.reverse()) {
    on[flag] = true;
    const retry = compose();
    if (displayWidth(retry) <= maxWidth) title = retry;
    else on[flag] = false;
  }
  if (displayWidth(title) <= maxWidth) return title;
  // 다 덜어내도 예산을 넘는다 = 행사명 자체가 긴 경우.
  // 여기서 말줄임(…)으로 잘라내면 뒷부분 키워드가 색인에서도 사라진다 → 자르지 않고 그대로 둔다.
  // (구글은 표시할 때만 자르고 색인은 전체를 한다. 어드민 미리보기에서 빨간색으로 경고해 사람이 줄이게 유도.)
  return clampWidth(title, maxWidth * 2); // 비정상 데이터(수백 자)에 대한 안전장치만
}
