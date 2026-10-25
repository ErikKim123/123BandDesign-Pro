'use client';
// 상단 도구 막대 — 선택한 요소 종류에 따라 다른 조절 도구를 보여준다.
import { useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Blend,
  Bold,
  Copy,
  Download,
  FlipHorizontal2,
  FlipVertical2,
  Group,
  Italic,
  Layers,
  LetterText,
  Lock,
  LockOpen,
  Redo2,
  Sparkles,
  Square,
  Strikethrough,
  Trash2,
  Underline,
  Undo2,
  Ungroup,
  Minus,
} from 'lucide-react';
import { downloadImages, downloadJson, downloadPdf } from './exporter';
import { downloadSvg } from './svgExport';
import { openDoc, refreshFonts } from './actions';
import { GOOGLE_FONTS, KOREAN_FONTS, SYSTEM_FONTS } from './render';
import { ColorSwatch, IconButton, Popover, Slider } from './ui';
import {
  activePage,
  deleteElements,
  collectFonts,
  duplicateElements,
  elBox,
  getState,
  groupElements,
  isLocked,
  translateEl,
  ungroupElement,
  reorderElement,
  setLocked,
  setPageBackground,
  setState,
  undo,
  redo,
  updateElements,
  useEditor,
  type El,
} from './store';

function useSelected(): El[] {
  const doc = useEditor((s) => s.doc);
  const ids = useEditor((s) => s.selectedIds);
  return useMemo(() => {
    const set = new Set(ids);
    return doc.pages.flatMap((p) => p.children.filter((c) => set.has(c.id)));
  }, [doc, ids]);
}

function TextControls({ els }: { els: El[] }) {
  const el = els[0]!;
  const ids = els.map((e) => e.id);
  const set = (patch: Partial<El>) => updateElements(ids, patch);
  const size = Math.round(el.fontSize);
  const nextAlign = el.align === 'left' ? 'center' : el.align === 'center' ? 'right' : 'left';
  const AlignIcon = el.align === 'center' ? AlignCenter : el.align === 'right' ? AlignRight : AlignLeft;
  const deco = (v: string) => set({ textDecoration: el.textDecoration === v ? '' : v });
  return (
    <>
      <select
        className="ire-select ire-font-select"
        value={el.fontFamily}
        title="글꼴"
        onChange={(e) => {
          set({ fontFamily: e.target.value });
          refreshFonts([e.target.value]);
        }}
      >
        <optgroup label="한글 글꼴">
          {KOREAN_FONTS.map((f) => (
            <option key={f} value={f} style={{ fontFamily: `"${f}"` }}>
              {f}
            </option>
          ))}
        </optgroup>
        <optgroup label="구글 글꼴">
          {GOOGLE_FONTS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </optgroup>
        <optgroup label="기본 글꼴">
          {SYSTEM_FONTS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </optgroup>
        {![...KOREAN_FONTS, ...GOOGLE_FONTS, ...SYSTEM_FONTS].includes(el.fontFamily) && (
          <option value={el.fontFamily}>{el.fontFamily}</option>
        )}
      </select>
      <div className="ire-number">
        <button type="button" title="글자 작게" onClick={() => set({ fontSize: Math.max(4, size - 1) })}>
          −
        </button>
        <input
          type="number"
          value={size}
          min={4}
          max={800}
          title="글자 크기"
          onChange={(e) => +e.target.value > 0 && set({ fontSize: +e.target.value })}
        />
        <button type="button" title="글자 크게" onClick={() => set({ fontSize: size + 1 })}>
          +
        </button>
      </div>
      <ColorSwatch title="글자 색" value={el.fill} onChange={(v) => set({ fill: v })} />
      <IconButton
        title="굵게"
        active={el.fontWeight === 'bold' || +el.fontWeight >= 600}
        onClick={() => set({ fontWeight: el.fontWeight === 'bold' || +el.fontWeight >= 600 ? 'normal' : 'bold' })}
      >
        <Bold size={16} />
      </IconButton>
      <IconButton title="기울임" active={el.fontStyle === 'italic'} onClick={() => set({ fontStyle: el.fontStyle === 'italic' ? 'normal' : 'italic' })}>
        <Italic size={16} />
      </IconButton>
      <IconButton title="밑줄" active={el.textDecoration === 'underline'} onClick={() => deco('underline')}>
        <Underline size={16} />
      </IconButton>
      <IconButton title="취소선" active={el.textDecoration === 'line-through'} onClick={() => deco('line-through')}>
        <Strikethrough size={16} />
      </IconButton>
      <IconButton title="정렬" onClick={() => set({ align: nextAlign })}>
        <AlignIcon size={16} />
      </IconButton>
      <Popover title="줄·글자 간격" button={<LetterText size={16} />}>
        <Slider label="줄 간격" value={el.lineHeight || 1.2} min={0.5} max={3} step={0.05} onChange={(v) => set({ lineHeight: v })} />
        <Slider label="글자 간격" value={el.letterSpacing || 0} min={-0.2} max={1} step={0.01} onChange={(v) => set({ letterSpacing: v })} />
      </Popover>
    </>
  );
}

function ImageControls({ els }: { els: El[] }) {
  const el = els[0]!;
  const ids = els.map((e) => e.id);
  const set = (patch: Partial<El>) => updateElements(ids, patch);
  return (
    <>
      <IconButton title="좌우 뒤집기" active={!!el.flipX} onClick={() => set({ flipX: !el.flipX })}>
        <FlipHorizontal2 size={16} />
      </IconButton>
      <IconButton title="상하 뒤집기" active={!!el.flipY} onClick={() => set({ flipY: !el.flipY })}>
        <FlipVertical2 size={16} />
      </IconButton>
      <Popover title="모서리·테두리" button={<Square size={16} />}>
        <Slider
          label="모서리 둥글기"
          value={el.cornerRadius || 0}
          min={0}
          max={Math.round(Math.min(el.width, el.height) / 2)}
          onChange={(v) => set({ cornerRadius: v })}
        />
        <Slider label="테두리 두께" value={el.borderSize || 0} min={0} max={40} onChange={(v) => set({ borderSize: v })} />
        <div className="ire-row">
          <span>테두리 색</span>
          <ColorSwatch title="테두리 색" value={el.borderColor || '#000000'} onChange={(v) => set({ borderColor: v })} />
        </div>
      </Popover>
    </>
  );
}

function FigureControls({ els }: { els: El[] }) {
  const el = els[0]!;
  const ids = els.map((e) => e.id);
  const set = (patch: Partial<El>) => updateElements(ids, patch);
  return (
    <>
      <ColorSwatch title="채우기 색" value={el.fill} onChange={(v) => set({ fill: v })} />
      <Popover title="테두리" button={<span className="ire-stroke-icon" style={{ borderColor: el.stroke }} />}>
        <Slider label="테두리 두께" value={el.strokeWidth || 0} min={0} max={40} onChange={(v) => set({ strokeWidth: v })} />
        <div className="ire-row">
          <span>테두리 색</span>
          <ColorSwatch title="테두리 색" value={el.stroke || '#000000'} onChange={(v) => set({ stroke: v })} />
        </div>
        <div className="ire-row">
          <span>점선</span>
          <input type="checkbox" checked={!!el.dash?.length} onChange={(e) => set({ dash: e.target.checked ? [4, 2] : [] })} />
        </div>
      </Popover>
      {(el.subType === 'rect' || !el.subType) && (
        <Popover title="모서리 둥글기" button={<Square size={16} />}>
          <Slider
            label="모서리 둥글기"
            value={el.cornerRadius || 0}
            min={0}
            max={Math.round(Math.min(el.width, el.height) / 2)}
            onChange={(v) => set({ cornerRadius: v })}
          />
        </Popover>
      )}
    </>
  );
}

function LineControls({ els }: { els: El[] }) {
  const el = els[0]!;
  const set = (patch: Partial<El>) => updateElements(els.map((e) => e.id), patch);
  return (
    <>
      <ColorSwatch title="선 색" value={el.color || '#000000'} onChange={(v) => set({ color: v })} />
      <Popover title="선 두께·모양" button={<Minus size={16} strokeWidth={3} />}>
        <Slider label="두께" value={Math.round((el.height || 1) * 10) / 10} min={0.2} max={40} step={0.1} onChange={(v) => set({ height: v })} />
        <div className="ire-row">
          <span>점선</span>
          <input type="checkbox" checked={!!el.dash?.length} onChange={(e) => set({ dash: e.target.checked ? [2, 1] : [] })} />
        </div>
      </Popover>
    </>
  );
}

function EffectsPopover({ els }: { els: El[] }) {
  const el = els[0]!;
  const set = (patch: Partial<El>) => updateElements(els.map((e) => e.id), patch);
  return (
    <Popover title="그림자" button={<Sparkles size={16} />}>
      <div className="ire-row">
        <span>그림자</span>
        <input type="checkbox" checked={!!el.shadowEnabled} onChange={(e) => set({ shadowEnabled: e.target.checked })} />
      </div>
      {el.shadowEnabled && (
        <>
          <Slider label="흐림" value={el.shadowBlur ?? 5} min={0} max={50} onChange={(v) => set({ shadowBlur: v })} />
          <Slider label="가로 위치" value={el.shadowOffsetX ?? 0} min={-50} max={50} onChange={(v) => set({ shadowOffsetX: v })} />
          <Slider label="세로 위치" value={el.shadowOffsetY ?? 0} min={-50} max={50} onChange={(v) => set({ shadowOffsetY: v })} />
          <Slider label="진하기" value={el.shadowOpacity ?? 1} min={0} max={1} step={0.05} onChange={(v) => set({ shadowOpacity: v })} />
          <div className="ire-row">
            <span>색</span>
            <ColorSwatch title="그림자 색" value={el.shadowColor || '#000000'} onChange={(v) => set({ shadowColor: v })} />
          </div>
        </>
      )}
    </Popover>
  );
}

function alignToPage(els: El[], how: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') {
  const { width: W, height: H } = getState().doc;
  updateElements(
    els.map((e) => e.id),
    (e) => {
      const b = elBox(e);
      const dx = how === 'left' ? -b.x : how === 'center' ? (W - b.width) / 2 - b.x : how === 'right' ? W - b.width - b.x : 0;
      const dy = how === 'top' ? -b.y : how === 'middle' ? (H - b.height) / 2 - b.y : how === 'bottom' ? H - b.height - b.y : 0;
      return translateEl(e, dx, dy);
    },
  );
}

function PositionPopover({ els }: { els: El[] }) {
  const id = els[0]!.id;
  return (
    <Popover title="위치" align="right" button={<><Layers size={16} /><span className="ire-btn-text">위치</span></>}>
      {(close) => (
        <div className="ire-menu">
          <div className="ire-menu-title">순서</div>
          <div className="ire-grid2">
            <button type="button" onClick={() => reorderElement(id, 'top')}>맨 앞으로</button>
            <button type="button" onClick={() => reorderElement(id, 'up')}>앞으로</button>
            <button type="button" onClick={() => reorderElement(id, 'down')}>뒤로</button>
            <button type="button" onClick={() => reorderElement(id, 'bottom')}>맨 뒤로</button>
          </div>
          <div className="ire-menu-title">페이지에 맞춰 정렬</div>
          <div className="ire-grid2">
            <button type="button" onClick={() => alignToPage(els, 'left')}>왼쪽</button>
            <button type="button" onClick={() => alignToPage(els, 'top')}>위</button>
            <button type="button" onClick={() => alignToPage(els, 'center')}>가운데</button>
            <button type="button" onClick={() => alignToPage(els, 'middle')}>중간</button>
            <button type="button" onClick={() => alignToPage(els, 'right')}>오른쪽</button>
            <button type="button" onClick={() => alignToPage(els, 'bottom')}>아래</button>
          </div>
          <button type="button" className="ire-menu-close" onClick={close}>닫기</button>
        </div>
      )}
    </Popover>
  );
}

function DownloadPopover() {
  const docName = useEditor((s) => s.docName);
  const [format, setFormat] = useState<'png' | 'jpeg' | 'pdf' | 'svg'>('png');
  const [outline, setOutline] = useState(true);
  const doc = useEditor((s) => s.doc);
  const usedFonts = useMemo(() => collectFonts(doc.pages.flatMap((p) => p.children)), [doc]);
  const [ratio, setRatio] = useState(2);
  const [range, setRange] = useState<'active' | 'all'>('all');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = async () => {
    setBusy(true);
    try {
      const { doc } = getState();
      const name = docName || 'ir-document';
      const pages = range === 'all' ? doc.pages : [activePage()];
      if (format === 'pdf') await downloadPdf(doc, name, ratio);
      else if (format === 'svg') await downloadSvg(doc, pages, name, outline);
      else await downloadImages(doc, pages, name, format, ratio);
    } catch (e) {
      alert(`내려받기에 실패했습니다: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover
      title="내려받기"
      align="right"
      button={
        <>
          <Download size={16} />
          <span className="ire-btn-text">내려받기</span>
        </>
      }
    >
      <div className="ire-menu ire-download">
        <label className="ire-field">
          <span>파일 이름</span>
          <input value={docName} onChange={(e) => setState({ docName: e.target.value })} />
        </label>
        <label className="ire-field">
          <span>형식</span>
          <select className="ire-select" value={format} onChange={(e) => setFormat(e.target.value as any)}>
            <option value="png">PNG 이미지</option>
            <option value="jpeg">JPG 이미지</option>
            <option value="pdf">PDF 문서 (전체 페이지)</option>
            <option value="svg">SVG — 일러스트레이터에서 수정</option>
          </select>
        </label>
        {format === 'svg' && (
          <>
            <label className="ire-check">
              <input type="checkbox" checked={outline} onChange={(e) => setOutline(e.target.checked)} />
              글자를 윤곽선으로 만들기
            </label>
            <p className="ire-muted">
              도형·선이 살아 있는 벡터 파일입니다. 일러스트레이터에서 「파일 &gt; 열기」로 여세요. 여러 페이지는 페이지별 SVG를
              ZIP으로 묶어 받습니다.
              <br />
              {outline
                ? '글자가 윤곽선(패스)으로 바뀌어 글꼴이 없어도 모양이 그대로입니다. 대신 글자 내용은 고칠 수 없습니다.'
                : `글자를 고칠 수 있지만 PC에 같은 글꼴이 있어야 합니다.${usedFonts.length ? ` 필요한 글꼴: ${usedFonts.join(', ')}` : ''}`}
            </p>
          </>
        )}
        {format !== 'pdf' && (
          <label className="ire-field">
            <span>페이지</span>
            <select className="ire-select" value={range} onChange={(e) => setRange(e.target.value as any)}>
              <option value="all">전체 페이지</option>
              <option value="active">선택한 페이지만</option>
            </select>
          </label>
        )}
        {format !== 'svg' && (
        <label className="ire-field">
          <span>화질</span>
          <select className="ire-select" value={ratio} onChange={(e) => setRatio(+e.target.value)}>
            <option value={1}>보통 (1배)</option>
            <option value={2}>선명 (2배)</option>
            <option value={3}>아주 선명 (3배)</option>
          </select>
        </label>
        )}
        <button type="button" className="ire-primary" disabled={busy} onClick={run}>
          {busy ? '만드는 중…' : '내려받기'}
        </button>
        <div className="ire-menu-title">작업 파일</div>
        <div className="ire-grid2">
          <button type="button" onClick={() => downloadJson(getState().doc, docName || 'ir-document')}>
            JSON 저장
          </button>
          <button type="button" onClick={() => fileRef.current?.click()}>
            JSON 열기
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              openDoc(JSON.parse(await f.text()), f.name.replace(/\.json$/i, ''));
            } catch {
              alert('JSON 파일을 열 수 없습니다.');
            }
            e.target.value = '';
          }}
        />
      </div>
    </Popover>
  );
}

export function Toolbar() {
  const els = useSelected();
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const page = useEditor((s) => activePage(s));
  const ids = els.map((e) => e.id);
  const types = new Set(els.map((e) => e.type));
  const one = types.size === 1 ? els[0]!.type : null;
  const locked = els.length > 0 && els.every(isLocked);

  return (
    <div className="ire-toolbar">
      <div className="ire-toolbar-left">
        <IconButton title="되돌리기 (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
          <Undo2 size={17} />
        </IconButton>
        <IconButton title="다시 하기 (Ctrl+Shift+Z)" disabled={!canRedo} onClick={redo}>
          <Redo2 size={17} />
        </IconButton>
        <span className="ire-divider" />
        {!locked && one === 'text' && <TextControls els={els} />}
        {!locked && one === 'image' && <ImageControls els={els} />}
        {!locked && one === 'figure' && <FigureControls els={els} />}
        {!locked && one === 'line' && <LineControls els={els} />}
        {els.length === 1 && one === 'group' && (
          <IconButton title="그룹 풀기 (안의 요소를 따로 고칠 수 있게)" onClick={() => ungroupElement(els[0]!.id)}>
            <Ungroup size={16} />
            <span className="ire-btn-text">그룹 풀기</span>
          </IconButton>
        )}
        {els.length > 1 && (
          <IconButton title="그룹 만들기" onClick={() => groupElements(ids)}>
            <Group size={16} />
            <span className="ire-btn-text">그룹 만들기</span>
          </IconButton>
        )}
        {!els.length && page && (
          <>
            <span className="ire-toolbar-label">페이지 배경</span>
            <ColorSwatch
              title="페이지 배경색"
              value={/^(https?:|data:|blob:|\/)/.test(page.background) ? '#ffffff' : page.background}
              onChange={(v) => setPageBackground(page.id, v)}
            />
          </>
        )}
      </div>
      <div className="ire-toolbar-right">
        {els.length > 0 && (
          <>
            {!locked && !types.has('group') && <EffectsPopover els={els} />}
            <PositionPopover els={els} />
            <Popover title="투명도" align="right" button={<Blend size={16} />}>
              <Slider
                label="투명도"
                value={Math.round((els[0]!.opacity ?? 1) * 100)}
                min={0}
                max={100}
                suffix="%"
                onChange={(v) => updateElements(ids, { opacity: v / 100 })}
              />
            </Popover>
            <IconButton title={locked ? '잠금 풀기' : '잠그기'} active={locked} onClick={() => setLocked(ids, !locked)}>
              {locked ? <Lock size={16} /> : <LockOpen size={16} />}
            </IconButton>
            <IconButton title="복제 (Ctrl+D)" onClick={() => duplicateElements(ids)}>
              <Copy size={16} />
            </IconButton>
            <IconButton title="삭제 (Delete)" disabled={locked} onClick={() => deleteElements(ids)}>
              <Trash2 size={16} />
            </IconButton>
            <span className="ire-divider" />
          </>
        )}
        <DownloadPopover />
      </div>
    </div>
  );
}
