'use client';
// 페이지 한 장의 편집 캔버스 — 선택/이동/크기·회전 조절/스냅 가이드/텍스트 직접 편집.
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Group, Image as KImage, Layer, Line, Path, Rect, Stage, Text, Transformer } from 'react-konva';
import type Konva from 'konva';
import {
  borderProps,
  coverCrop,
  figureProps,
  groupProps,
  imageProps,
  isImageBackground,
  lineProps,
  textFontStyle,
  textProps,
  useImage,
} from './render';
import {
  elBox,
  getState,
  translateEl,
  isLocked,
  selectElements,
  setActivePage,
  setState,
  updateElements,
  useEditor,
  type Doc,
  type El,
  type Page,
} from './store';

function onElementPointer(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>, el: El, pageId: string) {
  setActivePage(pageId);
  if (el.selectable === false) return;
  const evt = e.evt as MouseEvent;
  const multi = evt.shiftKey || evt.ctrlKey || evt.metaKey;
  const cur = getState().selectedIds;
  if (multi) selectElements(cur.includes(el.id) ? cur.filter((id) => id !== el.id) : [...cur, el.id]);
  else if (!cur.includes(el.id)) selectElements([el.id]);
}

function startTextEdit(el: El) {
  if (el.type !== 'text' || el.contentEditable === false) return;
  setState({ editingTextId: el.id, selectedIds: [el.id] });
}

// 요소 하나의 실제 모양 (그룹 제외)
function ElShape({ el, textRef }: { el: El; textRef?: React.Ref<Konva.Text> }) {
  const img = useImage(el.type === 'image' ? el.src : undefined);
  if (el.type === 'text') return <Text ref={textRef} {...textProps(el)} />;
  if (el.type === 'line') return <Line {...lineProps(el)} />;
  if (el.type === 'figure') {
    const { kind, props } = figureProps(el);
    return kind === 'rect' ? <Rect {...props} /> : <Path {...(props as any)} />;
  }
  if (el.type === 'image') {
    return img ? (
      <>
        <KImage {...imageProps(el, img)} />
        {el.borderSize ? <Rect {...borderProps(el)} /> : null}
      </>
    ) : (
      <Rect name="content" width={el.width} height={el.height} fill="#d0d4d9" />
    );
  }
  return null;
}

// 그룹 안의 자식 — 따로 선택되지 않고 그룹과 함께 움직인다
function GroupChild({ el }: { el: El }) {
  return (
    <Group {...groupProps(el)} id={undefined}>
      {el.type === 'group' ? (el.children ?? []).map((c) => <GroupChild key={c.id} el={c} />) : <ElShape el={el} />}
    </Group>
  );
}

const ElementNode = memo(function ElementNode({ el, pageId, editing }: { el: El; pageId: string; editing: boolean }) {
  const textRef = useRef<Konva.Text>(null);

  // 텍스트 높이는 글꼴·줄바꿈 결과로 정해지므로 그려진 높이를 데이터에 맞춰 둔다 (기록에는 남기지 않음)
  useLayoutEffect(() => {
    const t = textRef.current;
    if (!t) return;
    const h = t.height();
    if (Math.abs(h - el.height) > 0.5) updateElements([el.id], { height: h }, { history: false });
  });

  const inner =
    el.type === 'group' ? (el.children ?? []).map((c) => <GroupChild key={c.id} el={c} />) : <ElShape el={el} textRef={textRef} />;

  return (
    <Group
      {...groupProps(el)}
      name="element"
      visible={el.visible !== false && !editing}
      draggable={!isLocked(el) && el.draggable !== false && !editing}
      onMouseDown={(e) => onElementPointer(e, el, pageId)}
      onTouchStart={(e) => onElementPointer(e, el, pageId)}
      onDblClick={() => startTextEdit(el)}
      onDblTap={() => startTextEdit(el)}
    >
      {inner}
    </Group>
  );
});

function Background({ doc, page }: { doc: Doc; page: Page }) {
  const isImg = isImageBackground(page.background);
  const img = useImage(isImg ? page.background : undefined);
  if (img) return <KImage name="page-bg" image={img} width={doc.width} height={doc.height} crop={coverCrop(img, doc.width, doc.height)} />;
  return <Rect name="page-bg" width={doc.width} height={doc.height} fill={isImg ? 'white' : page.background || 'white'} />;
}

function TextEditor({ el, scale }: { el: El; scale: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState<string>(el.text ?? '');
  const done = useRef(false);

  const autosize = () => {
    const t = ref.current;
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = `${t.scrollHeight}px`;
  };

  useEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.focus();
    t.select();
    autosize();
  }, []);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    if (value !== el.text) updateElements([el.id], { text: value });
    setState({ editingTextId: null });
  };

  return (
    <textarea
      ref={ref}
      className="ire-text-editor"
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        autosize();
      }}
      onBlur={finish}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) finish();
      }}
      style={{
        left: el.x * scale,
        top: el.y * scale,
        width: el.width * scale,
        transform: `rotate(${el.rotation || 0}deg)`,
        fontSize: el.fontSize * scale,
        fontFamily: `"${el.fontFamily}", sans-serif`,
        fontStyle: el.fontStyle === 'italic' ? 'italic' : 'normal',
        fontWeight: textFontStyle(el).replace('italic ', '') as any,
        lineHeight: el.lineHeight || 1.2,
        letterSpacing: `${(el.letterSpacing || 0) * el.fontSize * scale}px`,
        textDecoration: el.textDecoration || 'none',
        textAlign: el.align || 'left',
        color: el.fill,
        opacity: el.opacity ?? 1,
      }}
    />
  );
}

type Guides = { v: number[]; h: number[] };

export function PageCanvas({ doc, page, scale }: { doc: Doc; page: Page; scale: number }) {
  const selectedIds = useEditor((s) => s.selectedIds);
  const editingId = useEditor((s) => s.editingTextId);
  const fontsVersion = useEditor((s) => s.fontsVersion);
  const stageRef = useRef<Konva.Stage>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [guides, setGuides] = useState<Guides>({ v: [], h: [] });

  const selectedHere = useMemo(
    () => page.children.filter((c) => selectedIds.includes(c.id) && c.id !== editingId),
    [page.children, selectedIds, editingId],
  );
  const editingEl = page.children.find((c) => c.id === editingId);

  const findNode = (id: string) => stageRef.current?.findOne((n: Konva.Node) => n.id() === id) as Konva.Group | undefined;

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    tr.nodes(selectedHere.map((c) => findNode(c.id)).filter(Boolean) as Konva.Node[]);
    tr.getLayer()?.batchDraw();
  }, [selectedHere, fontsVersion]);

  // 그룹은 크기·회전 조절 없이 이동만 (조절하려면 그룹 풀기)
  const anyLocked = selectedHere.some((c) => isLocked(c) || c.type === 'group');
  const single = selectedHere.length === 1 ? selectedHere[0] : null;
  const anchors =
    single?.type === 'text'
      ? ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right']
      : single?.type === 'line'
        ? ['middle-left', 'middle-right']
        : undefined;

  const handleTransform = () => {
    const tr = trRef.current;
    const anchor = tr?.getActiveAnchor();
    if (!tr || (anchor !== 'middle-left' && anchor !== 'middle-right')) return;
    // 텍스트 좌우 손잡이는 글자를 늘리지 않고 상자 너비만 바꾼다
    tr.nodes().forEach((n) => {
      const t = (n as Konva.Group).findOne('Text') as Konva.Text | undefined;
      if (!t) return;
      t.width(Math.max(20, t.width() * n.scaleX()));
      n.scaleX(1);
    });
  };

  const handleTransformEnd = () => {
    const tr = trRef.current;
    if (!tr) return;
    const patches: Record<string, Partial<El>> = {};
    tr.nodes().forEach((n) => {
      const el = page.children.find((c) => c.id === n.id());
      if (!el) return;
      const sx = n.scaleX();
      const sy = n.scaleY();
      n.scale({ x: 1, y: 1 });
      const p: Partial<El> = { x: n.x(), y: n.y(), rotation: n.rotation() };
      if (el.type === 'text') {
        const t = (n as Konva.Group).findOne('Text') as Konva.Text;
        p.width = Math.max(20, t.width() * sx);
        if (Math.abs(sy - 1) > 1e-3) p.fontSize = Math.max(4, el.fontSize * sy);
      } else {
        p.width = Math.max(1, el.width * sx);
        p.height = Math.max(1, el.height * sy);
      }
      patches[el.id] = p;
    });
    updateElements(Object.keys(patches), (el) => patches[el.id]);
  };

  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const layer = layerRef.current;
    if (node.name() !== 'element' || !layer || getState().selectedIds.length > 1) return;
    const box = node.getClientRect({ relativeTo: layer });
    const others = page.children.filter((c) => c.id !== node.id() && c.visible !== false).map(elBox);
    const vT = [0, doc.width / 2, doc.width, ...others.flatMap((c) => [c.x, c.x + c.width / 2, c.x + c.width])];
    const hT = [0, doc.height / 2, doc.height, ...others.flatMap((c) => [c.y, c.y + c.height / 2, c.y + c.height])];
    const thr = 6 / scale;
    const snap = (edges: number[], targets: number[]) => {
      let best: { d: number; t: number } | null = null;
      for (const e of edges)
        for (const t of targets) {
          const d = t - e;
          if (Math.abs(d) < thr && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, t };
        }
      return best;
    };
    const sv = snap([box.x, box.x + box.width / 2, box.x + box.width], vT);
    const sh = snap([box.y, box.y + box.height / 2, box.y + box.height], hT);
    if (sv) node.x(node.x() + sv.d);
    if (sh) node.y(node.y() + sh.d);
    setGuides({ v: sv ? [sv.t] : [], h: sh ? [sh.t] : [] });
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (e.target.name() !== 'element') return;
    setGuides({ v: [], h: [] });
    const id = e.target.id();
    const cur = getState().selectedIds;
    const ids = cur.includes(id) ? cur : [id];
    const patches: Record<string, Partial<El>> = {};
    ids.forEach((i) => {
      const n = findNode(i);
      const el = page.children.find((c) => c.id === i);
      if (!n || !el) return;
      if (el.type === 'group') {
        // 그룹 노드는 늘 0,0 이어야 하므로 옮긴 만큼 자식 좌표에 더하고 노드는 제자리로
        patches[i] = translateEl(el, n.x(), n.y());
        n.position({ x: 0, y: 0 });
      } else patches[i] = { x: n.x(), y: n.y() };
    });
    updateElements(Object.keys(patches), (el) => patches[el.id]!);
  };

  return (
    <div className="ire-page-canvas" style={{ width: doc.width * scale, height: doc.height * scale }}>
      <Stage
        ref={stageRef}
        width={doc.width * scale}
        height={doc.height * scale}
        scaleX={scale}
        scaleY={scale}
        onMouseDown={(e) => {
          setActivePage(page.id);
          const t = e.target;
          if (t === t.getStage() || t.name() === 'page-bg') selectElements([]);
        }}
        onTouchStart={(e) => {
          setActivePage(page.id);
          const t = e.target;
          if (t === t.getStage() || t.name() === 'page-bg') selectElements([]);
        }}
      >
        <Layer ref={layerRef} onDragMove={handleDragMove} onDragEnd={handleDragEnd}>
          <Background doc={doc} page={page} />
          {page.children.map((el) => (
            <ElementNode
              key={el.type === 'text' ? `${el.id}:${fontsVersion}` : el.id}
              el={el}
              pageId={page.id}
              editing={el.id === editingId}
            />
          ))}
          {guides.v.map((x) => (
            <Line key={`v${x}`} points={[x, 0, x, doc.height]} stroke="#ff3d8b" strokeWidth={1 / scale} listening={false} />
          ))}
          {guides.h.map((y) => (
            <Line key={`h${y}`} points={[0, y, doc.width, y]} stroke="#ff3d8b" strokeWidth={1 / scale} listening={false} />
          ))}
          <Transformer
            ref={trRef}
            rotateEnabled={!anyLocked}
            resizeEnabled={!anyLocked}
            enabledAnchors={anchors}
            keepRatio={single?.type === 'image' || single?.type === 'text'}
            rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
            rotationSnapTolerance={4}
            borderStroke="#2b8cee"
            borderStrokeWidth={1.5}
            anchorStroke="#2b8cee"
            anchorFill="#ffffff"
            anchorSize={10}
            anchorCornerRadius={5}
            padding={0}
            ignoreStroke
            boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5 ? oldBox : newBox)}
            onTransform={handleTransform}
            onTransformEnd={handleTransformEnd}
          />
        </Layer>
      </Stage>
      {editingEl && <TextEditor key={editingEl.id} el={editingEl} scale={scale} />}
    </div>
  );
}
