// 요소 데이터 → Konva 속성. 편집 화면(react-konva)과 내보내기(Konva 직접 생성)가 같은 함수를 써서 결과가 똑같다.
import { useEffect, useState } from 'react';
import { figurePath } from './shapes';
import type { El } from './store';

export const KOREAN_FONTS = [
  'Pretendard',
  'Noto Sans KR',
  'Nanum Gothic',
  'Nanum Myeongjo',
  'Noto Serif KR',
  'Nanum Gothic Coding',
  'IBM Plex Sans KR',
  'Gothic A1',
  'Nanum Pen Script',
  'Nanum Brush Script',
];
export const SYSTEM_FONTS = ['Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'sans-serif', 'serif'];

// 그 밖의 글꼴은 Google Fonts 에서 필요할 때 불러온다 (손목밴드 시안 등 기존 문서가 쓰는 글꼴 포함)
export const GOOGLE_FONTS = [
  'Black Han Sans',
  'Do Hyeon',
  'Jua',
  'Gugi',
  'Gasoek One',
  'Hi Melody',
  'Yeon Sung',
  'Orbit',
  'Moirai One',
  'Roboto',
  'Open Sans',
  'Oswald',
  'Arimo',
  'Montserrat',
  'Poppins',
];

const googleFontCss = new Map<string, Promise<void>>();

function loadGoogleFont(family: string) {
  let p = googleFontCss.get(family);
  if (!p) {
    p = (async () => {
      const base = `https://fonts.googleapis.com/css2?family=${family.trim().replace(/ /g, '+')}`;
      // 굵기 400/700 을 모두 가진 글꼴이 아니면 400 요청이 실패하므로 기본 굵기로 다시 요청한다
      let res = await fetch(`${base}:wght@400;700&display=swap`);
      if (!res.ok) res = await fetch(`${base}&display=swap`);
      if (!res.ok) return;
      const style = document.createElement('style');
      style.dataset.irFont = family;
      style.textContent = await res.text();
      document.head.appendChild(style);
    })().catch(() => undefined);
    googleFontCss.set(family, p);
  }
  return p;
}

export async function ensureFonts(families: string[]) {
  if (typeof document === 'undefined' || !document.fonts) return;
  const uniq = [...new Set(families.filter((f) => f && !SYSTEM_FONTS.includes(f)))];
  await Promise.all(uniq.filter((f) => !KOREAN_FONTS.includes(f)).map(loadGoogleFont));
  await Promise.all(
    uniq.flatMap((f) => [document.fonts.load(`400 20px "${f}"`, '가A'), document.fonts.load(`700 20px "${f}"`, '가A')]),
  ).catch(() => undefined);
}

// ---- 이미지 캐시 (페이지가 다시 그려져도 디코딩을 반복하지 않게) ----
const imageCache = new Map<string, Promise<HTMLImageElement>>();
const loaded = new Map<string, HTMLImageElement>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  let p = imageCache.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new window.Image();
      if (!src.startsWith('data:') && !src.startsWith('blob:')) img.crossOrigin = 'anonymous';
      img.onload = () => {
        loaded.set(src, img);
        resolve(img);
      };
      img.onerror = () => {
        imageCache.delete(src);
        reject(new Error('이미지를 불러오지 못했습니다'));
      };
      img.src = src;
    });
    imageCache.set(src, p);
  }
  return p;
}

export function useImage(src: string | undefined) {
  const [img, setImg] = useState<HTMLImageElement | undefined>(() => (src ? loaded.get(src) : undefined));
  useEffect(() => {
    if (!src) return setImg(undefined);
    const ready = loaded.get(src);
    if (ready) return setImg(ready);
    let alive = true;
    loadImage(src).then((i) => alive && setImg(i), () => undefined);
    return () => {
      alive = false;
    };
  }, [src]);
  return img;
}

export const isImageBackground = (bg: string) => /^(https?:|data:|blob:|\/)/.test(bg);

// 배경 이미지를 페이지에 꽉 차게(cover) 자르는 영역
export function coverCrop(img: HTMLImageElement, w: number, h: number) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const cw = w / s;
  const ch = h / s;
  return { x: (img.naturalWidth - cw) / 2, y: (img.naturalHeight - ch) / 2, width: cw, height: ch };
}

// ---- 속성 변환 ----
export function groupProps(el: El) {
  // 그룹은 자식이 페이지 기준 좌표를 가지므로 자기 위치는 항상 0,0
  if (el.type === 'group') return { id: el.id, x: 0, y: 0, rotation: 0, opacity: el.opacity ?? 1, visible: el.visible !== false };
  return { id: el.id, x: el.x, y: el.y, rotation: el.rotation || 0, opacity: el.opacity ?? 1, visible: el.visible !== false };
}

// 선: 요소 상자 가운데를 지나는 가로선, 두께 = height
export function lineProps(el: El) {
  const h = el.height || 1;
  return {
    name: 'content',
    points: [0, h / 2, el.width, h / 2],
    stroke: el.color || '#000000',
    strokeWidth: h,
    dash: el.dash?.length ? el.dash.map((d: number) => d * h) : undefined,
    hitStrokeWidth: Math.max(h, 10),
    ...shadowProps(el),
  };
}

function transformText(el: El) {
  const t = String(el.text ?? '');
  if (el.textTransform === 'uppercase') return t.toUpperCase();
  if (el.textTransform === 'lowercase') return t.toLowerCase();
  return t;
}

function shadowProps(el: El) {
  return el.shadowEnabled
    ? {
        shadowColor: el.shadowColor,
        shadowBlur: el.shadowBlur,
        shadowOffsetX: el.shadowOffsetX,
        shadowOffsetY: el.shadowOffsetY,
        shadowOpacity: el.shadowOpacity,
      }
    : {};
}

export function textFontStyle(el: El) {
  const weight = el.fontWeight === 'bold' || el.fontWeight === 'normal' ? el.fontWeight : String(el.fontWeight ?? 'normal');
  return `${el.fontStyle === 'italic' ? 'italic ' : ''}${weight}`;
}

export function textProps(el: El) {
  return {
    name: 'content',
    text: transformText(el),
    width: el.width,
    fontSize: el.fontSize,
    fontFamily: `${el.fontFamily}, sans-serif`,
    fontStyle: textFontStyle(el),
    textDecoration: el.textDecoration || '',
    fill: el.fill,
    align: el.align || 'left',
    lineHeight: el.lineHeight || 1.2,
    letterSpacing: (el.letterSpacing || 0) * el.fontSize,
    wrap: 'word' as const,
    stroke: el.strokeWidth ? el.stroke : undefined,
    strokeWidth: el.strokeWidth || 0,
    fillAfterStrokeEnabled: true,
    ...shadowProps(el),
  };
}

export function imageProps(el: El, img: HTMLImageElement) {
  const nw = img.naturalWidth || img.width;
  const nh = img.naturalHeight || img.height;
  return {
    name: 'content',
    image: img,
    width: el.width,
    height: el.height,
    crop: {
      x: (el.cropX || 0) * nw,
      y: (el.cropY || 0) * nh,
      width: (el.cropWidth || 1) * nw,
      height: (el.cropHeight || 1) * nh,
    },
    cornerRadius: el.cornerRadius || 0,
    scaleX: el.flipX ? -1 : 1,
    scaleY: el.flipY ? -1 : 1,
    offsetX: el.flipX ? el.width : 0,
    offsetY: el.flipY ? el.height : 0,
    ...shadowProps(el),
  };
}

export function borderProps(el: El) {
  return {
    width: el.width,
    height: el.height,
    stroke: el.borderColor,
    strokeWidth: el.borderSize,
    cornerRadius: el.cornerRadius || 0,
    listening: false,
  };
}

export function figureProps(el: El): { kind: 'rect' | 'path'; props: Record<string, any> } {
  const common = {
    name: 'content',
    fill: el.fill,
    stroke: el.strokeWidth ? el.stroke : undefined,
    strokeWidth: el.strokeWidth || 0,
    dash: el.dash?.length ? el.dash.map((d: number) => d * (el.strokeWidth || 1)) : undefined,
    ...shadowProps(el),
  };
  if (el.subType === 'rect' || !el.subType) {
    return { kind: 'rect', props: { ...common, width: el.width, height: el.height, cornerRadius: el.cornerRadius || 0 } };
  }
  return { kind: 'path', props: { ...common, data: figurePath(el.subType, el.width, el.height) } };
}

// ---- 색 ----
let colorCtx: CanvasRenderingContext2D | null = null;

// 색의 투명도(0~1). 'transparent' 는 0, 알 수 없는 값은 1.
export function colorAlpha(color: string | undefined): number {
  if (!color || typeof document === 'undefined') return 1;
  colorCtx ??= document.createElement('canvas').getContext('2d');
  if (!colorCtx) return 1;
  colorCtx.fillStyle = '#000000';
  colorCtx.fillStyle = color;
  const v = colorCtx.fillStyle;
  const m = v.match(/^rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)$/);
  return m ? Math.max(0, Math.min(1, +m[1]!)) : 1;
}

// 'rgba(191, 191, 191, 100)' 같은 값도 color input 이 받는 #rrggbb 로 바꾼다.
export function toHex(color: string | undefined): string {
  if (!color) return '#000000';
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  if (typeof document === 'undefined') return '#000000';
  colorCtx ??= document.createElement('canvas').getContext('2d');
  if (!colorCtx) return '#000000';
  colorCtx.fillStyle = '#000000';
  colorCtx.fillStyle = color;
  const v = colorCtx.fillStyle;
  if (v.startsWith('#')) return v;
  const m = v.match(/\d+(\.\d+)?/g);
  if (!m) return '#000000';
  return '#' + m.slice(0, 3).map((n) => Math.round(+n).toString(16).padStart(2, '0')).join('');
}
