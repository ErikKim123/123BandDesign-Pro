// 업적 뱃지 생성기 — 게임 뱃지 스타일(3D 느낌의 금속 테두리 · 광택 에나멜 · 장식).
//
// 사용: node scripts/generate-badges.mjs <출력 폴더> [업적코드 ...]
//   코드를 안 주면 아래 BADGES 전부. 결과는 <코드>.png (512×512, 투명 배경) + _sheet.png(한눈에 보기).
//   올리기: node packages/supabase/upload_badge.mjs <코드> <출력 폴더>/<코드>.png
//
// 만드는 법: 각 뱃지 = 바탕(원 · 방패 · 마름모 · 육각 · 별) + 장식(햇살 · 날개 · 월계수 · 톱니 · 왕관)
//   + 가운데 은빛 아이콘 + 아래 이름판. 금속·에나멜·광택·그림자는 SVG 그라데이션과 필터로 그린다.
//   헤드리스 크롬으로 뜬다 — 필터(조명·그림자)와 글자 길이 맞춤이 브라우저에서 돼야 해서.
//
// 이전 레트로 인쇄물 스타일은 scripts/generate-badges-retro.mjs 에 있다.
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Icons from 'lucide-react';
import { chromium } from '@playwright/test';

// 트랙별 에나멜 색 — 진하고 채도 높은 색이어야 금테와 은빛 아이콘이 산다.
const ENAMEL = {
  onboarding: '#1d8f86',
  purchaser: '#d0232a',
  critic: '#254a8f',
  den: '#6f2fa3',
  hustler: '#e8621a',
  explorer: '#1c7ec4',
  diehard: '#3d8f2c',
  logistics: '#9c1f3f',
  party: '#d92d7a',
  grind: '#3a3f4a',
  arena: '#fa520f',
};

// [코드, 영문 이름, 트랙, 아이콘, 바탕, 장식]
//   바탕: circle | shield | diamond | hex | star     장식: none | rays | wings | laurel | gear | crown
//   장식은 업적의 뜻에 맞춘다 — 날개(이동·전파), 햇살(첫 성취·새벽), 월계수(평가·수료), 왕관(대회·영향력),
//   톱니(완성·작업), 별(눈·발견), 마름모(순간 포착), 육각(체크인·지점).
const BADGES = [
  ['profile_complete', 'Profile Complete', 'onboarding', 'UserCheck', 'circle', 'gear'],
  ['first_den_post', 'First Den Post', 'onboarding', 'MessageSquarePlus', 'circle', 'none'],
  ['first_review', 'First Review', 'onboarding', 'PenLine', 'diamond', 'none'],
  ['first_blood', 'First Blood', 'purchaser', 'Ticket', 'circle', 'rays'],
  ['frequent_flyer', 'Frequent Flyer', 'purchaser', 'Plane', 'circle', 'wings'],
  ['voice_of_the_people', 'Voice of the People', 'critic', 'Megaphone', 'circle', 'laurel'],
  ['top_critic', 'Top Critic', 'critic', 'ThumbsUp', 'shield', 'laurel'],
  ['conversation_starter', 'Conversation Starter', 'den', 'MessagesSquare', 'shield', 'none'],
  ['influencer', 'Influencer', 'den', 'Heart', 'circle', 'crown'],
  ['paparazzi', 'Paparazzi', 'hustler', 'Camera', 'diamond', 'none'],
  ['the_recruiter', 'The Recruiter', 'hustler', 'UserPlus', 'shield', 'none'],
  ['full_time_hustler', 'Full-Time Hustler', 'hustler', 'Rocket', 'circle', 'rays'],
  ['asia_circuit', 'Asia Circuit', 'explorer', 'Earth', 'circle', 'laurel'],
  ['early_bird', 'Early Bird', 'explorer', 'Bird', 'circle', 'wings'],
  ['weekly_checkin', 'Weekly Check-in', 'diehard', 'CalendarCheck', 'hex', 'none'],
  ['eagle_eye', 'Eagle Eye', 'diehard', 'ScanEye', 'star', 'none'],
  ['the_final_word', 'The Final Word', 'logistics', 'ClipboardCheck', 'circle', 'none'],
  ['oasis', 'Oasis', 'logistics', 'GlassWater', 'hex', 'none'],
  ['breakfast_club', 'The Breakfast Club', 'logistics', 'Coffee', 'diamond', 'none'],
  ['icebreaker', 'Icebreaker', 'party', 'Snowflake', 'star', 'none'],
  ['sunrise_survivor', 'Sunrise Survivor', 'party', 'Sunrise', 'circle', 'rays'],
  ['splash_zone', 'Splash Zone', 'party', 'Waves', 'diamond', 'none'],
  ['the_chameleon', 'The Chameleon', 'party', 'Shirt', 'shield', 'none'],
  ['workshop_warrior', 'Workshop Warrior', 'grind', 'Swords', 'circle', 'gear'],
  ['bootcamp_veteran', 'Bootcamp Veteran', 'grind', 'Medal', 'circle', 'laurel'],
  ['the_ambassador', 'The Ambassador', 'arena', 'Flag', 'circle', 'wings'],
  ['the_tracker', 'The Tracker', 'arena', 'Compass', 'hex', 'none'],
  ['thecontender', 'The Contender', 'arena', 'Trophy', 'shield', 'crown'],
];

// ── 색 도우미 ─────────────────────────────────────────────────────────────
const hex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/** t>0 흰색 쪽으로, t<0 검정 쪽으로 섞는다. */
function mix(h, t) {
  const to = t > 0 ? 255 : 0;
  const k = Math.abs(t);
  return '#' + rgb(h).map((c) => hex(c + (to - c) * k)).join('');
}

const CX = 256;
const CY = 232; // 뱃지 중심 — 아래에 이름판 자리를 남긴다
const R = 132; // 원형 바탕 반지름

// ── 도형 ──────────────────────────────────────────────────────────────────
const P = (x, y) => `${x.toFixed(1)},${y.toFixed(1)}`;

function polar(n, rOut, rIn, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI * i) / n + rot;
    const r = i % 2 ? rIn : rOut;
    pts.push(P(CX + r * Math.cos(a), CY + r * Math.sin(a)));
  }
  return pts.join(' ');
}

const shapes = {
  circle: (s = 1) => `<circle cx="${CX}" cy="${CY}" r="${R * s}"/>`,
  shield: (s = 1) => {
    const w = 140 * s, top = CY - 138 * s, mid = CY + 10 * s, bot = CY + 150 * s;
    return `<path d="M ${CX - w} ${top} L ${CX + w} ${top} L ${CX + w} ${mid} C ${CX + w} ${mid + 80 * s} ${CX + 50 * s} ${bot - 30 * s} ${CX} ${bot} C ${CX - 50 * s} ${bot - 30 * s} ${CX - w} ${mid + 80 * s} ${CX - w} ${mid} Z"/>`;
  },
  diamond: (s = 1) => {
    const r = 146 * s;
    return `<path d="M ${CX} ${CY - r} L ${CX + r} ${CY} L ${CX} ${CY + r} L ${CX - r} ${CY} Z" stroke-linejoin="round"/>`;
  },
  hex: (s = 1) => `<polygon points="${polar(3, 148 * s, 148 * s, -Math.PI / 2)}"/>`,
  star: (s = 1) => `<polygon points="${polar(5, 160 * s, 104 * s)}"/>`,
};
// 별·마름모는 뾰족해서 안쪽 에나멜을 조금 더 줄인다.
const INNER = { circle: 0.84, shield: 0.86, diamond: 0.82, hex: 0.84, star: 0.8 };

// ── 장식 ──────────────────────────────────────────────────────────────────
function rays(id) {
  // 길고 짧은 햇살을 번갈아 — 참고 세트의 100K 뱃지처럼 끝이 뾰족하다.
  let out = '';
  for (let i = 0; i < 36; i++) {
    const a = (Math.PI * 2 * i) / 36 - Math.PI / 2;
    const len = i % 2 ? 188 : 214;
    const w = i % 2 ? 0.05 : 0.065;
    const p1 = P(CX + 120 * Math.cos(a - w), CY + 120 * Math.sin(a - w));
    const p2 = P(CX + len * Math.cos(a), CY + len * Math.sin(a));
    const p3 = P(CX + 120 * Math.cos(a + w), CY + 120 * Math.sin(a + w));
    out += `<polygon points="${p1} ${p2} ${p3}" fill="url(#${i % 2 ? 'goldD' : 'gold'}-${id})"/>`;
  }
  return `<g filter="url(#bevel-${id})">${out}</g>`;
}

function wing(id, flip) {
  // 깃털 네 장이 겹친 날개. 오른쪽은 좌우 반전.
  const feathers = [
    'M 136 196 C 80 120, 30 112, 4 150 C 44 150, 84 176, 126 226 Z',
    'M 130 226 C 70 176, 20 184, 2 216 C 44 212, 90 232, 126 258 Z',
    'M 130 258 C 74 232, 30 252, 18 290 C 56 270, 100 272, 134 286 Z',
    'M 138 286 C 88 284, 58 312, 58 346 C 90 318, 120 308, 146 310 Z',
  ];
  const t = flip ? `translate(${CX * 2} 0) scale(-1 1)` : '';
  return `<g transform="${t}" filter="url(#bevel-${id})">${feathers
    .map((d, i) => `<path d="${d}" fill="url(#${i % 2 ? 'gold' : 'goldD'}-${id})" stroke="#7a4b05" stroke-width="1.5"/>`)
    .join('')}</g>`;
}

function laurel(id) {
  // 잎을 원 둘레 아래쪽 양옆에 심는다.
  let out = '';
  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const a = Math.PI / 2 + side * (0.25 + i * 0.19);
      const r = 158;
      const x = CX + r * Math.cos(a), y = CY + r * Math.sin(a);
      const deg = (a * 180) / Math.PI + side * 60;
      out += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="11" ry="26" transform="rotate(${deg.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="url(#${i % 2 ? 'gold' : 'goldD'}-${id})" stroke="#7a4b05" stroke-width="1.2"/>`;
    }
  }
  return `<g filter="url(#bevel-${id})">${out}</g>`;
}

function gear(id) {
  return `<g filter="url(#bevel-${id})"><polygon points="${polar(18, 176, 154, 0)}" fill="url(#silver-${id})" stroke="#5a6470" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="${CX}" cy="${CY}" r="150" fill="none" stroke="#6b7580" stroke-width="2"/></g>`;
}

function crown(id, y) {
  const b = y; // 왕관 밑선
  return `<g filter="url(#bevel-${id})">
    <path d="M ${CX - 74} ${b} L ${CX - 84} ${b - 62} L ${CX - 40} ${b - 26} L ${CX} ${b - 84} L ${CX + 40} ${b - 26} L ${CX + 84} ${b - 62} L ${CX + 74} ${b} Z" fill="url(#gold-${id})" stroke="#7a4b05" stroke-width="2" stroke-linejoin="round"/>
    <rect x="${CX - 78}" y="${b - 8}" width="156" height="16" rx="4" fill="url(#goldD-${id})" stroke="#7a4b05" stroke-width="1.5"/>
    ${gem(id, CX, b - 84, 9, '#e8262d')}${gem(id, CX - 84, b - 62, 7, '#2a8fd6')}${gem(id, CX + 84, b - 62, 7, '#2a8fd6')}
  </g>`;
}

function gem(id, x, y, r, color) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/><circle cx="${x}" cy="${y}" r="${r}" fill="url(#gemShine-${id})"/>`;
}

function sparkle(x, y, s, o = 1) {
  return `<path d="M ${x} ${y - s} Q ${x} ${y} ${x + s} ${y} Q ${x} ${y} ${x} ${y + s} Q ${x} ${y} ${x - s} ${y} Q ${x} ${y} ${x} ${y - s} Z" fill="#fff" opacity="${o}"/>`;
}

// ── 아이콘 ────────────────────────────────────────────────────────────────
function icon(name, size, cx, cy, color, stroke) {
  const C = Icons[name];
  if (!C) throw new Error(`아이콘 없음: ${name}`);
  return renderToStaticMarkup(createElement(C, { size, color, strokeWidth: stroke })).replace(
    '<svg ',
    `<svg x="${cx - size / 2}" y="${cy - size / 2}" `,
  );
}

/** 은빛 입체 아이콘 — 아래 그림자, 본체 은 그라데이션, 위 흰 하이라이트 세 겹. */
function metalIcon(id, name, cx, cy, size) {
  return `
  <g opacity=".5">${icon(name, size, cx, cy + 5, '#000', 2.6)}</g>
  ${icon(name, size, cx, cy, '#3c4650', 3)}
  ${icon(name, size, cx, cy, `url(#silver-${id})`, 2.2)}
  <g opacity=".55">${icon(name, size, cx, cy - 2, '#fff', 0.8)}</g>`;
}

// ── 이름판 ────────────────────────────────────────────────────────────────
function plaque(id, name, color) {
  const y = 392;
  return `
  <g filter="url(#shadow-${id})">
    <path d="M 66 ${y - 6} L 96 ${y - 20} L 96 ${y + 34} L 66 ${y + 48} L 80 ${y + 21} Z" fill="${mix(color, -0.35)}"/>
    <path d="M 446 ${y - 6} L 416 ${y - 20} L 416 ${y + 34} L 446 ${y + 48} L 432 ${y + 21} Z" fill="${mix(color, -0.35)}"/>
    <rect x="90" y="${y - 24}" width="332" height="62" rx="6" fill="url(#gold-${id})" filter="url(#bevel-${id})"/>
    <rect x="98" y="${y - 16}" width="316" height="46" rx="4" fill="url(#enamel-${id})"/>
    <rect x="98" y="${y - 16}" width="316" height="20" rx="4" fill="url(#gloss-${id})" opacity=".5"/>
  </g>
  <text class="name" data-max="290" x="${CX}" y="${y + 8}" text-anchor="middle" dominant-baseline="central">${name.toUpperCase()}</text>`;
}

// ── 뱃지 하나 ─────────────────────────────────────────────────────────────
function badgeSvg([code, name, track, iconName, base, deco]) {
  const id = code;
  const color = ENAMEL[track];
  const inner = INNER[base];
  const iconSize = base === 'star' ? 118 : base === 'diamond' ? 122 : 136;
  const iconY = base === 'shield' ? CY - 6 : CY;

  const defs = `
  <defs>
    <linearGradient id="gold-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff5c2"/><stop offset=".22" stop-color="#f7cf4f"/><stop offset=".48" stop-color="#c98b12"/>
      <stop offset=".62" stop-color="#f3d36f"/><stop offset=".85" stop-color="#b07407"/><stop offset="1" stop-color="#fbe58f"/>
    </linearGradient>
    <linearGradient id="goldD-${id}" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#d9a52c"/><stop offset=".4" stop-color="#8f5c08"/><stop offset=".7" stop-color="#e9bf49"/><stop offset="1" stop-color="#7a4b05"/>
    </linearGradient>
    <linearGradient id="silver-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".3" stop-color="#d7dde3"/><stop offset=".55" stop-color="#8f9aa6"/>
      <stop offset=".75" stop-color="#eef2f5"/><stop offset="1" stop-color="#7c8792"/>
    </linearGradient>
    <radialGradient id="enamel-${id}" cx=".38" cy=".28" r=".85">
      <stop offset="0" stop-color="${mix(color, 0.42)}"/><stop offset=".45" stop-color="${color}"/><stop offset="1" stop-color="${mix(color, -0.5)}"/>
    </radialGradient>
    <linearGradient id="gloss-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".62"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="gemShine-${id}" cx=".35" cy=".3" r=".8">
      <stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".45" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".45"/>
    </radialGradient>
    <!-- 금속 볼록함 — 왼쪽 위에서 오는 빛 -->
    <filter id="bevel-${id}" x="-20%" y="-20%" width="140%" height="140%" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceAlpha" stdDeviation="2.2" result="b"/>
      <feSpecularLighting in="b" surfaceScale="5" specularConstant="0.9" specularExponent="18" lighting-color="#fff" result="s">
        <fePointLight x="120" y="-60" z="260"/>
      </feSpecularLighting>
      <feComposite in="s" in2="SourceAlpha" operator="in" result="s2"/>
      <feComposite in="SourceGraphic" in2="s2" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/>
    </filter>
    <!-- 에나멜 안쪽 그림자 — 테두리 밑으로 꺼진 느낌 -->
    <filter id="inset-${id}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
      <feComponentTransfer in="SourceAlpha" result="inv"><feFuncA type="table" tableValues="1 0"/></feComponentTransfer>
      <feGaussianBlur in="inv" stdDeviation="7" result="bl"/>
      <feOffset in="bl" dx="0" dy="8" result="o"/>
      <feFlood flood-color="#000" flood-opacity=".6"/>
      <feComposite in2="o" operator="in" result="sh"/>
      <feComposite in="sh" in2="SourceAlpha" operator="in" result="sh2"/>
      <feComposite in="sh2" in2="SourceGraphic" operator="over"/>
    </filter>
    <filter id="shadow-${id}" x="-30%" y="-30%" width="160%" height="170%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="12" stdDeviation="9" flood-color="#000" flood-opacity=".45"/>
    </filter>
    <clipPath id="clipIn-${id}">${shapes[base](inner)}</clipPath>
  </defs>`;

  // 바탕 뒤에 깔리는 장식
  const behind =
    deco === 'rays' ? rays(id)
    : deco === 'wings' ? wing(id, false) + wing(id, true)
    : deco === 'gear' ? gear(id)
    : deco === 'laurel' ? laurel(id)
    : '';
  const top = deco === 'crown' ? crown(id, base === 'shield' ? CY - 136 : CY - R - 4) : '';

  // 바탕: 바깥 금테 → 어두운 홈 → 안쪽 금테 → 에나멜 → 광택
  const body = `
  <g filter="url(#bevel-${id})">
    <g fill="url(#gold-${id})" stroke="#7a4b05" stroke-width="2">${shapes[base](1)}</g>
  </g>
  <g fill="#5a3a06" opacity=".9">${shapes[base](inner + 0.05)}</g>
  <g fill="url(#goldD-${id})">${shapes[base](inner + 0.03)}</g>
  <g fill="url(#enamel-${id})" filter="url(#inset-${id})">${shapes[base](inner)}</g>
  <g clip-path="url(#clipIn-${id})">
    <ellipse cx="${CX}" cy="${CY - R * 0.5}" rx="${R * 0.82}" ry="${R * 0.46}" fill="url(#gloss-${id})"/>
  </g>
  ${base === 'circle' ? `<circle cx="${CX}" cy="${CY}" r="${R * inner - 6}" fill="none" stroke="#fff" stroke-width="1.5" opacity=".35" stroke-dasharray="3 9"/>` : ''}`;

  // 테두리에 박힌 작은 보석(원형만)
  let studs = '';
  if (base === 'circle' && deco !== 'gear') {
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 * i) / 12;
      studs += `<circle cx="${(CX + (R - 10) * Math.cos(a)).toFixed(1)}" cy="${(CY + (R - 10) * Math.sin(a)).toFixed(1)}" r="4.5" fill="url(#silver-${id})" stroke="#5a3a06" stroke-width=".8"/>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" data-code="${code}">
  ${defs}
  <ellipse cx="${CX}" cy="466" rx="150" ry="12" fill="#000" opacity=".22"/>
  <g filter="url(#shadow-${id})">
    ${behind}
    ${body}
    ${studs}
    ${top}
    ${metalIcon(id, iconName, CX, iconY, iconSize)}
    ${sparkle(CX - R * 0.62, CY - R * 0.62, 12)}${sparkle(CX + R * 0.5, CY - R * 0.74, 8, 0.9)}${sparkle(CX + R * 0.74, CY + R * 0.3, 6, 0.7)}
  </g>
  ${plaque(id, name, color)}
</svg>`;
}

// ── 실행 ──────────────────────────────────────────────────────────────────
const [outArg, ...only] = process.argv.slice(2);
if (!outArg) {
  console.error('사용: node scripts/generate-badges.mjs <출력 폴더> [업적코드 ...]');
  process.exit(1);
}
const out = resolve(outArg);
mkdirSync(out, { recursive: true });
const list = BADGES.filter((b) => !only.length || only.includes(b[0]));

const html = `<!doctype html><html><head>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@700&display=block" rel="stylesheet">
<style>
  body { margin: 0; background: transparent; display: flex; flex-wrap: wrap; width: ${512 * 7}px; }
  svg { display: block; }
  .name { font-family: 'Oswald', Arial, sans-serif; font-weight: 700; font-size: 30px; letter-spacing: 2px;
          fill: #fff; stroke: #2a1a05; stroke-width: 4px; paint-order: stroke; }
</style></head><body>${list.map(badgeSvg).join('')}</body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 512 * 7, height: 512 } });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  // 긴 이름은 이름판에 들어갈 때까지 글자를 줄인다.
  await page.evaluate(() => {
    for (const t of document.querySelectorAll('text[data-max]')) {
      const max = Number(t.dataset.max);
      let size = parseFloat(getComputedStyle(t).fontSize);
      while (t.getComputedTextLength() > max && size > 14) {
        size -= 1;
        t.style.fontSize = `${size}px`;
      }
    }
  });
  for (const svg of await page.$$('svg[data-code]')) {
    const code = await svg.getAttribute('data-code');
    await svg.screenshot({ path: join(out, `${code}.png`), omitBackground: true });
    console.log('✓', code);
  }
  await page.setViewportSize({ width: 512 * 7, height: 512 * Math.ceil(list.length / 7) });
  await page.addStyleTag({ content: 'body { background: linear-gradient(#4a4f63, #2c2f3d) }' });
  await page.screenshot({ path: join(out, '_sheet.png'), fullPage: true });
} finally {
  await browser.close();
}
