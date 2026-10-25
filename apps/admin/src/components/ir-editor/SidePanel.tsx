'use client';
// 왼쪽 탭 + 패널 — IR 문서 / 템플릿들 / 텍스트 / 사진들 / 요소 / 업로드 / 배경 / 레이어 / 크기
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  Eye,
  EyeOff,
  Group,
  Minus,
  Image as ImageIcon,
  Images,
  LayoutTemplate,
  Lock,
  LockOpen,
  PaintBucket,
  Layers,
  Scaling,
  Shapes,
  Trash2,
  Type,
  Upload,
} from 'lucide-react';
import { MiniPreview } from './MiniPreview';
import { addImageFiles, addImageFromSrc, addText, openDoc, refreshFonts, scrollToPage, setBackground } from './actions';
import { FIGURE_PRESETS, figurePath } from './shapes';
import { KOREAN_FONTS } from './render';
import { ColorSwatch, PRESET_COLORS } from './ui';
import { TEMPLATE_LAYOUTS } from './layouts';
import {
  activePage,
  addElement,
  addPage,
  deleteElements,
  isLocked,
  reorderElement,
  selectElements,
  setDocSize,
  setLocked,
  setPageChildren,
  updateElements,
  useEditor,
  getState,
  type El,
} from './store';

// ---------------- IR 문서 (public/ir-templates) ----------------
type IrItem = { json: string; preview: string };

function IrDocsPanel() {
  const [items, setItems] = useState<IrItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(1);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    fetch(`/ir-templates/page${page}.json`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setTotal(d.total_pages || 1);
        setItems((prev) => {
          const seen = new Set(prev.map((i) => i.json));
          return [...prev, ...(d.items as IrItem[]).filter((i) => !seen.has(i.json))];
        });
      })
      .catch(() => alive && setError('IR 문서 목록을 불러오지 못했습니다.'));
    return () => {
      alive = false;
    };
  }, [page]);

  const open = async (item: IrItem) => {
    setLoading(item.json);
    try {
      const json = await fetch(`/ir-templates/${encodeURIComponent(item.json)}`).then((r) => r.json());
      openDoc(json, item.json.replace(/\.json$/i, ''));
    } catch {
      alert('IR 문서를 열지 못했습니다.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="ire-panel-scroll">
      {error && <p className="ire-muted">{error}</p>}
      <div className="ire-ir-grid">
        {items.map((item) => (
          <button type="button" key={item.json} className="ire-ir-item" onClick={() => open(item)} disabled={!!loading}>
            <img src={`/ir-templates/${encodeURIComponent(item.preview)}`} alt={item.json} />
            {loading === item.json && <span className="ire-loading">여는 중…</span>}
          </button>
        ))}
      </div>
      {page < total && (
        <button type="button" className="ire-secondary" onClick={() => setPage((p) => p + 1)}>
          더 보기
        </button>
      )}
    </div>
  );
}

// ---------------- 템플릿들 (기본 레이아웃) ----------------
function TemplatesPanel() {
  const doc = useEditor((s) => s.doc);
  const apply = (make: (w: number, h: number) => El[]) => {
    const page = activePage();
    const children = make(doc.width, doc.height);
    if (page.children.length === 0) setPageChildren(page.id, children);
    else scrollToPage(addPage(page.id, children));
    refreshFonts(children.filter((c) => c.type === 'text').map((c) => c.fontFamily));
  };
  return (
    <div className="ire-panel-scroll">
      <p className="ire-muted">빈 페이지에는 바로 적용되고, 내용이 있으면 다음 페이지로 추가됩니다.</p>
      <div className="ire-tpl-grid">
        {TEMPLATE_LAYOUTS.map((t) => {
          const preview = { id: t.name, background: t.background ?? 'white', children: t.make(doc.width, doc.height) };
          return (
            <button type="button" key={t.name} className="ire-tpl-item" onClick={() => apply(t.make)} title={t.name}>
              <MiniPreview page={preview} docWidth={doc.width} docHeight={doc.height} width={150} />
              <span>{t.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- 텍스트 ----------------
function TextPanel() {
  useEffect(() => {
    refreshFonts(KOREAN_FONTS);
  }, []);
  return (
    <div className="ire-panel-scroll">
      <button type="button" className="ire-add-text is-title" onClick={() => addText({ text: '제목을 입력하세요', fontSize: 72, fontWeight: 'bold', width: 900 })}>
        제목 추가
      </button>
      <button type="button" className="ire-add-text is-sub" onClick={() => addText({ text: '부제목을 입력하세요', fontSize: 44, fontWeight: 'bold', width: 800 })}>
        부제목 추가
      </button>
      <button type="button" className="ire-add-text is-body" onClick={() => addText({ text: '본문 내용을 입력하세요', fontSize: 26, width: 700 })}>
        본문 추가
      </button>
      <div className="ire-section-title">글꼴로 추가</div>
      <div className="ire-font-list">
        {KOREAN_FONTS.map((f) => (
          <button
            type="button"
            key={f}
            style={{ fontFamily: `"${f}", sans-serif` }}
            onClick={() => addText({ text: '가나다 텍스트', fontFamily: f, fontSize: 56, width: 700 })}
          >
            <span className="ire-font-sample">가나다 Aa</span>
            <span className="ire-font-name">{f}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------- 사진들 (picsum.photos — 키 없이 쓰는 무료 사진) ----------------
type Photo = { id: string; author: string; width: number; height: number };

function usePhotos() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`https://picsum.photos/v2/list?page=${page}&limit=30`)
      .then((r) => r.json())
      .then((list: Photo[]) => alive && setPhotos((prev) => [...prev, ...list]))
      .catch(() => alive && setError('사진을 불러오지 못했습니다. 인터넷 연결을 확인하세요.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [page]);
  return { photos, loading, error, more: () => setPage((p) => p + 1) };
}

const photoUrl = (p: Photo, w: number) => `https://picsum.photos/id/${p.id}/${w}/${Math.round((w * p.height) / p.width)}`;

function PhotoGrid({ onPick }: { onPick: (p: Photo) => void }) {
  const { photos, loading, error, more } = usePhotos();
  return (
    <>
      {error && <p className="ire-muted">{error}</p>}
      <div className="ire-photo-grid">
        {photos.map((p) => (
          <button type="button" key={p.id} onClick={() => onPick(p)} title={`사진: ${p.author}`}>
            <img src={photoUrl(p, 300)} alt={p.author} loading="lazy" />
          </button>
        ))}
      </div>
      <button type="button" className="ire-secondary" disabled={loading} onClick={more}>
        {loading ? '불러오는 중…' : '더 보기'}
      </button>
    </>
  );
}

function PhotosPanel() {
  const [busy, setBusy] = useState(false);
  return (
    <div className="ire-panel-scroll">
      <p className="ire-muted">무료 사진(Picsum)입니다. 눌러서 페이지에 넣으세요.{busy ? ' 넣는 중…' : ''}</p>
      <PhotoGrid
        onPick={async (p) => {
          setBusy(true);
          try {
            await addImageFromSrc(photoUrl(p, Math.min(1920, p.width)));
          } catch {
            alert('사진을 넣지 못했습니다.');
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

// ---------------- 요소 ----------------
function ElementsPanel() {
  const doc = useEditor((s) => s.doc);
  const add = (f: (typeof FIGURE_PRESETS)[number]) => {
    const width = f.width ?? 200;
    const height = f.height ?? 200;
    addElement({
      type: 'figure',
      subType: f.subType,
      width,
      height,
      cornerRadius: f.cornerRadius ?? 0,
      x: (doc.width - width) / 2,
      y: (doc.height - height) / 2,
      fill: f.label.includes('선') ? '#333333' : 'rgba(155,155,155,1)',
    });
  };
  return (
    <div className="ire-panel-scroll">
      <div className="ire-section-title">도형</div>
      <div className="ire-shape-grid">
        {FIGURE_PRESETS.map((f) => {
          const w = f.width && f.height ? (f.width > f.height ? 64 : Math.max(4, (64 * f.width) / f.height)) : 64;
          const h = f.width && f.height ? (f.height > f.width ? 64 : Math.max(4, (64 * f.height) / f.width)) : 64;
          return (
            <button type="button" key={f.label} title={f.label} onClick={() => add(f)}>
              <svg width={64} height={64} viewBox="0 0 64 64">
                <g transform={`translate(${(64 - w) / 2},${(64 - h) / 2})`}>
                  {f.subType === 'rect' ? (
                    <rect width={w} height={h} rx={f.cornerRadius ? 10 : 0} fill="#9b9b9b" />
                  ) : (
                    <path d={figurePath(f.subType, w, h)} fill="#9b9b9b" />
                  )}
                </g>
              </svg>
              <span>{f.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- 업로드 ----------------
function UploadPanel() {
  const uploads = useEditor((s) => s.uploads);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="ire-panel-scroll">
      <button type="button" className="ire-primary" onClick={() => inputRef.current?.click()}>
        <Upload size={16} /> 이미지 올리기
      </button>
      <p className="ire-muted">이미지 파일을 작업 화면에 끌어다 놓아도 됩니다. 올린 파일은 이 브라우저 안에서만 쓰입니다.</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) addImageFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <div className="ire-photo-grid">
        {uploads.map((src, i) => (
          <button type="button" key={i} onClick={() => addImageFromSrc(src)}>
            <img src={src} alt="" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------- 배경 ----------------
function BackgroundPanel() {
  const page = useEditor((s) => activePage(s));
  const isImg = /^(https?:|data:|blob:|\/)/.test(page.background);
  return (
    <div className="ire-panel-scroll">
      <div className="ire-row">
        <span>직접 고르기</span>
        <ColorSwatch title="배경색" value={isImg ? '#ffffff' : page.background} onChange={setBackground} />
      </div>
      <div className="ire-color-grid">
        {PRESET_COLORS.map((c) => (
          <button
            type="button"
            key={c}
            title={c}
            style={{ background: c }}
            className={page.background === c ? 'is-active' : ''}
            onClick={() => setBackground(c)}
          />
        ))}
      </div>
      <div className="ire-section-title">사진 배경</div>
      <PhotoGrid onPick={(p) => setBackground(photoUrl(p, 1920))} />
    </div>
  );
}

// ---------------- 레이어 ----------------
function LayersPanel() {
  const page = useEditor((s) => activePage(s));
  const selectedIds = useEditor((s) => s.selectedIds);
  const pageIndex = useEditor((s) => s.doc.pages.findIndex((p) => p.id === s.activePageId));
  const rows = useMemo(() => [...page.children].reverse(), [page.children]);
  const label = (el: El) =>
    el.name && !/^(image|figure|text|line|group)-\d+$/.test(el.name)
      ? el.name
      : el.type === 'text'
        ? (el.text || '텍스트').trim().slice(0, 24)
        : el.type === 'image'
          ? '이미지'
          : el.type === 'group'
            ? `그룹 (${el.children?.length ?? 0}개)`
            : el.type === 'line'
              ? '선'
              : `도형 (${FIGURE_PRESETS.find((f) => f.subType === el.subType)?.label ?? el.subType})`;
  return (
    <div className="ire-panel-scroll">
      <p className="ire-muted">페이지 {pageIndex + 1}의 요소 (위가 맨 앞)</p>
      {!rows.length && <p className="ire-muted">요소가 없습니다.</p>}
      <ul className="ire-layers">
        {rows.map((el, i) => (
          <li
            key={el.id}
            className={selectedIds.includes(el.id) ? 'is-active' : ''}
            onClick={(e) => {
              const cur = getState().selectedIds;
              selectElements(e.shiftKey ? (cur.includes(el.id) ? cur.filter((x) => x !== el.id) : [...cur, el.id]) : [el.id]);
            }}
          >
            <span className="ire-layer-icon">
              {el.type === 'text' ? (
                <Type size={14} />
              ) : el.type === 'image' ? (
                <ImageIcon size={14} />
              ) : el.type === 'group' ? (
                <Group size={14} />
              ) : el.type === 'line' ? (
                <Minus size={14} />
              ) : (
                <Shapes size={14} />
              )}
            </span>
            <span className="ire-layer-name">{label(el)}</span>
            <span className="ire-layer-actions" onClick={(e) => e.stopPropagation()}>
              <button type="button" title="앞으로" disabled={i === 0} onClick={() => reorderElement(el.id, 'up')}>
                <ArrowUp size={13} />
              </button>
              <button type="button" title="뒤로" disabled={i === rows.length - 1} onClick={() => reorderElement(el.id, 'down')}>
                <ArrowDown size={13} />
              </button>
              <button type="button" title={el.visible === false ? '보이기' : '숨기기'} onClick={() => updateElements([el.id], { visible: el.visible === false })}>
                {el.visible === false ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
              <button type="button" title={isLocked(el) ? '잠금 풀기' : '잠그기'} onClick={() => setLocked([el.id], !isLocked(el))}>
                {isLocked(el) ? <Lock size={13} /> : <LockOpen size={13} />}
              </button>
              <button type="button" title="삭제" disabled={isLocked(el)} onClick={() => deleteElements([el.id])}>
                <Trash2 size={13} />
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------- 크기 ----------------
const SIZE_PRESETS = [
  { label: '발표 16:9', w: 1280, h: 720 },
  { label: '발표 16:9 (FHD)', w: 1920, h: 1080 },
  { label: '발표 4:3', w: 1024, h: 768 },
  { label: 'A4 세로', w: 595, h: 842 },
  { label: 'A4 가로', w: 842, h: 595 },
  { label: '인스타그램 정사각', w: 1080, h: 1080 },
  { label: '인스타그램 세로 4:5', w: 1080, h: 1350 },
  { label: '스토리 9:16', w: 1080, h: 1920 },
];

function SizePanel() {
  const doc = useEditor((s) => s.doc);
  const [w, setW] = useState(doc.width);
  const [h, setH] = useState(doc.height);
  const [scaleContent, setScaleContent] = useState(true);
  useEffect(() => {
    setW(doc.width);
    setH(doc.height);
  }, [doc.width, doc.height]);
  const apply = (nw: number, nh: number) => nw > 0 && nh > 0 && setDocSize(Math.round(nw), Math.round(nh), scaleContent);
  return (
    <div className="ire-panel-scroll">
      <p className="ire-muted">
        지금 크기: {doc.width} × {doc.height} px (모든 페이지에 적용)
      </p>
      <label className="ire-check">
        <input type="checkbox" checked={scaleContent} onChange={(e) => setScaleContent(e.target.checked)} />
        내용도 같이 맞춰 키우기/줄이기
      </label>
      <div className="ire-size-inputs">
        <label>
          너비
          <input type="number" value={w} min={50} max={8000} onChange={(e) => setW(+e.target.value)} />
        </label>
        <label>
          높이
          <input type="number" value={h} min={50} max={8000} onChange={(e) => setH(+e.target.value)} />
        </label>
        <button type="button" className="ire-primary" onClick={() => apply(w, h)}>
          적용
        </button>
      </div>
      <div className="ire-size-list">
        {SIZE_PRESETS.map((s) => (
          <button
            type="button"
            key={s.label}
            className={s.w === doc.width && s.h === doc.height ? 'is-active' : ''}
            onClick={() => apply(s.w, s.h)}
          >
            <span>{s.label}</span>
            <span className="ire-muted">
              {s.w} × {s.h}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------- 탭 ----------------
const SECTIONS = [
  { key: 'ir', label: 'IR 문서', Icon: Images, Panel: IrDocsPanel },
  { key: 'templates', label: '템플릿들', Icon: LayoutTemplate, Panel: TemplatesPanel },
  { key: 'text', label: '텍스트', Icon: Type, Panel: TextPanel },
  { key: 'photos', label: '사진들', Icon: ImageIcon, Panel: PhotosPanel },
  { key: 'elements', label: '요소', Icon: Shapes, Panel: ElementsPanel },
  { key: 'upload', label: '업로드', Icon: Upload, Panel: UploadPanel },
  { key: 'background', label: '배경', Icon: PaintBucket, Panel: BackgroundPanel },
  { key: 'layers', label: '레이어', Icon: Layers, Panel: LayersPanel },
  { key: 'size', label: '크기', Icon: Scaling, Panel: SizePanel },
] as const;

export function SidePanel() {
  const [active, setActive] = useState<string>('ir');
  const [open, setOpen] = useState(true);
  const section = SECTIONS.find((s) => s.key === active) ?? SECTIONS[0];
  const Panel = section.Panel;
  return (
    <div className="ire-side">
      <nav className="ire-tabs">
        {SECTIONS.map(({ key, label, Icon }) => (
          <button
            type="button"
            key={key}
            className={`ire-tab ${active === key && open ? 'is-active' : ''}`}
            onClick={() => {
              if (active === key) setOpen((o) => !o);
              else {
                setActive(key);
                setOpen(true);
              }
            }}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {open && (
        <section className="ire-panel" aria-label={section.label}>
          <Panel />
          <button type="button" className="ire-panel-collapse" title="패널 접기" onClick={() => setOpen(false)}>
            <ChevronLeft size={14} />
          </button>
        </section>
      )}
    </div>
  );
}

