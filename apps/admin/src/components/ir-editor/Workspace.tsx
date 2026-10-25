'use client';
// 작업 영역 — 페이지를 세로로 쌓아 보여주고, 화면 근처 페이지만 실제 캔버스로 그린다.
import { useEffect, useRef, useState, type RefObject } from 'react';
import { ArrowDown, ArrowUp, CopyPlus, FilePlus2, Minus, Plus, Trash2 } from 'lucide-react';
import { PageCanvas } from './PageCanvas';
import { MiniPreview } from './MiniPreview';
import { addImageFiles, scrollToPage } from './actions';
import { IconButton } from './ui';
import {
  addPage,
  deletePage,
  duplicatePage,
  movePage,
  selectElements,
  setActivePage,
  setState,
  useEditor,
  type Doc,
  type Page,
} from './store';

function PageFrame({
  doc,
  page,
  index,
  scale,
  active,
  rootRef,
}: {
  doc: Doc;
  page: Page;
  index: number;
  scale: number;
  active: boolean;
  rootRef: RefObject<HTMLDivElement>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(index < 2);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setNear(!!entry?.isIntersecting), {
      root: rootRef.current,
      rootMargin: '900px 0px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, [rootRef]);

  const total = doc.pages.length;
  return (
    <div id={`ire-page-${page.id}`} className={`ire-page ${active ? 'is-active' : ''}`} ref={ref}>
      <div className="ire-page-head" style={{ width: doc.width * scale }}>
        <span className="ire-page-label">
          페이지 {index + 1}
          {total > 1 ? ` / ${total}` : ''}
        </span>
        <div className="ire-page-actions">
          <IconButton title="위로 이동" disabled={index === 0} onClick={() => movePage(page.id, -1)}>
            <ArrowUp size={15} />
          </IconButton>
          <IconButton title="아래로 이동" disabled={index === total - 1} onClick={() => movePage(page.id, 1)}>
            <ArrowDown size={15} />
          </IconButton>
          <IconButton title="페이지 복제" onClick={() => duplicatePage(page.id)}>
            <CopyPlus size={15} />
          </IconButton>
          <IconButton title="뒤에 새 페이지 추가" onClick={() => addPage(page.id)}>
            <FilePlus2 size={15} />
          </IconButton>
          <IconButton title="페이지 삭제" onClick={() => deletePage(page.id)}>
            <Trash2 size={15} />
          </IconButton>
        </div>
      </div>
      <div className="ire-page-body" onMouseDown={() => setActivePage(page.id)}>
        {near ? (
          <PageCanvas doc={doc} page={page} scale={scale} />
        ) : (
          <MiniPreview page={page} docWidth={doc.width} docHeight={doc.height} width={doc.width * scale} />
        )}
      </div>
    </div>
  );
}

function ZoomButtons({ scale, fit }: { scale: number; fit: number }) {
  const set = (z: number) => setState({ zoom: Math.min(5, Math.max(0.05, z)) });
  return (
    <div className="ire-zoom">
      <IconButton title="축소" onClick={() => set(scale / 1.2)}>
        <Minus size={16} />
      </IconButton>
      <button type="button" className="ire-zoom-value" title="화면에 맞춤" onClick={() => setState({ zoom: null })}>
        {Math.round(scale * 100)}%
      </button>
      <IconButton title="확대" onClick={() => set(scale * 1.2)}>
        <Plus size={16} />
      </IconButton>
      {Math.abs(scale - fit) > 1e-3 && (
        <button type="button" className="ire-zoom-fit" onClick={() => setState({ zoom: null })}>
          맞춤
        </button>
      )}
    </div>
  );
}

export function PagesTimeline() {
  const doc = useEditor((s) => s.doc);
  const activeId = useEditor((s) => s.activePageId);
  return (
    <div className="ire-timeline">
      {doc.pages.map((p, i) => (
        <button
          type="button"
          key={p.id}
          className={`ire-timeline-item ${p.id === activeId ? 'is-active' : ''}`}
          onClick={() => {
            setActivePage(p.id);
            scrollToPage(p.id);
          }}
        >
          <MiniPreview page={p} docWidth={doc.width} docHeight={doc.height} width={110} />
          <span>{i + 1}</span>
        </button>
      ))}
      <button type="button" className="ire-timeline-add" title="페이지 추가" onClick={() => scrollToPage(addPage())}>
        <Plus size={20} />
      </button>
    </div>
  );
}

export function Workspace() {
  const doc = useEditor((s) => s.doc);
  const zoom = useEditor((s) => s.zoom);
  const activeId = useEditor((s) => s.activePageId);
  const rootRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 1000, h: 700 });

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = Math.max(0.05, Math.min((box.w - 80) / doc.width, (box.h - 110) / doc.height));
  const scale = zoom ?? fit;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  // Ctrl + 휠 확대/축소
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const z = scaleRef.current * (e.deltaY < 0 ? 1.1 : 1 / 1.1);
      setState({ zoom: Math.min(5, Math.max(0.05, z)) });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <div className="ire-workspace-wrap">
      <div
        className="ire-workspace"
        ref={rootRef}
        onMouseDown={(e) => {
          const t = e.target as HTMLElement;
          if (t === e.currentTarget || t.dataset.blank) selectElements([]);
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) e.preventDefault();
        }}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          addImageFiles(e.dataTransfer.files);
        }}
      >
        <div className="ire-pages" data-blank="1">
          {doc.pages.map((p, i) => (
            <PageFrame key={p.id} doc={doc} page={p} index={i} scale={scale} active={p.id === activeId} rootRef={rootRef} />
          ))}
        </div>
      </div>
      <ZoomButtons scale={scale} fit={fit} />
    </div>
  );
}
