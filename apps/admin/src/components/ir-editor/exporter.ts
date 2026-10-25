// 내보내기 — 페이지를 화면 밖 Konva 스테이지로 다시 그려 PNG/JPG/PDF/JSON 으로 저장한다.
import Konva from 'konva';
import {
  borderProps,
  coverCrop,
  ensureFonts,
  figureProps,
  groupProps,
  imageProps,
  isImageBackground,
  lineProps,
  loadImage,
  textProps,
} from './render';
import { collectFonts, type Doc, type El, type Page } from './store';

async function backgroundNode(doc: Doc, page: Page) {
  if (isImageBackground(page.background)) {
    const img = await loadImage(page.background).catch(() => null);
    if (img) {
      return new Konva.Image({ image: img, width: doc.width, height: doc.height, crop: coverCrop(img, doc.width, doc.height) });
    }
  }
  return new Konva.Rect({
    width: doc.width,
    height: doc.height,
    fill: isImageBackground(page.background) ? 'white' : page.background || 'white',
  });
}

async function buildNode(el: El): Promise<Konva.Group | null> {
  if (el.visible === false || el.showInExport === false) return null;
  const group = new Konva.Group(groupProps(el));
  if (el.type === 'group') {
    for (const child of el.children ?? []) {
      const n = await buildNode(child);
      if (n) group.add(n);
    }
  } else if (el.type === 'text') group.add(new Konva.Text(textProps(el)));
  else if (el.type === 'line') group.add(new Konva.Line(lineProps(el)));
  else if (el.type === 'figure') {
    const { kind, props } = figureProps(el);
    group.add(kind === 'rect' ? new Konva.Rect(props) : new Konva.Path(props));
  } else if (el.type === 'image') {
    const img = await loadImage(el.src).catch(() => null);
    if (!img) return null;
    group.add(new Konva.Image(imageProps(el, img)));
    if (el.borderSize) group.add(new Konva.Rect(borderProps(el)));
  }
  return group;
}

export async function renderPageCanvas(doc: Doc, page: Page, pixelRatio = 1): Promise<HTMLCanvasElement> {
  await ensureFonts(collectFonts(page.children));
  const container = document.createElement('div');
  const stage = new Konva.Stage({ container, width: doc.width, height: doc.height });
  const layer = new Konva.Layer();
  stage.add(layer);
  layer.add(await backgroundNode(doc, page));

  for (const el of page.children) {
    const node = await buildNode(el);
    if (node) layer.add(node);
  }
  layer.draw();
  const canvas = stage.toCanvas({ pixelRatio });
  stage.destroy();
  return canvas;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지 변환 실패'))), type, quality),
  );

export async function downloadImages(
  doc: Doc,
  pages: Page[],
  name: string,
  format: 'png' | 'jpeg',
  pixelRatio: number,
) {
  for (const page of pages) {
    const canvas = await renderPageCanvas(doc, page, pixelRatio);
    const blob = await toBlob(canvas, `image/${format}`, 0.92);
    const n = doc.pages.indexOf(page) + 1;
    downloadBlob(blob, `${name}${doc.pages.length > 1 ? `-${n}` : ''}.${format === 'png' ? 'png' : 'jpg'}`);
  }
}

// ---- 최소 PDF 작성기: 페이지마다 JPEG 한 장을 꽉 채워 넣는다 ----
function base64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function downloadPdf(doc: Doc, name: string, pixelRatio: number) {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let length = 0;
  const offsets: number[] = [];
  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === 'string' ? enc.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  const startObj = (n: number) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
  };

  push('%PDF-1.4\n');
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const pw = doc.width;
  const ph = doc.height;
  const kids = doc.pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');

  startObj(1);
  push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  startObj(2);
  push(`<< /Type /Pages /Kids [${kids}] /Count ${doc.pages.length} >>\nendobj\n`);

  for (let i = 0; i < doc.pages.length; i++) {
    const canvas = await renderPageCanvas(doc, doc.pages[i]!, pixelRatio);
    const jpeg = base64ToBytes(canvas.toDataURL('image/jpeg', 0.92).split(',')[1]!);
    const [pageNo, contentNo, imageNo] = [3 + i * 3, 4 + i * 3, 5 + i * 3];
    const content = `q\n${pw} 0 0 ${ph} 0 0 cm\n/Im0 Do\nQ\n`;

    startObj(pageNo);
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 ${imageNo} 0 R >> >> /Contents ${contentNo} 0 R >>\nendobj\n`,
    );
    startObj(contentNo);
    push(`<< /Length ${enc.encode(content).length} >>\nstream\n${content}endstream\nendobj\n`);
    startObj(imageNo);
    push(
      `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    );
    push(jpeg);
    push('\nendstream\nendobj\n');
  }

  const count = 2 + doc.pages.length * 3;
  const xrefAt = length;
  push(`xref\n0 ${count + 1}\n0000000000 65535 f \n`);
  for (let n = 1; n <= count; n++) push(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${count + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);

  downloadBlob(new Blob(chunks as BlobPart[], { type: 'application/pdf' }), `${name}.pdf`);
}

export function downloadJson(doc: Doc, name: string) {
  downloadBlob(new Blob([JSON.stringify(doc)], { type: 'application/json' }), `${name}.json`);
}
