// J&J Dash 참가자의 국가 값(영문 국가명)을 ISO 3166-1 alpha-2 로 되돌린다.
//
// J&J Dash 참가신청 폼은 국가를 '이름'(participants.representative = 'Philippines')으로 저장하고,
// 123Band 의 jnj_winners.country 는 코드('PH')를 쓴다. 가져오기에서 한 번 변환해 준다.
// 이름 표기는 Intl.DisplayNames(en) 로 만들고, 두 목록의 표기가 다른 것만 ALIASES 로 보정한다.
import { COUNTRY_CODES } from '@/lib/countries';

// J&J Dash 목록과 Intl 표기가 어긋나는 것 + 운영자가 손으로 적을 법한 흔한 별칭.
const ALIASES: Record<string, string> = {
  korea: 'KR',
  'south korea': 'KR',
  'republic of korea': 'KR',
  'north korea': 'KP',
  'hong kong': 'HK',
  macau: 'MO',
  macao: 'MO',
  congo: 'CG',
  'dr congo': 'CD',
  'democratic republic of the congo': 'CD',
  myanmar: 'MM',
  burma: 'MM',
  palestine: 'PS',
  'saint vincent and the grenadines': 'VC',
  turkey: 'TR',
  turkiye: 'TR',
  usa: 'US',
  'united states of america': 'US',
  uk: 'GB',
  'united kingdom': 'GB',
  'great britain': 'GB',
  england: 'GB',
  russia: 'RU',
  vietnam: 'VN',
  laos: 'LA',
  syria: 'SY',
  'ivory coast': 'CI',
  'cape verde': 'CV',
  'czech republic': 'CZ',
  'east timor': 'TL',
  uae: 'AE',
  'united arab emirates': 'AE',
};

/** 'São Tomé & Príncipe' / 'Saint Lucia' 처럼 표기만 다른 값을 같은 키로 모은다. */
function norm(v: string): string {
  return v
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // 악센트 제거 — Sao Tome / Principe 표기 통일
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\bsaint\b/g, 'st')
    .replace(/\s+/g, ' ')
    .trim();
}

let cache: Map<string, string> | null = null;

function nameMap(): Map<string, string> {
  if (cache) return cache;
  const m = new Map<string, string>();
  let dn: Intl.DisplayNames | null = null;
  try {
    dn = new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    dn = null; // Intl 미지원 환경 — ALIASES 만으로 동작한다.
  }
  if (dn) {
    for (const cc of COUNTRY_CODES) {
      const label = dn.of(cc);
      if (label && label !== cc) m.set(norm(label), cc);
    }
  }
  // 별칭이 Intl 표기를 덮어쓴다(둘이 충돌하면 운영자가 쓰는 쪽이 맞다).
  for (const [name, cc] of Object.entries(ALIASES)) m.set(norm(name), cc);
  cache = m;
  return m;
}

/** 'Philippines' → 'PH'. 이미 ISO2 코드면 그대로. 못 알아보면 null(국가 미입력으로 들어간다). */
export function toCountryCode(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim();
  if (!v) return null;
  if (/^[A-Za-z]{2}$/.test(v)) {
    const up = v.toUpperCase();
    if (COUNTRY_CODES.includes(up)) return up;
  }
  return nameMap().get(norm(v)) ?? null;
}
