// 도형(figure) 모양 — 요소 상자(w×h)에 맞춘 SVG path 문자열을 만든다. rect 는 Konva.Rect 로 따로 그린다.

type Pt = [number, number];

const polygon = (pts: Pt[]) => 'M' + pts.map(([x, y]) => `${x},${y}`).join(' L') + ' Z';

function regular(n: number, w: number, h: number, startDeg = -90): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = ((startDeg + (360 / n) * i) * Math.PI) / 180;
    return [w / 2 + (Math.cos(a) * w) / 2, h / 2 + (Math.sin(a) * h) / 2];
  });
}

function star(points: number, inner: number, w: number, h: number): Pt[] {
  return Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 === 0 ? 1 : inner;
    const a = ((-90 + (180 / points) * i) * Math.PI) / 180;
    return [w / 2 + (Math.cos(a) * w * r) / 2, h / 2 + (Math.sin(a) * h * r) / 2];
  });
}

// 반지름 목록으로 매끈한 닫힌 곡선(카트멀-롬 → 베지어)을 만든다.
function blob(radii: number[], w: number, h: number): string {
  const n = radii.length;
  const pts: Pt[] = radii.map((r, i) => {
    const a = (2 * Math.PI * i) / n - Math.PI / 2;
    return [w / 2 + (Math.cos(a) * w * r) / 2, h / 2 + (Math.sin(a) * h * r) / 2];
  });
  const at = (i: number) => pts[(i + n) % n]!;
  let d = `M${pts[0]![0]},${pts[0]![1]}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d + ' Z';
}

const BLOBS: Record<string, number[]> = {
  blob1: [1, 0.82, 0.95, 0.78, 1, 0.86],
  blob2: [0.9, 1, 0.75, 0.95, 0.8, 1, 0.78],
  blob3: [1, 0.7, 0.92, 0.85, 0.72, 0.98],
  blob4: [0.96, 0.88, 1, 0.84, 0.94, 0.9, 1, 0.86],
};

export function figurePath(subType: string, w: number, h: number): string {
  if (BLOBS[subType]) return blob(BLOBS[subType], w, h);
  switch (subType) {
    case 'circle':
      return `M0,${h / 2} A${w / 2},${h / 2} 0 1,0 ${w},${h / 2} A${w / 2},${h / 2} 0 1,0 0,${h / 2} Z`;
    case 'triangle':
      return polygon([[w / 2, 0], [w, h], [0, h]]);
    case 'rightTriangle':
      return polygon([[0, 0], [w, h], [0, h]]);
    case 'diamond':
      return polygon([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]);
    case 'pentagon':
      return polygon(regular(5, w, h));
    case 'hexagon':
      return polygon(regular(6, w, h, 0));
    case 'star':
      return polygon(star(5, 0.45, w, h));
    case 'arrow':
      return polygon([[0, h * 0.3], [w * 0.6, h * 0.3], [w * 0.6, 0], [w, h / 2], [w * 0.6, h], [w * 0.6, h * 0.7], [0, h * 0.7]]);
    case 'cross':
      return polygon([
        [w / 3, 0], [(2 * w) / 3, 0], [(2 * w) / 3, h / 3], [w, h / 3], [w, (2 * h) / 3], [(2 * w) / 3, (2 * h) / 3],
        [(2 * w) / 3, h], [w / 3, h], [w / 3, (2 * h) / 3], [0, (2 * h) / 3], [0, h / 3], [w / 3, h / 3],
      ]);
    case 'heart':
      return `M${w / 2},${h * 0.3} C${w / 2},${h * 0.1} ${w * 0.3},0 ${w * 0.15},0 C${w * 0.05},0 0,${h * 0.12} 0,${h * 0.3} C0,${h * 0.55} ${w * 0.25},${h * 0.75} ${w / 2},${h} C${w * 0.75},${h * 0.75} ${w},${h * 0.55} ${w},${h * 0.3} C${w},${h * 0.12} ${w * 0.95},0 ${w * 0.85},0 C${w * 0.7},0 ${w / 2},${h * 0.1} ${w / 2},${h * 0.3} Z`;
    default:
      return polygon([[0, 0], [w, 0], [w, h], [0, h]]);
  }
}

export const FIGURE_PRESETS: { label: string; subType: string; width?: number; height?: number; cornerRadius?: number }[] = [
  { label: '사각형', subType: 'rect' },
  { label: '둥근 사각형', subType: 'rect', cornerRadius: 30 },
  { label: '원', subType: 'circle' },
  { label: '삼각형', subType: 'triangle' },
  { label: '직각삼각형', subType: 'rightTriangle' },
  { label: '마름모', subType: 'diamond' },
  { label: '오각형', subType: 'pentagon' },
  { label: '육각형', subType: 'hexagon' },
  { label: '별', subType: 'star' },
  { label: '화살표', subType: 'arrow', width: 260, height: 160 },
  { label: '하트', subType: 'heart' },
  { label: '십자', subType: 'cross' },
  { label: '블롭 1', subType: 'blob1' },
  { label: '블롭 2', subType: 'blob2' },
  { label: '블롭 3', subType: 'blob3' },
  { label: '블롭 4', subType: 'blob4' },
  { label: '가로선', subType: 'rect', width: 400, height: 4 },
  { label: '세로선', subType: 'rect', width: 4, height: 300 },
];
