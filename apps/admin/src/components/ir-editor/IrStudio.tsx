'use client';
// 123IR 에디터 — Polotno 없이 Konva(MIT)로 직접 만든 IR 문서 편집기. 라이선스 키가 필요 없다.
import { useEffect, useState } from 'react';
import './fonts.css';
import './ir-editor.css';
import { SidePanel } from './SidePanel';
import { Toolbar } from './Toolbar';
import { PagesTimeline, Workspace } from './Workspace';
import { refreshFonts } from './actions';
import { KOREAN_FONTS } from './render';
import {
  activePage,
  deleteElements,
  duplicateElements,
  getState,
  isLocked,
  moveElements,
  pasteElements,
  redo,
  selectElements,
  setState,
  undo,
  updateElements,
  type El,
} from './store';

let clipboard: El[] = [];

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const s = getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const sel = s.doc.pages.flatMap((p) => p.children.filter((c) => s.selectedIds.includes(c.id)));
      const movable = sel.filter((c) => !isLocked(c));

      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && key === 'y') {
        e.preventDefault();
        redo();
      } else if (mod && key === 'd') {
        e.preventDefault();
        if (sel.length) duplicateElements(sel.map((c) => c.id));
      } else if (mod && key === 'c') {
        if (sel.length) clipboard = sel.map((c) => ({ ...c }));
      } else if (mod && key === 'v') {
        if (clipboard.length) pasteElements(clipboard);
      } else if (mod && key === 'a') {
        e.preventDefault();
        selectElements(activePage().children.filter((c) => c.selectable !== false).map((c) => c.id));
      } else if (key === 'delete' || key === 'backspace') {
        if (movable.length) {
          e.preventDefault();
          deleteElements(movable.map((c) => c.id));
        }
      } else if (key === 'escape') {
        selectElements([]);
      } else if (key.startsWith('arrow') && movable.length) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0;
        const dy = key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0;
        moveElements(movable.map((c) => c.id), dx, dy);
      } else if (key === 'enter' && sel.length === 1 && sel[0]!.type === 'text' && !isLocked(sel[0]!)) {
        e.preventDefault();
        setState({ editingTextId: sel[0]!.id });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export default function IrStudio() {
  const [showPages, setShowPages] = useState(false);
  useShortcuts();

  useEffect(() => {
    refreshFonts(KOREAN_FONTS);
  }, []);

  return (
    <div className="ire-root">
      <SidePanel />
      <main className="ire-main">
        <Toolbar />
        <Workspace />
        {showPages && <PagesTimeline />}
        <button type="button" className="ire-pages-toggle" onClick={() => setShowPages((v) => !v)}>
          {showPages ? '페이지 닫기' : '페이지'}
        </button>
      </main>
    </div>
  );
}
