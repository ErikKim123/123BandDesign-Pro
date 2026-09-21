// Design Ref: §7 SEO — 로컬 시그널(주소) 단일 소스.
// 검색엔진이 "어느 지역의 어느 장소인가"를 확신하게 만드는 3요소를 한곳에서 만든다:
//   ① 사람이 읽는 우편주소 문자열(본문 <address> 노출용, 크롤러가 텍스트로 읽는다)
//   ② schema.org PostalAddress / GeoCoordinates (구조화 데이터)
//   ③ 지도 링크(Place.hasMap) — 좌표가 없으면 주소 검색 URL 로 대체
import { countryLabel } from './seo';
import { addrText, type EventAddress, type Locale } from './types/index';

/** 우편주소 한 줄 (베뉴명 제외). 본문 노출·JSON-LD 폴백 공용.
 *  country 는 ISO2 코드 또는 표시명 — 둘 다 받는다.
 *
 *  표기 순서는 로케일을 따른다: 한/일/중은 큰 단위부터, 영문은 작은 단위부터.
 *  주소 칸에 전체 주소를 통째로 적어둔 데이터가 많아 중복 조각은 걸러낸다. 국가는
 *  현지어·영문 표기가 섞여 있어("베트남" vs "Vietnam") 두 표기 모두로 중복을 판정한다. */
export function formatPostalAddress(
  a?: EventAddress,
  locale: Locale = 'en',
  country = '',
): string {
  if (!a) return '';
  const t = (v: Parameters<typeof addrText>[0]) => addrText(v, locale);
  const cc = country || a.country || '';
  const countryName = countryLabel(cc, locale);
  const countryEn = countryLabel(cc, 'en');

  const line1 = t(a.line1);
  const city = t(a.city);
  // 서울·싱가포르처럼 도시=시/도인 곳은 같은 값이 두 번 나오지 않게 한다.
  const provinceRaw = t(a.province);
  const province = provinceRaw.toLowerCase() === city.toLowerCase() ? '' : provinceRaw;
  const postal = (a.postalCode ?? '').trim();

  // 중복 제거는 '주소' 칸(line1) 기준으로만 한다. 오거나이저가 여기에 전체 주소를 통째로
  // 적어두는 경우가 많기 때문. 도시가 시/도에 포함되는 건("Vung Tau" ⊂ "Ba Ria–Vung Tau")
  // 정상적인 주소 구성이므로 지우지 않는다.
  const inLine1 = (s: string) => Boolean(s) && line1.toLowerCase().includes(s.toLowerCase());
  const countryPart =
    !countryName || inLine1(countryName) || inLine1(countryEn) // 현지어/영문 어느 표기든 중복
      ? ''
      : countryName;

  const cjk = locale === 'ko' || locale === 'ja' || locale === 'zh-TW';
  const parts = cjk
    ? [countryPart, inLine1(province) ? '' : province, inLine1(city) ? '' : city, line1, postal]
    : [line1, inLine1(city) ? '' : city, inLine1(province) ? '' : province, postal, countryPart];

  return parts
    .map((s) => s.trim())
    .filter(Boolean)
    .join(cjk ? ' ' : ', ');
}

/** schema.org PostalAddress 노드. 값이 하나도 없으면 undefined.
 *  addressCountry 는 표시명이 아니라 ISO 3166-1 alpha-2 코드를 넣는다(구글 권장). */
export function postalAddressNode(
  a: EventAddress | undefined,
  countryCode: string | undefined,
  locale: Locale = 'en',
): Record<string, string> | undefined {
  if (!a && !countryCode) return undefined;
  const t = (v: Parameters<typeof addrText>[0]) => addrText(v, locale);
  const node: Record<string, string> = { '@type': 'PostalAddress' };
  const street = t(a?.line1);
  const city = t(a?.city);
  const region = t(a?.province);
  const postal = (a?.postalCode ?? '').trim();
  const cc = (countryCode || a?.country || '').trim();
  if (street) node.streetAddress = street;
  if (city) node.addressLocality = city;
  if (region) node.addressRegion = region;
  if (postal) node.postalCode = postal;
  if (cc) node.addressCountry = /^[A-Za-z]{2}$/.test(cc) ? cc.toUpperCase() : cc;
  return Object.keys(node).length > 1 ? node : undefined; // @type 뿐이면 무의미
}

/** 구글맵/애플맵 URL → 위경도. 오거나이저가 링크만 붙여넣어도 좌표를 얻기 위한 파서.
 *  지원: `@lat,lng`, `!3d<lat>!4d<lng>`, `q=lat,lng`, `ll=lat,lng`, `daddr=lat,lng` */
export function parseGeoFromMapUrl(url?: string): { lat: number; lng: number } | null {
  const s = (url ?? '').trim();
  if (!s) return null;
  const num = '(-?\\d{1,3}\\.\\d{3,})';
  const patterns = [
    new RegExp(`@${num},${num}`),
    new RegExp(`!3d${num}!4d${num}`),
    new RegExp(`[?&](?:q|ll|daddr|sll|center)=${num},\\s*${num}`),
  ];
  for (const re of patterns) {
    const m = re.exec(s);
    if (!m?.[1] || !m[2]) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (isValidGeo(lat, lng)) return { lat, lng };
  }
  return null;
}

/** 좌표 유효성 — 범위 밖이거나 (0,0)(=미입력 오인)이면 버린다. */
export function isValidGeo(lat?: number | null, lng?: number | null): lat is number {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  return !(lat === 0 && lng === 0);
}

/** 지도 링크 — 좌표가 있으면 좌표로, 없으면 "베뉴명 + 주소" 검색 URL 로. 없으면 ''. */
export function mapLink(
  a?: EventAddress,
  locale: Locale = 'en',
  countryName = '',
): string {
  if (a?.mapUrl?.trim()) return a.mapUrl.trim();
  if (a && isValidGeo(a.lat, a.lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${a.lat},${a.lng}`;
  }
  const q = [addrText(a?.venue, locale), formatPostalAddress(a, locale, countryName)]
    .filter(Boolean)
    .join(' ');
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : '';
}

/** 주소 신호가 하나라도 있는지 — 장소 블록 렌더 여부 판단용. */
export function hasAddressSignal(a?: EventAddress, locale: Locale = 'en'): boolean {
  if (!a) return false;
  return Boolean(
    addrText(a.venue, locale) ||
      addrText(a.line1, locale) ||
      addrText(a.city, locale) ||
      addrText(a.province, locale) ||
      a.postalCode ||
      isValidGeo(a.lat, a.lng),
  );
}
