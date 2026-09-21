// 업적 뱃지 생성기 — 레트로 뱃지 7가지 틀(원형 띠 · 물결 씰 · 선 엠블럼 · 로제트 · 방패 · 우표 · 리본).
//
// 사용: node scripts/generate-badges.mjs <출력 폴더> [업적코드 ...]
//   코드를 안 주면 아래 BADGES 전부. 결과는 <코드>.png (512×512, 투명 배경) + _sheet.png(한눈에 보기).
//   올리기: node packages/supabase/upload_badge.mjs <코드> <출력 폴더>/<코드>.png
//
// 그리는 곳은 헤드리스 크롬이다 — 글자 길이를 브라우저가 재서 자리에 맞춘다(data-max).
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Icons from 'lucide-react';
import { chromium } from '@playwright/test';

// 트랙별 색 — [띠, 안쪽 원, 메달, 리본]. 빈티지 톤으로 트랙마다 다르게.
const PALETTE = {
  onboarding: ['#2f7f7a', '#f2c14e', '#e0692a', '#1f5a56'],
  purchaser: ['#c8372d', '#f2b632', '#2b2b2b', '#7d1f18'],
  critic: ['#243b55', '#f3d9a4', '#d9534f', '#16263a'],
  den: ['#5b3a73', '#f2c14e', '#8a4f9e', '#3b2550'],
  hustler: ['#e0692a', '#f6e3b4', '#2f7f7a', '#2b2b2b'],
  explorer: ['#2c6e9b', '#f3d9a4', '#e0692a', '#1c4a6b'],
  diehard: ['#5f7f34', '#f6e3b4', '#c8372d', '#3f5a20'],
  logistics: ['#a8452f', '#f3d9a4', '#2c6e9b', '#6e2a1b'],
  party: ['#c2376b', '#f7cf4a', '#5b3a73', '#2b2b2b'],
  grind: ['#3a3a3a', '#f2b632', '#c8372d', '#1f1f1f'],
  arena: ['#fa520f', '#fbe3b0', '#2b2b2b', '#a8340a'],
};

const TRACK_EN = {
  onboarding: 'START',
  purchaser: 'PURCHASE',
  critic: 'REVIEW',
  den: 'THE DEN',
  hustler: 'PROMOTION',
  explorer: 'TRAVEL',
  diehard: 'LOYALTY',
  logistics: 'ON-SITE',
  party: 'SOCIAL',
  grind: 'WORKSHOP',
  arena: 'COMPETITION',
};

// [코드, 영문 이름, 트랙, 번호, 아이콘, (틀)] — 틀을 비우면 ORDER 순서로 돌린다
const BADGES = [
  ['profile_complete', 'Profile Complete', 'onboarding', 102, 'UserCheck'],
  ['first_den_post', 'First Den Post', 'onboarding', 103, 'MessageSquarePlus'],
  ['first_review', 'First Review', 'onboarding', 104, 'PenLine'],
  ['first_blood', 'First Blood', 'purchaser', 201, 'Ticket'],
  ['frequent_flyer', 'Frequent Flyer', 'purchaser', 202, 'Plane'],
  ['voice_of_the_people', 'Voice of the People', 'critic', 301, 'Megaphone'],
  ['top_critic', 'Top Critic', 'critic', 302, 'ThumbsUp'],
  ['conversation_starter', 'Conversation Starter', 'den', 401, 'MessagesSquare'],
  ['influencer', 'Influencer', 'den', 402, 'Heart'],
  ['paparazzi', 'Paparazzi', 'hustler', 501, 'Camera'],
  ['the_recruiter', 'The Recruiter', 'hustler', 502, 'UserPlus'],
  ['full_time_hustler', 'Full-Time Hustler', 'hustler', 503, 'Rocket'],
  ['asia_circuit', 'Asia Circuit', 'explorer', 601, 'Earth'],
  ['early_bird', 'Early Bird', 'explorer', 602, 'Bird'],
  ['weekly_checkin', 'Weekly Check-in', 'diehard', 701, 'CalendarCheck'],
  ['eagle_eye', 'Eagle Eye', 'diehard', 702, 'ScanEye'],
  ['the_final_word', 'The Final Word', 'logistics', 802, 'ClipboardCheck'],
  ['oasis', 'Oasis', 'logistics', 803, 'GlassWater'],
  ['breakfast_club', 'The Breakfast Club', 'logistics', 804, 'Coffee'],
  ['icebreaker', 'Icebreaker', 'party', 901, 'Snowflake'],
  ['sunrise_survivor', 'Sunrise Survivor', 'party', 902, 'Sunrise'],
  ['splash_zone', 'Splash Zone', 'party', 903, 'Waves'],
  ['the_chameleon', 'The Chameleon', 'party', 904, 'Shirt'],
  ['workshop_warrior', 'Workshop Warrior', 'grind', 1001, 'Swords'],
  ['bootcamp_veteran', 'Bootcamp Veteran', 'grind', 1002, 'Medal'],
  ['the_ambassador', 'The Ambassador', 'arena', 1102, 'Flag'],
  ['the_tracker', 'The Tracker', 'arena', 1103, 'Compass'],
  ['thecontender', 'The Contender', 'arena', 1104, 'Trophy'],
];

const INK = '#231f1c';
const CREAM = '#fbf1dc';

/** lucide 아이콘을 (cx, cy) 가운데에 size 크기로. */
function icon(name, color, size = 128, cx = 256, cy = 256, stroke = 1.9) {
  const C = Icons[name];
  if (!C) throw new Error(`아이콘 없음: ${name}`);
  return renderToStaticMarkup(createElement(C, { size, color, strokeWidth: stroke })).replace(
    '<svg ',
    `<svg x="${cx - size / 2}" y="${cy - size / 2}" `,
  );
}

const star = (cx, cy, r, fill) => {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}"/>`;
};

/** 둘레가 rIn~rOut 사이를 n 번 오가는 닫힌 도형. smooth 면 물결, 아니면 톱니·햇살. */
function radial(n, rOut, rIn, smooth = false) {
  const steps = smooth ? n * 12 : n * 2;
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const a = (Math.PI * 2 * i) / steps - Math.PI / 2;
    const r = smooth
      ? (rOut + rIn) / 2 + ((rOut - rIn) / 2) * Math.cos(n * (a + Math.PI / 2))
      : i % 2
        ? rIn
        : rOut;
    pts.push(`${(256 + r * Math.cos(a)).toFixed(1)},${(256 + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

/** 위(시계 방향) · 아래(반시계 방향) 반원 — 곡선 글자용. */
const arcs = (id, rTop, rBot) => `
    <path id="t-${id}" d="M ${256 - rTop} 256 A ${rTop} ${rTop} 0 0 1 ${256 + rTop} 256"/>
    <path id="b-${id}" d="M ${256 - rBot} 256 A ${rBot} ${rBot} 0 0 0 ${256 + rBot} 256"/>`;

const arcText = (id, which, text, fill, cls, max) =>
  `<text class="${cls}" data-max="${max}" fill="${fill}" text-anchor="middle"${
    which === 'b' ? ' dominant-baseline="hanging"' : ''
  }><textPath href="#${which}-${id}" startOffset="50%">${text}</textPath></text>`;

/** 인쇄물 같은 결 — clip 도형 안에만. */
const grain = (id, seed, clip) => `
  <defs>
    <filter id="g-${id}" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${seed}"/>
      <feColorMatrix values="0 0 0 0 0.14  0 0 0 0 0.12  0 0 0 0 0.1  0 0 0 0.16 0"/>
      <feComposite in2="SourceGraphic" operator="in"/>
    </filter>
    <clipPath id="c-${id}">${clip}</clipPath>
  </defs>
  <rect width="512" height="512" filter="url(#g-${id})" clip-path="url(#c-${id})"/>`;

const tail = (d, fill) =>
  `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;

// ── 틀 7가지 ─────────────────────────────────────────────────────────────
// 모두 b = { code, name, no, icon, band, inner, medal, ribbon, trackEn } 를 받아 SVG 본문을 돌려준다.

/** 1. 원형 띠 + 가로 리본 (참고 시트의 SECURITAS) */
function tRing(b) {
  const noSize = String(b.no).length > 3 ? 21 : 26;
  return `
  <defs>${arcs(b.code, 191, 187)}</defs>
  <circle cx="256" cy="256" r="246" fill="${INK}"/>
  <circle cx="256" cy="256" r="238" fill="${b.band}"/>
  <circle cx="256" cy="256" r="231" fill="none" stroke="${CREAM}" stroke-width="2.5" stroke-dasharray="2 7" stroke-linecap="round"/>
  <circle cx="256" cy="256" r="172" fill="${CREAM}"/>
  <circle cx="256" cy="256" r="165" fill="${b.inner}" stroke="${INK}" stroke-width="4"/>
  ${arcText(b.code, 't', b.name.toUpperCase(), CREAM, 'slab', 470)}
  ${arcText(b.code, 'b', `123Band ✦ ${b.trackEn}`, CREAM, 'cond', 400)}
  ${tail('M 40 226 L 118 226 L 118 286 L 40 286 L 58 256 Z', b.ribbon)}
  ${tail('M 472 226 L 394 226 L 394 286 L 472 286 L 454 256 Z', b.ribbon)}
  <rect x="92" y="220" width="328" height="72" fill="${b.band}" stroke="${INK}" stroke-width="4"/>
  <text class="slab" x="124" y="258" font-size="26" fill="${CREAM}" text-anchor="middle" dominant-baseline="central">No.</text>
  <text class="slab" x="390" y="258" style="font-size:${noSize}px" fill="${CREAM}" text-anchor="middle" dominant-baseline="central">${b.no}</text>
  <circle cx="256" cy="256" r="104" fill="${INK}"/>
  <circle cx="256" cy="256" r="97" fill="${b.medal}"/>
  <circle cx="256" cy="256" r="88" fill="none" stroke="${CREAM}" stroke-width="3"/>
  ${icon(b.icon, CREAM)}
  ${star(256, 136, 7, INK)}
  ${grain(b.code, b.no, '<circle cx="256" cy="256" r="246"/>')}`;
}

/** 2. 물결 테두리 씰 + 아래로 휜 배너 (OMNIS · SLIX) */
function tSeal(b) {
  const edge = radial(20, 248, 230, true);
  return `
  <defs>
    ${arcs(b.code, 146, 146)}
    <path id="w-${b.code}" d="M 70 358 Q 256 414 442 358"/>
  </defs>
  <polygon points="${edge}" fill="${INK}"/>
  <polygon points="${radial(20, 240, 222, true)}" fill="${b.band}"/>
  <circle cx="256" cy="256" r="196" fill="${CREAM}" stroke="${INK}" stroke-width="4"/>
  <circle cx="256" cy="256" r="184" fill="${b.inner}"/>
  <circle cx="256" cy="256" r="176" fill="none" stroke="${INK}" stroke-width="1.5" stroke-dasharray="3 6" opacity=".6"/>
  ${arcText(b.code, 't', b.name.toUpperCase(), INK, 'slab', 380)}
  ${star(128, 250, 8, INK)}${star(384, 250, 8, INK)}
  <circle cx="256" cy="236" r="74" fill="${b.medal}" stroke="${INK}" stroke-width="4"/>
  ${icon(b.icon, CREAM, 92, 256, 236, 2)}
  ${tail('M 30 344 L 80 338 L 80 392 L 30 398 L 48 371 Z', b.ribbon)}
  ${tail('M 482 344 L 432 338 L 432 392 L 482 398 L 464 371 Z', b.ribbon)}
  <path d="M 62 328 Q 256 386 450 328 L 450 384 Q 256 442 62 384 Z" fill="${b.band}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
  <text class="cond" data-max="320" style="font-size:26px" fill="${CREAM}" text-anchor="middle" dominant-baseline="central"><textPath href="#w-${b.code}" startOffset="50%">123Band ✦ No.${b.no}</textPath></text>
  ${grain(b.code, b.no, `<polygon points="${edge}"/>`)}`;
}

/** 3. 가는 선 엠블럼 — 크림 바탕, 큰 아이콘 (SANDERS · JOHN SHERMAN) */
function tLine(b) {
  const noSize = String(b.no).length > 3 ? 22 : 26;
  return `
  <defs>${arcs(b.code, 196, 194)}</defs>
  <circle cx="256" cy="256" r="246" fill="${CREAM}" stroke="${INK}" stroke-width="6"/>
  <circle cx="256" cy="256" r="232" fill="none" stroke="${b.band}" stroke-width="3"/>
  ${arcText(b.code, 't', b.name.toUpperCase(), b.band, 'slab', 460)}
  ${arcText(b.code, 'b', `123Band ✦ ${b.trackEn}`, INK, 'cond', 380)}
  ${star(46, 256, 9, b.medal)}${star(466, 256, 9, b.medal)}
  <circle cx="256" cy="256" r="168" fill="${b.inner}" stroke="${INK}" stroke-width="5"/>
  <circle cx="256" cy="256" r="156" fill="none" stroke="${b.band}" stroke-width="2"/>
  ${icon(b.icon, b.band, 150, 256, 230, 1.7)}
  <path d="M 150 322 L 362 322 L 378 356 L 362 390 L 150 390 L 134 356 Z" fill="${b.medal}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
  <text class="slab" x="256" y="357" style="font-size:${noSize}px" fill="${CREAM}" text-anchor="middle" dominant-baseline="central">No. ${b.no}</text>
  ${grain(b.code, b.no, '<circle cx="256" cy="256" r="246"/>')}`;
}

/** 로제트 안쪽의 가는 햇살 줄 */
function rays(color) {
  let out = '';
  for (let i = 0; i < 24; i++) {
    const a = (Math.PI * 2 * i) / 24;
    const p = (r) => `${(256 + r * Math.cos(a)).toFixed(1)}`;
    const q = (r) => `${(256 + r * Math.sin(a)).toFixed(1)}`;
    out += `<line x1="${p(80)}" y1="${q(80)}" x2="${p(114)}" y2="${q(114)}" stroke="${color}" stroke-width="${i % 2 ? 2 : 4}" stroke-linecap="round"/>`;
  }
  return out;
}

/** 4. 로제트 — 뾰족한 햇살 테두리 (BIRA) */
function tRosette(b) {
  const edge = radial(32, 250, 222);
  return `
  <defs>${arcs(b.code, 166, 162)}</defs>
  <polygon points="${edge}" fill="${INK}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
  <polygon points="${radial(32, 241, 219)}" fill="${b.medal}"/>
  <circle cx="256" cy="256" r="206" fill="${INK}"/>
  <circle cx="256" cy="256" r="200" fill="${b.band}"/>
  <circle cx="256" cy="256" r="190" fill="none" stroke="${CREAM}" stroke-width="2.5" stroke-dasharray="1 7" stroke-linecap="round"/>
  ${arcText(b.code, 't', b.name.toUpperCase(), CREAM, 'slab', 400)}
  ${arcText(b.code, 'b', `123Band ✦ No.${b.no}`, CREAM, 'cond', 330)}
  ${star(82, 256, 9, CREAM)}${star(430, 256, 9, CREAM)}
  <circle cx="256" cy="256" r="126" fill="${b.inner}" stroke="${INK}" stroke-width="5"/>
  ${rays(b.band)}
  <circle cx="256" cy="256" r="72" fill="${CREAM}" stroke="${INK}" stroke-width="3"/>
  ${icon(b.icon, INK, 92, 256, 256, 2.1)}
  ${grain(b.code, b.no, `<polygon points="${edge}"/>`)}`;
}

/** 5. 방패 크레스트 + 이름 리본 */
function tShield(b) {
  const shield = 'M 256 24 L 444 84 L 444 250 C 444 380 350 448 256 490 C 162 448 68 380 68 250 L 68 84 Z';
  const inner = 'M 256 46 L 424 100 L 424 250 C 424 366 340 428 256 466 C 172 428 88 366 88 250 L 88 100 Z';
  return `
  <path d="${shield}" fill="${INK}"/>
  <path d="${shield}" transform="translate(256 257) scale(.97) translate(-256 -257)" fill="${b.band}"/>
  <path d="${inner}" fill="none" stroke="${CREAM}" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round"/>
  <circle cx="256" cy="268" r="100" fill="${INK}"/>
  <circle cx="256" cy="268" r="93" fill="${b.inner}"/>
  <circle cx="256" cy="268" r="80" fill="${b.medal}"/>
  ${icon(b.icon, CREAM, 96, 256, 268, 2)}
  ${star(128, 268, 10, CREAM)}${star(384, 268, 10, CREAM)}
  ${tail('M 10 120 L 64 112 L 64 172 L 10 180 L 30 148 Z', b.ribbon)}
  ${tail('M 502 120 L 448 112 L 448 172 L 502 180 L 482 148 Z', b.ribbon)}
  <rect x="40" y="106" width="432" height="62" fill="${b.medal}" stroke="${INK}" stroke-width="5"/>
  <text class="slab" data-max="380" x="256" y="138" style="font-size:32px" fill="${CREAM}" text-anchor="middle" dominant-baseline="central">${b.name.toUpperCase()}</text>
  <text class="cond" x="256" y="80" style="font-size:22px;letter-spacing:8px" fill="${CREAM}" text-anchor="middle">123Band</text>
  <text class="slab" x="256" y="404" style="font-size:24px" fill="${CREAM}" text-anchor="middle">No.${b.no}</text>
  <text class="cond" data-max="150" x="256" y="434" style="font-size:17px;letter-spacing:3px" fill="${CREAM}" text-anchor="middle">${b.trackEn}</text>
  ${grain(b.code, b.no, `<path d="${shield}"/>`)}`;
}

/** 6. 우표 스탬프 — 톱니 테두리, 점선 링, 비스듬한 소인 (ROXY) */
function tStamp(b) {
  const edge = radial(40, 248, 228);
  return `
  <defs>${arcs(b.code, 150, 150)}</defs>
  <polygon points="${edge}" fill="${b.band}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
  <circle cx="256" cy="256" r="210" fill="${CREAM}"/>
  <circle cx="256" cy="256" r="198" fill="none" stroke="${b.band}" stroke-width="3" stroke-dasharray="10 6"/>
  <circle cx="256" cy="256" r="186" fill="none" stroke="${b.band}" stroke-width="1.5"/>
  ${arcText(b.code, 't', b.name.toUpperCase(), b.band, 'slab', 360)}
  ${arcText(b.code, 'b', `No.${b.no} ✦ 123Band`, INK, 'cond', 300)}
  <line x1="94" y1="256" x2="150" y2="256" stroke="${INK}" stroke-width="3"/>
  <line x1="362" y1="256" x2="418" y2="256" stroke="${INK}" stroke-width="3"/>
  <circle cx="86" cy="256" r="5" fill="${b.medal}"/><circle cx="426" cy="256" r="5" fill="${b.medal}"/>
  <circle cx="256" cy="256" r="98" fill="${b.medal}" stroke="${INK}" stroke-width="4"/>
  <circle cx="256" cy="256" r="86" fill="none" stroke="${CREAM}" stroke-width="2" stroke-dasharray="4 5"/>
  ${icon(b.icon, CREAM, 112, 256, 256, 2)}
  <g transform="rotate(-16 380 330)" opacity=".6">
    <rect x="300" y="308" width="160" height="44" rx="6" fill="none" stroke="${b.band}" stroke-width="3"/>
    <text class="cond" data-max="140" x="380" y="331" style="font-size:20px;letter-spacing:3px" fill="${b.band}" text-anchor="middle" dominant-baseline="central">${b.trackEn}</text>
  </g>
  ${grain(b.code, b.no, `<polygon points="${edge}"/>`)}`;
}

/** 7. 작은 메달 + 크게 가로지르는 물결 리본 (ALFREDO) */
function tBanner(b) {
  return `
  <defs>
    <path id="w-${b.code}" d="M 60 300 C 170 262, 342 338, 452 300"/>
  </defs>
  <circle cx="256" cy="206" r="166" fill="${INK}"/>
  <circle cx="256" cy="206" r="158" fill="${b.band}"/>
  <circle cx="256" cy="206" r="144" fill="none" stroke="${CREAM}" stroke-width="3"/>
  <circle cx="256" cy="206" r="134" fill="none" stroke="${CREAM}" stroke-width="1.5" stroke-dasharray="2 6"/>
  ${icon(b.icon, CREAM, 112, 256, 176, 2)}
  ${star(196, 88, 8, CREAM)}${star(256, 76, 11, CREAM)}${star(316, 88, 8, CREAM)}
  ${tail('M 12 320 L 70 302 L 76 362 L 20 378 L 42 346 Z', b.ribbon)}
  ${tail('M 500 320 L 442 302 L 436 362 L 492 378 L 470 346 Z', b.ribbon)}
  <path d="M 44 262 C 160 222, 352 302, 468 262 L 468 338 C 352 378, 160 298, 44 338 Z" fill="${b.medal}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M 58 273 C 166 236, 346 313, 454 273" fill="none" stroke="${CREAM}" stroke-width="2" opacity=".7"/>
  <path d="M 58 327 C 166 290, 346 367, 454 327" fill="none" stroke="${CREAM}" stroke-width="2" opacity=".7"/>
  <text class="slab" data-max="360" style="font-size:36px" fill="${CREAM}" text-anchor="middle" dominant-baseline="central"><textPath href="#w-${b.code}" startOffset="50%">${b.name.toUpperCase()}</textPath></text>
  <rect x="150" y="396" width="212" height="40" rx="4" fill="${INK}"/>
  <text class="cond" data-max="190" x="256" y="417" style="font-size:20px;letter-spacing:3px" fill="${CREAM}" text-anchor="middle" dominant-baseline="central">No.${b.no} ✦ ${b.trackEn}</text>
  <text class="cond" x="256" y="474" style="font-size:24px;letter-spacing:12px" fill="${INK}" text-anchor="middle">123Band</text>`;
}

const TEMPLATES = {
  ring: tRing,
  seal: tSeal,
  line: tLine,
  rosette: tRosette,
  shield: tShield,
  stamp: tStamp,
  banner: tBanner,
};
// 옆 칸끼리 모양이 겹치지 않게 돌려 쓴다. BADGES 에 6번째 값으로 틀을 적으면 그게 우선.
const ORDER = ['ring', 'seal', 'line', 'rosette', 'shield', 'stamp', 'banner'];

function badgeSvg([code, name, track, no, iconName, tpl], i) {
  const [band, inner, medal, ribbon] = PALETTE[track];
  const kind = tpl ?? ORDER[i % ORDER.length];
  const body = TEMPLATES[kind]({
    code,
    name,
    no,
    icon: iconName,
    band,
    inner,
    medal,
    ribbon,
    trackEn: TRACK_EN[track],
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" data-code="${code}" data-kind="${kind}">${body}</svg>`;
}

const [outArg, ...only] = process.argv.slice(2);
if (!outArg) {
  console.error('사용: node scripts/generate-badges.mjs <출력 폴더> [업적코드 ...]');
  process.exit(1);
}
const out = resolve(outArg);
mkdirSync(out, { recursive: true });
// 틀 순서는 전체 목록 기준으로 정한다 — 일부만 다시 만들어도 모양이 바뀌지 않게.
const list = BADGES.map((b, i) => [b, i]).filter(([b]) => !only.length || only.includes(b[0]));

const html = `<!doctype html><html><head>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Alfa+Slab+One&family=Oswald:wght@600&display=block" rel="stylesheet">
<style>
  body { margin: 0; background: transparent; display: flex; flex-wrap: wrap; width: ${512 * 7}px; }
  svg { display: block; }
  .slab { font-family: 'Alfa Slab One', Georgia, serif; letter-spacing: 2px; font-size: 34px; }
  .cond { font-family: 'Oswald', Arial, sans-serif; font-weight: 600; letter-spacing: 4px; font-size: 24px; }
</style></head><body>${list.map(([b, i]) => badgeSvg(b, i)).join('')}</body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 512 * 7, height: 512 } });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  // data-max 가 붙은 글자는 그 길이 안에 들어갈 때까지 줄인다(긴 이름 대비).
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
    console.log('✓', code, await svg.getAttribute('data-kind'));
  }
  await page.setViewportSize({ width: 512 * 7, height: 512 * Math.ceil(list.length / 7) });
  await page.addStyleTag({ content: 'body { background: #efe6d2 }' });
  await page.screenshot({ path: join(out, '_sheet.png'), fullPage: true });
} finally {
  await browser.close();
}
