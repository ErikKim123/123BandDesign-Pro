// 회원활동 — 아바타 특성의 사람 말 라벨.
// 인덱스→이름 대응은 lib/avatar.ts 의 주석(FACE_COUNT/HAIR_STYLE_COUNT 등)과 1:1이다.
// 팔레트나 종류가 늘어나면 web 원본 → lib/avatar.ts → 이 파일 순으로 함께 늘린다.
import {
  BACKGROUNDS,
  EYE_COLORS,
  HAIRS,
  SHIRT_COLORS,
  SKINS,
  type AvatarSpec,
} from '@/lib/avatar';

/** 선택지가 '몇 번'인지로 저장되므로 표기는 여기서만 관리한다. */
export const SHAPE_TRAITS = {
  faceShape: { label: '얼굴형', options: ['둥근사각', '넓은사각', '갸름', '각진'] },
  hairStyle: {
    label: '머리모양',
    options: [
      '짧은머리', '단발', '롱', '곱슬', '아프로퍼프', '올림머리',
      '포니테일', '대머리', '롱웨이브', '양갈래', '긴생머리',
    ],
  },
  eyes: { label: '눈', options: ['기본', '웃는눈', '큰눈', '처진눈', '놀란눈', '윙크'] },
  brow: { label: '눈썹', options: ['자연', '일자', '아치', '두꺼운'] },
  nose: { label: '코', options: ['없음', '버튼코', '동그란', '뾰족', '납작', '주먹코'] },
  mouth: { label: '입', options: ['미소', '활짝', '오물', '무표정', '씩'] },
  glasses: { label: '안경', options: ['없음', '사각뿔테', '둥근테', '선글라스', '반무테'] },
  beard: {
    label: '수염',
    options: [
      '없음', '콧수염', '턱수염', '풀비어드', '염소수염',
      '일자 콧수염', '카이저 콧수염', '얇은 콧수염',
    ],
  },
} as const;

export type ShapeTraitKey = keyof typeof SHAPE_TRAITS;
export const SHAPE_TRAIT_KEYS = Object.keys(SHAPE_TRAITS) as ShapeTraitKey[];

/** 색 항목 — spec 은 색을 hex 로 확정해 주므로 팔레트에서 자리(인덱스)를 되찾는다. */
export const COLOR_TRAITS = {
  skin: { label: '피부톤', palette: SKINS },
  hair: { label: '머리색', palette: HAIRS },
  eyeColor: { label: '눈동자', palette: EYE_COLORS },
  shirt: { label: '상의', palette: SHIRT_COLORS },
  bg: { label: '배경', palette: BACKGROUNDS },
} as const;

export type ColorTraitKey = keyof typeof COLOR_TRAITS;
export const COLOR_TRAIT_KEYS = Object.keys(COLOR_TRAITS) as ColorTraitKey[];

/** 확정된 특성의 이름 — 범위를 벗어난 값은 번호 그대로 보여준다(깨지지 않게). */
export function shapeTraitLabel(key: ShapeTraitKey, spec: AvatarSpec): string {
  const idx = spec[key];
  return (SHAPE_TRAITS[key].options as readonly string[])[idx] ?? `#${idx}`;
}
