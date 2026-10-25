// 「템플릿들」 패널의 기본 IR 레이아웃 — 페이지 크기 비율에 맞춰 요소를 만든다.
import { makeElement, type El } from './store';

const NAVY = '#0b1f3a';
const ACCENT = '#1c7ed6';
const GRAY = 'rgba(191,191,191,1)';

type Make = (w: number, h: number) => El[];

function kit(w: number, h: number) {
  const k = Math.min(w / 1280, h / 720);
  const text = (text: string, x: number, y: number, width: number, size: number, extra: Partial<El> = {}) =>
    makeElement({
      type: 'text',
      text,
      x: x * w,
      y: y * h,
      width: width * w,
      height: size * k * 1.2,
      fontSize: size * k,
      fontFamily: 'Pretendard',
      fill: '#111111',
      align: 'left',
      ...extra,
    });
  const box = (x: number, y: number, bw: number, bh: number, fill: string, extra: Partial<El> = {}) =>
    makeElement({ type: 'figure', subType: 'rect', x: x * w, y: y * h, width: bw * w, height: bh * h, fill, ...extra });
  const circle = (cx: number, cy: number, d: number, fill: string, extra: Partial<El> = {}) =>
    makeElement({ type: 'figure', subType: 'circle', x: cx * w - (d * k) / 2, y: cy * h - (d * k) / 2, width: d * k, height: d * k, fill, ...extra });
  return { text, box, circle, k };
}

const heading = (w: number, h: number, title: string, label: string) => {
  const { text, box } = kit(w, h);
  return [
    box(0.06, 0.1, 0.035, 0.008, ACCENT),
    text(label, 0.06, 0.125, 0.5, 18, { fill: ACCENT, fontWeight: 'bold' }),
    text(title, 0.06, 0.17, 0.88, 44, { fontWeight: 'bold' }),
  ];
};

export const TEMPLATE_LAYOUTS: { name: string; background?: string; make: Make }[] = [
  {
    name: '표지',
    make: (w, h) => {
      const { text, box } = kit(w, h);
      return [
        box(0, 0, 1, 1, NAVY),
        box(0.08, 0.3, 0.06, 0.012, ACCENT),
        text('회사명 · Investor Relations', 0.08, 0.34, 0.8, 22, { fill: '#9fb3c8' }),
        text('한 문장으로 말하는\n우리 회사의 비전', 0.08, 0.41, 0.84, 64, { fill: '#ffffff', fontWeight: 'bold' }),
        text('2026. 10  |  발표자 이름', 0.08, 0.84, 0.6, 20, { fill: '#9fb3c8' }),
      ];
    },
  },
  {
    name: '목차',
    make: (w, h) => {
      const { text, box } = kit(w, h);
      const items = ['문제 정의', '해결책', '시장 규모', '비즈니스 모델', '팀 소개'];
      return [
        box(0, 0, 0.36, 1, NAVY),
        text('CONTENTS', 0.06, 0.12, 0.26, 20, { fill: '#9fb3c8', fontWeight: 'bold' }),
        text('목차', 0.06, 0.17, 0.26, 60, { fill: '#ffffff', fontWeight: 'bold' }),
        ...items.flatMap((t, i) => [
          text(String(i + 1).padStart(2, '0'), 0.44, 0.16 + i * 0.14, 0.08, 34, { fill: ACCENT, fontWeight: 'bold' }),
          text(t, 0.53, 0.165 + i * 0.14, 0.4, 32, { fontWeight: 'bold' }),
        ]),
      ];
    },
  },
  {
    name: '문제 정의',
    make: (w, h) => {
      const { text, box } = kit(w, h);
      return [
        ...heading(w, h, '고객이 겪는 세 가지 문제', 'PROBLEM'),
        ...[0, 1, 2].flatMap((i) => [
          box(0.06 + i * 0.3, 0.42, 0.28, 0.46, '#f1f3f5', { cornerRadius: 16 }),
          text(`0${i + 1}`, 0.085 + i * 0.3, 0.46, 0.2, 40, { fill: ACCENT, fontWeight: 'bold' }),
          text(['비싸다', '느리다', '복잡하다'][i]!, 0.085 + i * 0.3, 0.57, 0.24, 30, { fontWeight: 'bold' }),
          text('문제를 구체적인 숫자와\n사례로 설명하세요.', 0.085 + i * 0.3, 0.65, 0.24, 20, { fill: '#555555' }),
        ]),
      ];
    },
  },
  {
    name: '해결책',
    make: (w, h) => {
      const { text, box } = kit(w, h);
      return [
        ...heading(w, h, '우리의 해결책', 'SOLUTION'),
        text('제품이 문제를 어떻게 해결하는지\n핵심 기능 세 가지로 설명하세요.', 0.06, 0.34, 0.4, 24, { fill: '#444444', lineHeight: 1.5 }),
        ...[0, 1, 2].flatMap((i) => [
          box(0.06, 0.55 + i * 0.12, 0.012, 0.06, ACCENT),
          text(['핵심 기능 하나', '핵심 기능 둘', '핵심 기능 셋'][i]!, 0.085, 0.555 + i * 0.12, 0.36, 24, { fontWeight: 'bold' }),
        ]),
        box(0.52, 0.12, 0.42, 0.76, GRAY, { cornerRadius: 12, name: '사진 자리' }),
      ];
    },
  },
  {
    name: '시장 규모',
    make: (w, h) => {
      const { text, circle } = kit(w, h);
      return [
        ...heading(w, h, '시장 규모', 'MARKET'),
        circle(0.3, 0.62, 440, '#dbe9fb'),
        circle(0.3, 0.68, 300, '#a5c8f5'),
        circle(0.3, 0.74, 160, ACCENT),
        text('TAM  전체 시장  10조 원', 0.58, 0.42, 0.38, 28, { fontWeight: 'bold' }),
        text('SAM  유효 시장  1조 원', 0.58, 0.56, 0.38, 28, { fontWeight: 'bold', fill: '#3b6fb6' }),
        text('SOM  목표 시장  1,000억 원', 0.58, 0.7, 0.38, 28, { fontWeight: 'bold', fill: ACCENT }),
      ];
    },
  },
  {
    name: '핵심 지표',
    make: (w, h) => {
      const { text, box } = kit(w, h);
      const nums: [string, string][] = [
        ['120만', '누적 사용자'],
        ['35%', '월 성장률'],
        ['48억', '연 매출'],
      ];
      return [
        ...heading(w, h, '숫자로 보는 성과', 'TRACTION'),
        ...nums.flatMap(([n, l], i) => [
          box(0.06 + i * 0.3, 0.42, 0.28, 0.004, '#dee2e6'),
          text(n, 0.06 + i * 0.3, 0.48, 0.28, 76, { fill: ACCENT, fontWeight: 'bold' }),
          text(l, 0.06 + i * 0.3, 0.66, 0.28, 24, { fill: '#555555' }),
        ]),
      ];
    },
  },
  {
    name: '팀 소개',
    make: (w, h) => {
      const { text, circle } = kit(w, h);
      return [
        ...heading(w, h, '함께하는 사람들', 'TEAM'),
        ...[0, 1, 2].flatMap((i) => [
          circle(0.2 + i * 0.3, 0.55, 170, GRAY),
          text(['대표 이름', '공동창업자', '기술 책임자'][i]!, 0.08 + i * 0.3, 0.73, 0.24, 26, { fontWeight: 'bold', align: 'center' }),
          text('주요 경력 한 줄', 0.08 + i * 0.3, 0.79, 0.24, 18, { fill: '#666666', align: 'center' }),
        ]),
      ];
    },
  },
  {
    name: '감사합니다',
    make: (w, h) => {
      const { text, box } = kit(w, h);
      return [
        box(0, 0, 1, 1, NAVY),
        text('감사합니다', 0.1, 0.36, 0.8, 80, { fill: '#ffffff', fontWeight: 'bold', align: 'center' }),
        text('contact@company.com  |  010-0000-0000', 0.1, 0.56, 0.8, 24, { fill: '#9fb3c8', align: 'center' }),
      ];
    },
  },
];
