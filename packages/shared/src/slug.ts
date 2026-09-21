// Design Ref: §7 SEO — URL 슬러그 생성 규칙(단일 소스). web 라우팅 + 어드민/파트너 URL 미리보기 공용.
//
// ── 형식 ─────────────────────────────────────────────────────────────────────
//  티켓(행사)  /{locale}/events/{행사명}-{유형}-{도시}-{연도}-tickets
//  그 외 상품  /{locale}/shop/{상품명}
//  레거시      /{locale}/products/{uuid}  → 위 정식 URL 로 301
//
//  예) /en/events/mbf-melbourne-bachata-festival-2026-tickets
//      /ko/events/mbf-melbourne-bachata-festival-2026-tickets   ← 슬러그는 로케일 공용
//
// ── 규칙 ─────────────────────────────────────────────────────────────────────
//  1) 소문자 ASCII + 하이픈만. 밑줄·공백·대문자·퍼센트인코딩 없음.
//  2) 이름이 맨 앞. 이름에 이미 있는 토큰(유형·도시·연도·tickets)은 다시 붙이지 않는다.
//  3) 의도어 tickets 는 티켓 상품에만. "…festival tickets" 검색어와 URL 이 매칭된다.
//  4) 슬러그는 로케일 공용(영문 1개). 한/영 페이지가 같은 슬러그를 쓰므로 hreflang 짝이 항상 성립한다.
//  5) 길이 예산(SLUG_MAX). 초과하면 유형 → 도시 → 의도어 → 연도 순으로 덜어낸다.
//     연도를 마지막까지 남기는 이유: 연차 행사(2026/2027)가 같은 슬러그로 충돌하는 것을 막는다.
//  6) 한 번 발행된 슬러그는 고정. 이름을 바꿔도 URL 은 그대로 두고, 사람이 직접 바꿨을 때만
//     옛 슬러그를 products.previous_slugs 에 남겨 301 로 이어준다. (DB 트리거 0035)
import type { EventType, I18n, Locale } from './types/index';

/** 슬러그 전체 길이 예산. 구글 결과에 URL 이 잘리지 않고, 공유 링크가 한 줄에 들어가는 선. */
export const SLUG_MAX = 72;
/** 이름 부분 상한 — 이름만으로 예산을 다 먹으면 뒤 신호가 못 들어간다. */
const NAME_MAX = 56;

/** 라우트 세그먼트와 겹치면 안 되는 슬러그. (도시 허브 /events/in/{city} 확장 대비 예약) */
const RESERVED = new Set(['in', 'all', 'new', 'page', 'search', 'tag', 'city', 'index']);

// ── 로마자 변환 ───────────────────────────────────────────────────────────────
// 한글 음절 → 국어의 로마자 표기법(근사). 연음·자음동화는 적용하지 않는다(슬러그 용도).
const HANGUL_INITIAL = ['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h'];
const HANGUL_MEDIAL = ['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i'];
const HANGUL_FINAL = ['','k','k','k','n','n','n','t','l','k','m','p','t','t','p','l','m','p','p','t','t','ng','t','t','k','t','p','t'];

/** NFKD 로 분해되지 않는 라틴 확장 문자 — 발음구별기호 제거만으로는 사라지지 않아 따로 매핑. */
const LATIN_EXTRA: Record<string, string> = {
  ø: 'o', Ø: 'o', æ: 'ae', Æ: 'ae', œ: 'oe', Œ: 'oe',
  ß: 'ss', þ: 'th', Þ: 'th', ð: 'd', Ð: 'd', đ: 'd', Đ: 'd', ł: 'l', Ł: 'l',
};

/** 한글 음절을 로마자로. 그 외 문자는 그대로 통과시킨다. */
export function romanizeHangul(input: string): string {
  let out = '';
  for (const ch of input) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 0xac00 || c > 0xd7a3) {
      out += ch;
      continue;
    }
    const n = c - 0xac00;
    out += HANGUL_INITIAL[Math.floor(n / 588)] ?? '';
    out += HANGUL_MEDIAL[Math.floor((n % 588) / 28)] ?? '';
    out += HANGUL_FINAL[n % 28] ?? '';
  }
  return out;
}

/** 임의 문자열 → URL 슬러그 조각(소문자 ASCII + 하이픈). 변환 불가 문자는 사라진다. */
export function slugify(input: string): string {
  const s = romanizeHangul(String(input ?? ''))
    .replace(/[øØæÆœŒßþÞðÐđĐłŁ]/g, (c) => LATIN_EXTRA[c] ?? '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '') // 결합기호(발음구별기호) 제거 — NFKD 로 분리된 뒤라 안전 (Coruña → coruna)
    .replace(/&/g, ' and ')
    .replace(/['’`´]/g, ''); // 아포스트로피는 붙여서 (Lucia's → lucias)
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** 하이픈 경계에서 자르는 길이 제한. 단어 중간에서 끊지 않는다. */
function clampSlug(slug: string, max: number): string {
  if (slug.length <= max) return slug;
  const cut = slug.slice(0, max);
  const hy = cut.lastIndexOf('-');
  return (hy > max * 0.5 ? cut.slice(0, hy) : cut).replace(/-+$/, '');
}

/** 이미 들어있는 토큰인지 — 부분일치가 아니라 하이픈 토큰 단위로 본다. */
function hasToken(slug: string, piece: string): boolean {
  if (!piece) return true;
  const have = new Set(slug.split('-'));
  return piece.split('-').every((t) => have.has(t));
}

/** 유형 → 슬러그 토큰. other 는 붙이지 않는다. */
const EVENT_TYPE_SLUG: Record<EventType, string> = {
  festival: 'festival',
  congress: 'congress',
  workshop: 'workshop',
  bootcamp: 'bootcamp',
  party: 'party',
  social: 'social',
  competition: 'competition',
  other: '',
};

/** 슬러그의 원천이 될 이름 — 영문 우선(로마자 변환 손실이 없다), 없으면 다른 로케일. */
function pickSlugName(name: I18n | string | null | undefined): string {
  if (typeof name === 'string') return name;
  if (!name) return '';
  for (const k of ['en', 'ko', 'ja', 'zh-TW'] as const) {
    const v = (name as Record<string, string | undefined>)[k]?.trim();
    if (v) return v;
  }
  const first = Object.values(name as Record<string, string | undefined>).find((v) => v?.trim());
  return first?.trim() ?? '';
}

export interface ProductSlugInput {
  /** 상품명(행사명) — 슬러그의 필수 base */
  name: I18n | string | null | undefined;
  /** 'ticket' 이면 의도어(tickets) 추가 */
  productType?: string | null;
  eventType?: EventType | null;
  /** 도시 — 호출부에서 city → province 순으로 정리해 넘긴다(숫자 섞인 주소 조각은 제외) */
  city?: string | null;
  /** 도시가 없을 때만 쓰는 대체 지역 신호(국가 표시명) */
  country?: string | null;
  /** 'YYYY-MM-DD…' — 연도 토큰의 출처 */
  startAt?: string | null;
  maxLength?: number;
}

/** 예산 초과 시 덜어내는 순서 — 검색 기여도가 낮은 것부터. 이름은 절대 버리지 않는다. */
const DROP_ORDER = ['type', 'place', 'intent', 'year'] as const;

/**
 * 상품 → URL 슬러그. 규칙은 파일 상단 주석 참고.
 * 반환값이 빈 문자열이면(=이름이 전부 변환 불가 문자) 호출부가 레거시 id URL 을 쓴다.
 */
export function buildProductSlug(input: ProductSlugInput): string {
  const max = input.maxLength ?? SLUG_MAX;
  const head = clampSlug(slugify(pickSlugName(input.name)), NAME_MAX);
  if (!head) return '';

  const typeWord = input.eventType ? EVENT_TYPE_SLUG[input.eventType] ?? '' : '';
  // 도시가 없거나 숫자가 섞인 값(주소 조각)이면 국가로 대체 — 지역 신호를 하나는 남긴다.
  const rawPlace = (input.city ?? '').trim();
  const place = rawPlace && !/\d/.test(rawPlace) ? rawPlace : (input.country ?? '').trim();
  const year = /^(\d{4})/.exec((input.startAt ?? '').trim())?.[1] ?? '';
  const intent = input.productType === 'ticket' ? 'tickets' : '';

  const on: Record<(typeof DROP_ORDER)[number], boolean> = {
    type: Boolean(typeWord),
    place: Boolean(place),
    intent: Boolean(intent),
    year: Boolean(year),
  };

  // 중복 판정은 '지금 남아있는 슬러그' 기준으로 매번 다시 한다.
  const compose = (): string => {
    let out = head;
    const add = (piece: string) => {
      const p = slugify(piece);
      if (p && !hasToken(out, p)) out = `${out}-${p}`;
    };
    if (on.type) add(typeWord);
    if (on.place) add(place);
    if (on.year) add(year);
    if (on.intent) add(intent);
    return out;
  };

  let slug = compose();
  for (const flag of DROP_ORDER) {
    if (slug.length <= max) break;
    on[flag] = false;
    slug = compose();
  }
  // 다 덜어내도 예산을 넘으면 이름 자체가 길다 — 하이픈 경계에서 자른다.
  // (제목과 달리 URL 은 잘라도 색인 손실이 사실상 없고, 짧을수록 이득이 크다)
  slug = clampSlug(slug, max);
  return RESERVED.has(slug) ? `${slug}-event` : slug;
}

// ── 경로 헬퍼 ─────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 라우트 파라미터가 레거시 uuid 인지 — 맞으면 정식 슬러그 URL 로 301 시킨다. */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

/** 슬러그 형식(소문자 ASCII·하이픈)인지 — 대문자/인코딩된 URL 을 정규화 대상으로 잡는 데 쓴다. */
export function isCanonicalSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

/** 정식 URL 을 만들 수 있는 최소 상품 정보 */
export interface ProductRef {
  id: string;
  slug?: string | null;
  product_type?: string | null;
}

/** 로케일 제외 정식 경로 — canonical/hreflang/sitemap 이 공유하는 단일 소스. */
export function productRelPath(p: ProductRef): string {
  const slug = (p.slug ?? '').trim();
  if (!slug) return `/products/${p.id}`; // 슬러그 없음(0035 미적용/미발행) → 레거시 URL 유지
  return p.product_type === 'ticket' ? `/events/${slug}` : `/shop/${slug}`;
}

/** 로케일 포함 정식 경로 — 내부 링크(<Link href>)는 전부 이걸 쓴다. */
export function productPath(locale: Locale | string, p: ProductRef): string {
  return `/${locale}${productRelPath(p)}`;
}
