// IR 에디터 상태 — 외부 라이브러리 없이 useSyncExternalStore 로 만든 단일 스토어.
// 문서 형식은 기존 IR 템플릿 JSON(width/height/pages[].children[]) 과 같아서 그대로 열고 저장할 수 있다.
import { useSyncExternalStore } from 'react';

export type El = {
  id: string;
  type: 'text' | 'image' | 'figure' | 'line' | 'group';
  name?: string;
  children?: El[]; // group 일 때만. 자식 좌표는 페이지 기준(절대) 좌표다.
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  draggable?: boolean;
  resizable?: boolean;
  removable?: boolean;
  [key: string]: any;
};

export type Page = { id: string; background: string; children: El[]; [key: string]: any };

export type Doc = { width: number; height: number; pages: Page[]; [key: string]: any };

export type EditorState = {
  doc: Doc;
  activePageId: string;
  selectedIds: string[];
  editingTextId: string | null;
  zoom: number | null; // null = 화면에 맞춤
  past: Doc[];
  future: Doc[];
  fontsVersion: number;
  uploads: string[];
  docName: string;
};

export const uid = () => Math.random().toString(36).slice(2, 12);

const newPage = (): Page => ({ id: uid(), background: 'white', children: [], bleed: 0, duration: 5000 });

function emptyDoc(): Doc {
  return {
    width: 1280,
    height: 720,
    fonts: [],
    audios: [],
    unit: 'px',
    dpi: 72,
    custom: null,
    schemaVersion: 2,
    pages: [newPage()],
  };
}

const firstDoc = emptyDoc();
let state: EditorState = {
  doc: firstDoc,
  activePageId: firstDoc.pages[0]!.id,
  selectedIds: [],
  editingTextId: null,
  zoom: null,
  past: [],
  future: [],
  fontsVersion: 0,
  uploads: [],
  docName: 'ir-document',
};

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const getState = () => state;

export function setState(patch: Partial<EditorState> | ((s: EditorState) => Partial<EditorState>)) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  listeners.forEach((l) => l());
}

export function useEditor<T>(selector: (s: EditorState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}

const HISTORY_LIMIT = 80;

function commit(doc: Doc, extra: Partial<EditorState> = {}) {
  setState((s) => ({ doc, past: [...s.past, s.doc].slice(-HISTORY_LIMIT), future: [], ...extra }));
}

function mapPages(fn: (p: Page) => Page): Doc {
  return { ...state.doc, pages: state.doc.pages.map(fn) };
}

export function findElement(id: string): { page: Page; el: El } | null {
  for (const page of state.doc.pages) {
    const el = page.children.find((c) => c.id === id);
    if (el) return { page, el };
  }
  return null;
}

export const activePage = (s: EditorState = state) =>
  s.doc.pages.find((p) => p.id === s.activePageId) ?? s.doc.pages[0]!;

export const isLocked = (el: El) => el.draggable === false && el.resizable === false;

// ---- 그룹·좌표 도우미 (그룹은 자식만 좌표를 가진다) ----
export function translateEl(el: El, dx: number, dy: number): El {
  return el.type === 'group'
    ? { ...el, children: (el.children ?? []).map((c) => translateEl(c, dx, dy)) }
    : { ...el, x: el.x + dx, y: el.y + dy };
}

function withNewIds(el: El): El {
  return { ...el, id: uid(), ...(el.children ? { children: el.children.map(withNewIds) } : {}) };
}

function fixIds(el: any): El {
  return { ...el, id: el.id || uid(), ...(Array.isArray(el.children) ? { children: el.children.map(fixIds) } : {}) };
}

function scaleEl(el: El, sx: number, sy: number, fs: number): El {
  if (el.type === 'group') return { ...el, children: (el.children ?? []).map((c) => scaleEl(c, sx, sy, fs)) };
  return {
    ...el,
    x: el.x * sx,
    y: el.y * sy,
    width: el.width * sx,
    height: el.type === 'line' ? el.height * fs : el.height * sy,
    ...(el.type === 'text' ? { fontSize: el.fontSize * fs } : {}),
  };
}

export function elBox(el: El): { x: number; y: number; width: number; height: number } {
  if (el.type !== 'group') return { x: el.x, y: el.y, width: el.width, height: el.height };
  const boxes = (el.children ?? []).filter((c) => c.visible !== false).map(elBox);
  if (!boxes.length) return { x: 0, y: 0, width: 0, height: 0 };
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const r = Math.max(...boxes.map((b) => b.x + b.width));
  const b = Math.max(...boxes.map((bx) => bx.y + bx.height));
  return { x, y, width: r - x, height: b - y };
}

export function collectFonts(els: El[]): string[] {
  const out = new Set<string>();
  const walk = (list: El[]) =>
    list.forEach((e) => {
      if (e.type === 'text' && e.fontFamily) out.add(e.fontFamily);
      if (e.children) walk(e.children);
    });
  walk(els);
  return [...out];
}

// ---- 기록 ----
export function undo() {
  const { past, doc, future } = state;
  if (!past.length) return;
  const prev = past[past.length - 1]!;
  setState({ doc: prev, past: past.slice(0, -1), future: [doc, ...future], ...keepValidSelection(prev) });
}

export function redo() {
  const { past, doc, future } = state;
  if (!future.length) return;
  const next = future[0]!;
  setState({ doc: next, past: [...past, doc], future: future.slice(1), ...keepValidSelection(next) });
}

function keepValidSelection(doc: Doc): Partial<EditorState> {
  const ids = new Set(doc.pages.flatMap((p) => p.children.map((c) => c.id)));
  const activeOk = doc.pages.some((p) => p.id === state.activePageId);
  return {
    selectedIds: state.selectedIds.filter((id) => ids.has(id)),
    editingTextId: null,
    activePageId: activeOk ? state.activePageId : doc.pages[0]!.id,
  };
}

// ---- 문서 ----
export function loadDoc(json: any, name?: string) {
  const doc: Doc = { ...emptyDoc(), ...json };
  doc.width = Number(doc.width) || 1280;
  doc.height = Number(doc.height) || 720;
  doc.pages = (Array.isArray(json?.pages) && json.pages.length ? json.pages : [newPage()]).map((p: any) => ({
    ...p,
    id: p.id || uid(),
    background: p.background || 'white',
    children: (p.children || []).map(fixIds),
  }));
  setState({
    doc,
    activePageId: doc.pages[0]!.id,
    selectedIds: [],
    editingTextId: null,
    past: [],
    future: [],
    zoom: null,
    docName: name ?? state.docName,
  });
}

export function setDocSize(width: number, height: number, scaleContent: boolean) {
  const sx = width / state.doc.width;
  const sy = height / state.doc.height;
  const fs = Math.min(sx, sy);
  const pages = state.doc.pages.map((p) =>
    scaleContent ? { ...p, children: p.children.map((c) => scaleEl(c, sx, sy, fs)) } : p,
  );
  commit({ ...state.doc, width, height, pages });
}

// ---- 페이지 ----
export function setActivePage(id: string) {
  if (state.activePageId !== id) setState({ activePageId: id });
}

export function addPage(afterId = state.activePageId, children: El[] = []) {
  const page = { ...newPage(), children };
  const pages = [...state.doc.pages];
  const idx = pages.findIndex((p) => p.id === afterId);
  pages.splice(idx < 0 ? pages.length : idx + 1, 0, page);
  commit({ ...state.doc, pages }, { activePageId: page.id, selectedIds: [] });
  return page.id;
}

export function duplicatePage(id: string) {
  const pages = [...state.doc.pages];
  const idx = pages.findIndex((p) => p.id === id);
  if (idx < 0) return;
  const src = pages[idx]!;
  const copy = { ...src, id: uid(), children: src.children.map((c) => ({ ...c, id: uid() })) };
  pages.splice(idx + 1, 0, copy);
  commit({ ...state.doc, pages }, { activePageId: copy.id, selectedIds: [] });
}

export function deletePage(id: string) {
  let pages = state.doc.pages.filter((p) => p.id !== id);
  if (!pages.length) pages = [newPage()];
  const idx = state.doc.pages.findIndex((p) => p.id === id);
  const nextActive = pages[Math.min(idx, pages.length - 1)]!.id;
  commit({ ...state.doc, pages }, { activePageId: nextActive, selectedIds: [] });
}

export function movePage(id: string, dir: -1 | 1) {
  const pages = [...state.doc.pages];
  const idx = pages.findIndex((p) => p.id === id);
  const to = idx + dir;
  if (idx < 0 || to < 0 || to >= pages.length) return;
  [pages[idx], pages[to]] = [pages[to]!, pages[idx]!];
  commit({ ...state.doc, pages });
}

export function setPageBackground(id: string, background: string) {
  commit(mapPages((p) => (p.id === id ? { ...p, background } : p)));
}

export function setPageChildren(id: string, children: El[]) {
  commit(mapPages((p) => (p.id === id ? { ...p, children } : p)), { selectedIds: [] });
}

// ---- 요소 ----
const COMMON = {
  name: '',
  rotation: 0,
  opacity: 1,
  visible: true,
  selectable: true,
  removable: true,
  alwaysOnTop: false,
  showInExport: true,
  draggable: true,
  resizable: true,
  contentEditable: true,
  styleEditable: true,
  shadowEnabled: false,
  shadowBlur: 5,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  shadowColor: 'black',
  shadowOpacity: 1,
};

const TYPE_DEFAULTS: Record<El['type'], Record<string, any>> = {
  text: {
    text: '텍스트',
    fontSize: 40,
    fontFamily: 'Pretendard',
    fontStyle: 'normal',
    fontWeight: 'normal',
    textDecoration: '',
    fill: '#000000',
    align: 'left',
    verticalAlign: 'top',
    lineHeight: 1.2,
    letterSpacing: 0,
    strokeWidth: 0,
    stroke: 'black',
  },
  image: {
    cropX: 0,
    cropY: 0,
    cropWidth: 1,
    cropHeight: 1,
    cornerRadius: 0,
    flipX: false,
    flipY: false,
    borderColor: 'black',
    borderSize: 0,
    keepRatio: true,
  },
  figure: { subType: 'rect', fill: 'rgba(155,155,155,1)', stroke: '#0c0c0c', strokeWidth: 0, cornerRadius: 0, dash: [] },
  line: { color: '#000000', dash: [], startHead: '', endHead: '', height: 4 },
  group: { children: [] },
};

export function makeElement(partial: Partial<El> & { type: El['type'] }): El {
  return {
    ...COMMON,
    x: 0,
    y: 0,
    width: 200,
    height: 200,
    ...TYPE_DEFAULTS[partial.type],
    ...partial,
    id: partial.id ?? uid(),
  } as El;
}

export function addElement(partial: Partial<El> & { type: El['type'] }, pageId = state.activePageId) {
  const el = makeElement(partial);
  commit(mapPages((p) => (p.id === pageId ? { ...p, children: [...p.children, el] } : p)), {
    selectedIds: [el.id],
    activePageId: pageId,
  });
  return el;
}

export function updateElements(
  ids: string[],
  patch: Partial<El> | ((el: El) => Partial<El>),
  opts: { history?: boolean } = {},
) {
  if (!ids.length) return;
  const set = new Set(ids);
  const doc = mapPages((p) =>
    p.children.some((c) => set.has(c.id))
      ? {
          ...p,
          children: p.children.map((c) =>
            set.has(c.id) ? { ...c, ...(typeof patch === 'function' ? patch(c) : patch) } : c,
          ),
        }
      : p,
  );
  if (opts.history === false) setState({ doc });
  else commit(doc);
}

export function deleteElements(ids: string[]) {
  const set = new Set(ids);
  const doc = mapPages((p) => ({
    ...p,
    children: p.children.filter((c) => !set.has(c.id) || c.removable === false),
  }));
  commit(doc, { selectedIds: [], editingTextId: null });
}

export function duplicateElements(ids: string[], offset = 20) {
  const set = new Set(ids);
  const newIds: string[] = [];
  const doc = mapPages((p) => {
    const copies = p.children
      .filter((c) => set.has(c.id))
      .map((c) => {
        const copy = { ...translateEl(withNewIds(c), offset, offset), draggable: true, resizable: true };
        newIds.push(copy.id);
        return copy;
      });
    return copies.length ? { ...p, children: [...p.children, ...copies] } : p;
  });
  commit(doc, { selectedIds: newIds });
}

export function pasteElements(els: El[], pageId = state.activePageId) {
  const copies = els.map((c) => translateEl(withNewIds(c), 20, 20));
  commit(mapPages((p) => (p.id === pageId ? { ...p, children: [...p.children, ...copies] } : p)), {
    selectedIds: copies.map((c) => c.id),
    activePageId: pageId,
  });
}

export function reorderElement(id: string, where: 'up' | 'down' | 'top' | 'bottom') {
  const doc = mapPages((p) => {
    const idx = p.children.findIndex((c) => c.id === id);
    if (idx < 0) return p;
    const children = [...p.children];
    const [el] = children.splice(idx, 1);
    const to =
      where === 'top' ? children.length : where === 'bottom' ? 0 : where === 'up' ? Math.min(idx + 1, children.length) : Math.max(idx - 1, 0);
    children.splice(to, 0, el!);
    return { ...p, children };
  });
  commit(doc);
}

export function moveElements(ids: string[], dx: number, dy: number) {
  if (dx || dy) updateElements(ids, (el) => translateEl(el, dx, dy));
}

export function groupElements(ids: string[]) {
  const page = activePage();
  const set = new Set(ids);
  const picked = page.children.filter((c) => set.has(c.id));
  if (picked.length < 2) return;
  const group = {
    id: uid(),
    type: 'group',
    name: '',
    opacity: 1,
    visible: true,
    selectable: true,
    removable: true,
    showInExport: true,
    children: picked,
  } as unknown as El;
  const lastIdx = Math.max(...picked.map((c) => page.children.indexOf(c)));
  const children: El[] = [];
  page.children.forEach((c, i) => {
    if (!set.has(c.id)) children.push(c);
    if (i === lastIdx) children.push(group);
  });
  commit(mapPages((p) => (p.id === page.id ? { ...p, children } : p)), { selectedIds: [group.id] });
}

export function ungroupElement(id: string) {
  const found = findElement(id);
  if (!found || found.el.type !== 'group') return;
  const inner = found.el.children ?? [];
  commit(
    mapPages((p) =>
      p.id === found.page.id ? { ...p, children: p.children.flatMap((c) => (c.id === id ? inner : [c])) } : p,
    ),
    { selectedIds: inner.map((c) => c.id) },
  );
}

export function selectElements(ids: string[]) {
  setState({ selectedIds: ids, editingTextId: null });
}

export function setLocked(ids: string[], locked: boolean) {
  updateElements(ids, {
    draggable: !locked,
    resizable: !locked,
    contentEditable: !locked,
    styleEditable: !locked,
  });
}
