// 여러 패널에서 같이 쓰는 추가 동작
import { ensureFonts, loadImage } from './render';
import { activePage, addElement, collectFonts, getState, loadDoc, setPageBackground, setState, type El } from './store';

// 문서를 열고, 문서에 쓰인 글꼴(구글 글꼴 포함)을 내려받은 뒤 글자를 다시 그린다
export function openDoc(json: any, name?: string) {
  loadDoc(json, name);
  refreshFonts(collectFonts(getState().doc.pages.flatMap((p) => p.children)));
}

export async function addImageFromSrc(src: string, pageId = getState().activePageId) {
  const img = await loadImage(src);
  const { doc } = getState();
  const ratio = img.naturalWidth / img.naturalHeight;
  let width = doc.width * 0.5;
  let height = width / ratio;
  if (height > doc.height * 0.7) {
    height = doc.height * 0.7;
    width = height * ratio;
  }
  return addElement(
    { type: 'image', src, width, height, x: (doc.width - width) / 2, y: (doc.height - height) / 2 },
    pageId,
  );
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export async function addImageFiles(files: FileList | File[]) {
  for (const file of Array.from(files)) {
    if (!file.type.startsWith('image/')) continue;
    const src = await readFileAsDataUrl(file);
    setState((s) => ({ uploads: [src, ...s.uploads] }));
    await addImageFromSrc(src);
  }
}

export function addText(partial: Partial<El>) {
  const { doc } = getState();
  const width = Math.min(doc.width * 0.7, partial.width ?? 600);
  const el = addElement({
    type: 'text',
    width,
    x: (doc.width - width) / 2,
    y: doc.height / 2 - (partial.fontSize ?? 40),
    align: 'center',
    ...partial,
  });
  if (el.fontFamily) refreshFonts([el.fontFamily]);
  return el;
}

// 글꼴이 다 내려받아진 뒤 텍스트를 다시 그려 줄바꿈·폭을 맞춘다
export async function refreshFonts(families: string[]) {
  await ensureFonts(families);
  setState((s) => ({ fontsVersion: s.fontsVersion + 1 }));
}

export function setBackground(bg: string) {
  setPageBackground(activePage().id, bg);
}

export function scrollToPage(id: string) {
  document.getElementById(`ire-page-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
