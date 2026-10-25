// 글자 → 윤곽선(패스). 글꼴 원본을 /api/ir-font 로 받아 opentype.js 로 글자 모양을 꺼낸다.
// 일러스트레이터에 글꼴이 없어도 모양이 그대로 유지된다. (대신 글자 내용은 고칠 수 없다)
import type { Font, Glyph } from 'opentype.js';
import type { El } from './store';

type LoadedFont = { font: Font; weight: number };

// 라틴 글꼴에 한글이 없을 때 화면처럼 다른 글꼴로 채운다
const HANGUL_FALLBACK = 'Noto Sans KR';

const fontCache = new Map<string, Promise<LoadedFont | null>>();

function getFont(family: string, weight: 400 | 700): Promise<LoadedFont | null> {
  const key = `${family}:${weight}`;
  let p = fontCache.get(key);
  if (!p) {
    p = (async () => {
      const res = await fetch(`/api/ir-font?family=${encodeURIComponent(family)}&weight=${weight}`);
      if (!res.ok) return null;
      const { parse } = await import('opentype.js');
      return { font: parse(await res.arrayBuffer()), weight: Number(res.headers.get('X-Font-Weight')) || 400 };
    })().catch(() => null);
    fontCache.set(key, p);
  }
  return p;
}

export type TextLayout = {
  lines: { text: string; width: number }[];
  firstBaseline: number;
  lineHeight: number;
};

const n = (v: number) => String(Math.round((v || 0) * 100) / 100);

function hasGlyph(f: LoadedFont | null, ch: string) {
  return !!f && f.font.charToGlyphIndex(ch) > 0;
}

// 윤곽선을 만들 수 없으면(글꼴 못 받음) null → 호출한 쪽이 일반 글자로 남긴다
export async function textOutlineSvg(el: El, layout: TextLayout, paint: (kind: 'fill' | 'stroke', c: string) => string) {
  const wantBold = el.fontWeight === 'bold' || Number(el.fontWeight) >= 600;
  const weight = wantBold ? 700 : 400;
  const [primary, fallback] = await Promise.all([getFont(el.fontFamily, weight), getFont(HANGUL_FALLBACK, weight)]);
  if (!primary && !fallback) return null;

  const size = el.fontSize;
  const spacing = (el.letterSpacing || 0) * size;
  const parts: string[] = [];

  layout.lines.forEach((line, i) => {
    const baseline = layout.firstBaseline + i * layout.lineHeight;
    const glyphs: { f: LoadedFont; g: Glyph; x: number }[] = [];
    let x = 0;
    let prev: { f: LoadedFont; g: Glyph } | null = null;
    for (const ch of Array.from(line.text)) {
      const f = hasGlyph(primary, ch) ? primary! : hasGlyph(fallback, ch) ? fallback! : (primary ?? fallback)!;
      const g = f.font.charToGlyph(ch);
      const scale = size / f.font.unitsPerEm;
      if (prev && prev.f === f) x += f.font.getKerningValue(prev.g, g) * scale;
      glyphs.push({ f, g, x });
      x += (g.advanceWidth ?? 0) * scale + spacing;
      prev = { f, g };
    }
    const lineWidth = Math.max(0, x - spacing);
    const startX = el.align === 'center' ? (el.width - lineWidth) / 2 : el.align === 'right' ? el.width - lineWidth : 0;

    // 굵게를 원했는데 글꼴에 굵은 모양이 없으면 화면(브라우저)처럼 테두리로 살짝 두껍게
    const groups = new Map<LoadedFont, string[]>();
    for (const { f, g, x: gx } of glyphs) {
      const d = g.getPath(startX + gx, baseline, size).toPathData(2);
      if (!d) continue;
      if (!groups.has(f)) groups.set(f, []);
      groups.get(f)!.push(d);
    }
    for (const [f, ds] of groups) {
      const fakeBold = wantBold && f.weight < 600;
      const stroke = el.strokeWidth
        ? ` ${paint('stroke', el.stroke)} stroke-width="${n(el.strokeWidth)}"`
        : fakeBold
          ? ` ${paint('stroke', el.fill)} stroke-width="${n(size / 30)}" stroke-linejoin="round"`
          : '';
      parts.push(`<path d="${ds.join(' ')}" ${paint('fill', el.fill)}${stroke}/>`);
    }

    const deco = String(el.textDecoration || '');
    const thick = Math.max(1, size / 15);
    if (deco.includes('underline'))
      parts.push(`<rect x="${n(startX)}" y="${n(baseline + size * 0.1)}" width="${n(lineWidth)}" height="${n(thick)}" ${paint('fill', el.fill)}/>`);
    if (deco.includes('line-through'))
      parts.push(`<rect x="${n(startX)}" y="${n(baseline - size * 0.3)}" width="${n(lineWidth)}" height="${n(thick)}" ${paint('fill', el.fill)}/>`);
  });

  if (!parts.length) return '';
  // 기울임은 글꼴에 기울임 모양이 없으니 살짝 기울여 흉내 낸다
  const skew = el.fontStyle === 'italic' ? ` transform="translate(${n(layout.firstBaseline * 0.2)} 0) skewX(-12)"` : '';
  return `<g${skew}>${parts.join('')}</g>`;
}
