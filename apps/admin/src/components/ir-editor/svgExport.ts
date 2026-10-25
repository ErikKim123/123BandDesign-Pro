// 일러스트레이터용 SVG 내보내기 — 글자는 글자로, 도형·선은 벡터 패스로 남겨 Illustrator 에서 바로 고칠 수 있다.
// 줄바꿈·글자 위치는 화면(Konva)과 같은 계산을 써서 맞춘다. 여러 페이지는 페이지별 SVG 를 ZIP 으로 묶는다.
import Konva from 'konva';
import { colorAlpha, ensureFonts, figureProps, isImageBackground, textProps, toHex } from './render';
import { downloadBlob } from './exporter';
import { textOutlineSvg, type TextLayout } from './outline';
import { collectFonts, type Doc, type El, type Page } from './store';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const n = (v: number) => String(Math.round((v || 0) * 1000) / 1000);

// rgba 는 Illustrator 가 잘 못 읽으므로 #rrggbb + opacity 로 나눈다
function paint(kind: 'fill' | 'stroke', color: string | undefined) {
  if (!color) return `${kind}="none"`;
  const a = colorAlpha(color);
  return `${kind}="${toHex(color)}"${a < 1 ? ` ${kind}-opacity="${n(a)}"` : ''}`;
}

async function toDataUrl(src: string): Promise<string> {
  if (src.startsWith('data:')) return src;
  const blob = await fetch(src).then((r) => r.blob());
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

class SvgBuilder {
  defs: string[] = [];
  private seq = 0;
  id(prefix: string) {
    this.seq += 1;
    return `${prefix}${this.seq}`;
  }
}

// 화면(Konva)과 같은 줄바꿈·기준선 위치
function layoutText(el: El): TextLayout {
  const node = new Konva.Text(textProps(el));
  const lineHeight = (el.lineHeight || 1.2) * el.fontSize;
  const m = node.measureSize('M') as any;
  const ascent = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent ?? el.fontSize * 0.8;
  const descent = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent ?? el.fontSize * 0.2;
  const lines = ((node as any).textArr as { text: string; width: number }[]).map((l) => ({ text: l.text, width: l.width }));
  node.destroy();
  return { lines, firstBaseline: (ascent - descent) / 2 + lineHeight / 2, lineHeight };
}

function textSvg(el: El, layout: TextLayout): string {
  const { lines, firstBaseline, lineHeight: lineH } = layout;

  const weight = el.fontWeight === 'bold' ? 'bold' : el.fontWeight === 'normal' || !el.fontWeight ? 'normal' : String(el.fontWeight);
  const attrs = [
    `font-family="${esc(String(el.fontFamily))}"`,
    `font-size="${n(el.fontSize)}"`,
    `font-weight="${weight}"`,
    el.fontStyle === 'italic' ? 'font-style="italic"' : '',
    el.letterSpacing ? `letter-spacing="${n(el.letterSpacing * el.fontSize)}"` : '',
    el.textDecoration ? `text-decoration="${esc(el.textDecoration)}"` : '',
    paint('fill', el.fill),
    el.strokeWidth ? `${paint('stroke', el.stroke)} stroke-width="${n(el.strokeWidth)}"` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const tspans = lines
    .map((line, i) => {
      const x = el.align === 'center' ? (el.width - line.width) / 2 : el.align === 'right' ? el.width - line.width : 0;
      return `<tspan x="${n(x)}" y="${n(firstBaseline + i * lineH)}">${esc(line.text)}</tspan>`;
    })
    .join('');
  return `<text xml:space="preserve" ${attrs}>${tspans}</text>`;
}

async function imageSvg(el: El, b: SvgBuilder): Promise<string> {
  const data = await toDataUrl(el.src);
  const fullW = el.width / (el.cropWidth || 1);
  const fullH = el.height / (el.cropHeight || 1);
  const clip = b.id('clip');
  const r = el.cornerRadius ? ` rx="${n(el.cornerRadius)}" ry="${n(el.cornerRadius)}"` : '';
  b.defs.push(`<clipPath id="${clip}"><rect width="${n(el.width)}" height="${n(el.height)}"${r}/></clipPath>`);
  const flip =
    el.flipX || el.flipY
      ? ` transform="translate(${el.flipX ? n(el.width) : 0} ${el.flipY ? n(el.height) : 0}) scale(${el.flipX ? -1 : 1} ${el.flipY ? -1 : 1})"`
      : '';
  const img = `<image x="${n(-(el.cropX || 0) * fullW)}" y="${n(-(el.cropY || 0) * fullH)}" width="${n(fullW)}" height="${n(fullH)}" preserveAspectRatio="none" xlink:href="${data}"/>`;
  const border = el.borderSize
    ? `<rect width="${n(el.width)}" height="${n(el.height)}"${r} fill="none" ${paint('stroke', el.borderColor)} stroke-width="${n(el.borderSize)}"/>`
    : '';
  return `<g clip-path="url(#${clip})"><g${flip}>${img}</g></g>${border}`;
}

function figureSvg(el: El): string {
  const { kind, props } = figureProps(el);
  const stroke = el.strokeWidth
    ? ` ${paint('stroke', el.stroke)} stroke-width="${n(el.strokeWidth)}"${props.dash ? ` stroke-dasharray="${props.dash.map(n).join(' ')}"` : ''}`
    : '';
  if (kind === 'rect') {
    const r = el.cornerRadius ? ` rx="${n(el.cornerRadius)}" ry="${n(el.cornerRadius)}"` : '';
    return `<rect width="${n(el.width)}" height="${n(el.height)}"${r} ${paint('fill', el.fill)}${stroke}/>`;
  }
  return `<path d="${props.data}" ${paint('fill', el.fill)}${stroke}/>`;
}

function lineSvg(el: El): string {
  const h = el.height || 1;
  const dash = el.dash?.length ? ` stroke-dasharray="${el.dash.map((d: number) => n(d * h)).join(' ')}"` : '';
  return `<line x1="0" y1="${n(h / 2)}" x2="${n(el.width)}" y2="${n(h / 2)}" ${paint('stroke', el.color || '#000000')} stroke-width="${n(h)}"${dash}/>`;
}

async function elementSvg(el: El, b: SvgBuilder, outline: boolean): Promise<string> {
  if (el.visible === false || el.showInExport === false) return '';
  const opacity = (el.opacity ?? 1) < 1 ? ` opacity="${n(el.opacity)}"` : '';
  if (el.type === 'group') {
    const inner = (await Promise.all((el.children ?? []).map((c) => elementSvg(c, b, outline)))).join('');
    return `<g${opacity}>${inner}</g>`;
  }
  let body = '';
  if (el.type === 'text') {
    const layout = layoutText(el);
    body = (outline ? await textOutlineSvg(el, layout, paint) : null) ?? textSvg(el, layout);
  }
  if (el.type === 'figure') body = figureSvg(el);
  else if (el.type === 'line') body = lineSvg(el);
  else if (el.type === 'image') body = await imageSvg(el, b).catch(() => '');
  if (!body) return '';
  const rot = el.rotation ? ` rotate(${n(el.rotation)})` : '';
  return `<g transform="translate(${n(el.x)} ${n(el.y)})${rot}"${opacity}>${body}</g>`;
}

async function backgroundSvg(doc: Doc, page: Page) {
  if (isImageBackground(page.background)) {
    const data = await toDataUrl(page.background).catch(() => '');
    if (data) {
      return `<image width="${n(doc.width)}" height="${n(doc.height)}" preserveAspectRatio="xMidYMid slice" xlink:href="${data}"/>`;
    }
  }
  return `<rect width="${n(doc.width)}" height="${n(doc.height)}" ${paint('fill', isImageBackground(page.background) ? 'white' : page.background || 'white')}/>`;
}

export async function pageToSvg(doc: Doc, page: Page, outline = false): Promise<string> {
  await ensureFonts(collectFonts(page.children));
  const b = new SvgBuilder();
  const bg = await backgroundSvg(doc, page);
  const body: string[] = [];
  for (const el of page.children) body.push(await elementSvg(el, b, outline));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="${n(doc.width)}px" height="${n(doc.height)}px" viewBox="0 0 ${n(doc.width)} ${n(doc.height)}">`,
    b.defs.length ? `<defs>${b.defs.join('')}</defs>` : '',
    `<g id="background">${bg}</g>`,
    `<g id="content">${body.join('')}</g>`,
    '</svg>',
  ].join('\n');
}

// ---- 압축 없는(store) ZIP — 페이지별 SVG 를 한 파일로 묶는다 ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function makeZip(files: { name: string; data: Uint8Array }[]): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 파일 이름
    local.setUint16(8, 0, true);
    local.setUint16(10, 0, true);
    local.setUint16(12, 0x21, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, f.data.length, true);
    local.setUint32(22, f.data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    parts.push(new Uint8Array(local.buffer), name, f.data);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, 0, true);
    cd.setUint16(14, 0x21, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, f.data.length, true);
    cd.setUint32(24, f.data.length, true);
    cd.setUint16(28, name.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), name);
    offset += 30 + name.length + f.data.length;
  }
  const cdSize = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)] as BlobPart[], { type: 'application/zip' });
}

export async function downloadSvg(doc: Doc, pages: Page[], name: string, outline = false) {
  const enc = new TextEncoder();
  if (pages.length === 1) {
    const svg = await pageToSvg(doc, pages[0]!, outline);
    const idx = doc.pages.indexOf(pages[0]!) + 1;
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${name}${doc.pages.length > 1 ? `-${idx}` : ''}.svg`);
    return;
  }
  const files: { name: string; data: Uint8Array }[] = [];
  for (const page of pages) {
    const idx = doc.pages.indexOf(page) + 1;
    files.push({ name: `${name}-${String(idx).padStart(2, '0')}.svg`, data: enc.encode(await pageToSvg(doc, page, outline)) });
  }
  downloadBlob(makeZip(files), `${name}-svg.zip`);
}
