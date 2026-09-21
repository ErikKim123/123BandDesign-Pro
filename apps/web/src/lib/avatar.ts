// 캐릭터(아바타) — 플랫 벡터 얼굴. profiles.avatar_seed + profiles.avatar_traits 로 결정된다.
//
// 아트 방향: 그라디언트·외곽선·조명 없는 완전 평면 컬러. 얼굴은 타원이 아니라 모서리가
// 크게 둥근 사각형(스퀘어클)이고, 귀는 얼굴 옆에 붙은 원, 목 없이 어깨로 바로 이어진다.
// 요소마다 색 하나씩만 쓰고 음영은 같은 색의 어두운 톤 한 겹으로만 준다.
//
// 서버/클라이언트 어디서 계산해도 같은 결과가 나와야 하므로 Math.random 없이
// 시드 해시 + LCG 만 쓴다(하이드레이션 불일치 방지). 외부 이미지 의존 없음.
//
// 시드는 '아직 안 고른 항목'의 기본값을 만든다. 회원이 편집기에서 고른 항목만
// avatar_traits 에 인덱스로 저장되고, 나머지는 계속 시드에서 파생된다.
// → 팔레트를 늘려도 기존 회원 캐릭터가 어긋나지 않고, 고른 항목은 고정된다.

/** FNV-1a 32bit — 짧은 문자열용으로 충분하고 구현이 단순하다. */
function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 해시에서 뽑아 쓰는 결정론적 난수열(LCG). 호출 순서가 곧 특성 순서다. */
function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

type NonEmpty<T> = [T, ...T[]];

function at<T>(arr: NonEmpty<T>, i: number): T {
  const n = ((i % arr.length) + arr.length) % arr.length;
  return arr[n] ?? arr[0];
}

/** 같은 색의 어두운 톤 — 관자놀이 음영처럼 '한 겹'만 줄 때 쓴다. */
export function shade(hex: string, amount = 0.82): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * amount);
  const g = Math.round(((n >> 8) & 255) * amount);
  const b = Math.round((n & 255) * amount);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** 같은 색의 밝은 톤 — 머리 하이라이트처럼 '한 겹' 올릴 때 쓴다. */
export function tint(hex: string, amount = 0.18): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// ── 팔레트 ────────────────────────────────────────────────────────────────────
/** 배경 — 평면 단색. 레퍼런스처럼 연한 톤이라 캐릭터가 앞으로 나온다. */
export const BACKGROUNDS: NonEmpty<string> = [
  '#dcefff',
  '#ffe6d2',
  '#ffe0ec',
  '#e2f4dd',
  '#ece1ff',
  '#fff3cf',
  '#d9f2f2',
  '#f2e8df',
];

/** 피부톤 — 어두운 톤부터 밝은 톤까지 넓게. 한쪽으로 치우치면 못 고르는 사람이 생긴다. */
export const SKINS: NonEmpty<string> = [
  '#4a2c25',
  '#66392e',
  '#7d4a2f',
  '#8f553a',
  '#a05f36',
  '#a9694a',
  '#b5764f',
  '#c07f5e',
  '#cb8f6a',
  '#dc9b78',
  '#e8ac8c',
  '#f0bd9e',
  '#f7cdb2',
  '#fbdcc6',
  '#fdead9',
];

export const HAIRS: NonEmpty<string> = [
  '#2f2f2f',
  '#4a3123',
  '#5c2b26',
  '#7a4426',
  '#a8503f',
  '#b08d78',
  '#c9a24f',
  '#d9b98c',
  '#8a6fd0',
  '#3f7ad1',
  '#3aa06a',
  '#e0407f',
];

export const EYE_COLORS: NonEmpty<string> = [
  '#3a3a3a',
  '#7a3a18',
  '#b08a18',
  '#3f8a2a',
  '#1f9a9a',
  '#2f7ad1',
];

/** 상의 색 — 얼굴 아래 어깨에만 보인다. */
export const SHIRT_COLORS: NonEmpty<string> = [
  '#d63a63',
  '#fa520f',
  '#2f7ad1',
  '#3aa06a',
  '#7b52d6',
  '#2b2b2b',
  '#ffb83e',
  '#1f3a63',
];

// ── 고를 수 있는 항목 ─────────────────────────────────────────────────────────
// 레퍼런스처럼 얼굴형 / 표정 / 헤어 / 안경 / 수염 으로 갈래를 나눈다.
/** 0 둥근사각 · 1 넓은사각 · 2 갸름 · 3 각진 */
export const FACE_COUNT = 4;
/** 0 기본 · 1 웃는눈 · 2 큰눈 · 3 처진눈 · 4 놀란눈 · 5 윙크 */
export const EYE_COUNT = 6;
/** 0 자연 · 1 일자 · 2 아치 · 3 두꺼운 */
export const BROW_COUNT = 4;
/** 0 없음 · 1 버튼코 · 2 동그란 · 3 뾰족 · 4 납작 · 5 주먹코 */
export const NOSE_COUNT = 6;
/** 0 미소 · 1 활짝 · 2 오물 · 3 무표정 · 4 씩 */
export const MOUTH_COUNT = 5;
/**
 * 0 짧은머리 · 1 단발 · 2 롱 · 3 곱슬 · 4 아프로퍼프 · 5 올림머리 · 6 포니테일 · 7 대머리
 * 8 롱웨이브 · 9 양갈래 · 10 긴생머리(앞으로 흘림)
 */
export const HAIR_STYLE_COUNT = 11;
/** 0 없음 · 1 사각뿔테 · 2 둥근테 · 3 선글라스 · 4 반무테 */
export const GLASSES_COUNT = 5;
/**
 * 0 없음 · 1 콧수염 · 2 턱수염 · 3 풀비어드 · 4 염소수염
 * 5 일자 콧수염 · 6 카이저 콧수염 · 7 얇은 콧수염 — 콧수염만 있는 종류
 */
export const BEARD_COUNT = 8;

/**
 * 편집기에서 고른 항목. 저장은 색상 문자열이 아니라 인덱스로 한다 —
 * 나중에 팔레트를 손봐도 저장값이 깨지지 않는다. 안 고른 항목은 빠져 있고,
 * 그 자리는 시드에서 파생된 기본값이 채운다.
 */
export interface AvatarTraits {
  faceShape?: number;
  skin?: number;
  eyes?: number;
  eyeColor?: number;
  brow?: number;
  nose?: number;
  mouth?: number;
  hairStyle?: number;
  hair?: number;
  glasses?: number;
  beard?: number;
  shirt?: number;
  bg?: number;
}

/** 편집기가 다루는 항목 키 — 탭이 이 키들을 묶어 보여준다. */
export const TRAIT_KEYS = [
  'faceShape',
  'skin',
  'eyes',
  'eyeColor',
  'brow',
  'nose',
  'mouth',
  'hairStyle',
  'hair',
  'glasses',
  'beard',
  'shirt',
  'bg',
] as const;
export type TraitKey = (typeof TRAIT_KEYS)[number];

/** 항목별 선택지 개수 — 랜덤/유효성 검사가 공통으로 쓴다. */
export const TRAIT_LENGTH: Record<TraitKey, number> = {
  faceShape: FACE_COUNT,
  skin: SKINS.length,
  eyes: EYE_COUNT,
  eyeColor: EYE_COLORS.length,
  brow: BROW_COUNT,
  nose: NOSE_COUNT,
  mouth: MOUTH_COUNT,
  hairStyle: HAIR_STYLE_COUNT,
  hair: HAIRS.length,
  glasses: GLASSES_COUNT,
  beard: BEARD_COUNT,
  shirt: SHIRT_COLORS.length,
  bg: BACKGROUNDS.length,
};

/** 렌더러가 받는 최종 형태 — 모든 항목이 확정된 값. */
export interface AvatarSpec {
  faceShape: number;
  eyes: number;
  brow: number;
  nose: number;
  mouth: number;
  hairStyle: number;
  glasses: number;
  beard: number;
  bg: string;
  skin: string;
  hair: string;
  eyeColor: string;
  shirt: string;
}

/** DB 의 jsonb 를 신뢰하지 않고 걸러 읽는다 — 범위를 벗어난 값은 없는 셈 친다. */
export function parseTraits(raw: unknown): AvatarTraits {
  if (raw == null || typeof raw !== 'object') return {};
  const src = raw as Record<string, unknown>;
  const out: AvatarTraits = {};
  for (const key of TRAIT_KEYS) {
    const v = src[key];
    if (typeof v !== 'number' || !Number.isInteger(v)) continue;
    if (v < 0 || v >= TRAIT_LENGTH[key]) continue;
    out[key] = v;
  }
  return out;
}

/**
 * 캐릭터 특성 = 고른 항목(traits) 우선, 나머지는 시드에서 파생.
 * 고른 항목이어도 난수는 그대로 소비한다 — 뒤 항목이 밀려 캐릭터가 달라지지 않게.
 */
export function avatarSpec(
  seed: string | null | undefined,
  traits?: AvatarTraits | null,
): AvatarSpec {
  const t = traits ?? {};
  const next = rng(hashSeed(seed || 'wolf'));
  const idx = (key: TraitKey): number => {
    const r = next();
    const chosen = t[key];
    return chosen ?? Math.floor(r * TRAIT_LENGTH[key]);
  };

  // 안경·수염은 '없음'(0)이 절반쯤 나오게 한다 — 전원이 뭔가를 걸치고 있으면 산만하다.
  // 회원이 직접 고른 값은 이 확률과 무관하게 그대로 쓴다. 난수는 항상 2개를 소비해
  // 고르든 안 고르든 뒤 항목의 파생값이 밀리지 않게 한다.
  const optional = (key: TraitKey, noneChance: number): number => {
    const rNone = next();
    const rPick = next();
    const chosen = t[key];
    if (chosen !== undefined) return chosen;
    if (rNone < noneChance) return 0;
    return 1 + Math.floor(rPick * (TRAIT_LENGTH[key] - 1));
  };

  return {
    faceShape: idx('faceShape'),
    skin: at(SKINS, idx('skin')),
    eyes: idx('eyes'),
    eyeColor: at(EYE_COLORS, idx('eyeColor')),
    brow: idx('brow'),
    nose: idx('nose'),
    mouth: idx('mouth'),
    hairStyle: idx('hairStyle'),
    hair: at(HAIRS, idx('hair')),
    glasses: optional('glasses', 0.55),
    beard: optional('beard', 0.62),
    shirt: at(SHIRT_COLORS, idx('shirt')),
    bg: at(BACKGROUNDS, idx('bg')),
  };
}

/** 시드 발급 — 편집기의 '랜덤'과 신규 가입에 쓴다. */
export function newSeed(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}
