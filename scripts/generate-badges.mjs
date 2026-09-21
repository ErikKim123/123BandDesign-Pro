// 업적 뱃지 생성기 — 스티커 스타일에 입체감(두께 · 빛 받는 윗면 · 광택 · 돌출 픽토그램)을 더한 것.
//
// 사용: node scripts/generate-badges.mjs <출력 폴더> [업적코드 ...]
//   코드를 안 주면 아래 BADGES 전부. 결과는 <코드>.png (512×512, 투명 배경) + _sheet.png(한눈에 보기).
//   올리기: node packages/supabase/upload_badge.mjs <코드> <출력 폴더>/<코드>.png
//
// 만드는 법: 각 뱃지 = 흰 스티커 테두리 + 단색 바탕(방패 · 원 · 아치 · 육각 · 둥근 방패) + 위쪽 별 +
//   가운데 픽토그램(사람·동물·행동) + 아래를 가로지르는 물결 리본(트랙 · 이름).
//   입체감: 모든 층을 아래로 밀린 어두운 '두께' 층 위에 얹고, 바탕은 빛을 받는 그라데이션 + 위쪽 유리 광택,
//   테두리·리본은 조명 필터로 볼록하게, 픽토그램은 여러 겹 밀어 돌출시킨다.
//   헤드리스 크롬으로 뜬다 — 리본 곡선 글자 길이 맞춤이 브라우저에서 돼야 해서.
//
// 다른 스타일: generate-badges-retro.mjs(인쇄물 레트로), generate-badges-3d.mjs(게임 뱃지 3D 느낌).
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Icons from 'lucide-react';
import { chromium } from '@playwright/test';

// 참고 이미지의 따뜻한 팔레트 — [바탕, 리본]. 바탕과 리본은 늘 대비되는 색.
const PALETTE = {
  onboarding: ['#1f8f86', '#f39c2b'],
  purchaser: ['#c9294a', '#f2b134'],
  critic: ['#2f6fb5', '#f39c2b'],
  den: ['#6b3a9c', '#2aa198'],
  hustler: ['#f39c2b', '#c9294a'],
  explorer: ['#2aa198', '#6b3a9c'],
  diehard: ['#5c9e3a', '#e8b33a'],
  logistics: ['#e8b33a', '#c9294a'],
  party: ['#e2456f', '#2aa198'],
  grind: ['#3d4a5c', '#f39c2b'],
  arena: ['#fa520f', '#1f8f86'],
};

const TRACK_EN = {
  onboarding: 'GETTING STARTED',
  purchaser: 'FESTIVAL PASS',
  critic: 'REVIEWS',
  den: 'THE DEN',
  hustler: 'PROMOTION',
  explorer: 'TRAVEL',
  diehard: 'LOYALTY',
  logistics: 'ON-SITE',
  party: 'SOCIAL',
  grind: 'WORKSHOP',
  arena: 'COMPETITION',
};

// [코드, 영문 이름, 트랙, 픽토그램, 바탕]  바탕: shield | circle | arch | hex | round
//   픽토그램은 사람·동물·행동 위주(악수 · 발자국 · 파티 폭죽 · 덤벨 · 사람들 · 새 · 말하기).
const BADGES = [
  ['newsletter_subscribe', 'Newsletter Subscriber', 'onboarding', 'MailOpen', 'round'],
  ['first_contact', 'First Contact', 'logistics', 'QrCode', 'shield'],
  ['audience_judge', 'Audience Judge', 'arena', 'Gavel', 'hex'],
  ['profile_complete', 'Profile Complete', 'onboarding', 'UserRoundCheck', 'shield'],
  ['first_den_post', 'First Den Post', 'onboarding', 'Speech', 'circle'],
  ['first_review', 'First Review', 'onboarding', 'PencilLine', 'arch'],
  ['first_blood', 'First Blood', 'purchaser', 'Ticket', 'round'],
  ['frequent_flyer', 'Frequent Flyer', 'purchaser', 'Plane', 'hex'],
  ['voice_of_the_people', 'Voice of the People', 'critic', 'Megaphone', 'shield'],
  ['top_critic', 'Top Critic', 'critic', 'Award', 'circle'],
  ['conversation_starter', 'Conversation Starter', 'den', 'MessagesSquare', 'arch'],
  ['influencer', 'Influencer', 'den', 'HeartHandshake', 'round'],
  ['paparazzi', 'Paparazzi', 'hustler', 'Camera', 'hex'],
  ['the_recruiter', 'The Recruiter', 'hustler', 'Handshake', 'shield'],
  ['full_time_hustler', 'Full-Time Hustler', 'hustler', 'Rocket', 'circle'],
  ['asia_circuit', 'Asia Circuit', 'explorer', 'Earth', 'arch'],
  ['early_bird', 'Early Bird', 'explorer', 'Bird', 'round'],
  ['weekly_checkin', 'Weekly Check-in', 'diehard', 'Footprints', 'hex'],
  ['eagle_eye', 'Eagle Eye', 'diehard', 'ScanEye', 'shield'],
  ['the_final_word', 'The Final Word', 'logistics', 'ClipboardCheck', 'circle'],
  ['oasis', 'Oasis', 'logistics', 'GlassWater', 'arch'],
  ['breakfast_club', 'The Breakfast Club', 'logistics', 'Croissant', 'round'],
  ['icebreaker', 'Icebreaker', 'party', 'PartyPopper', 'hex'],
  ['sunrise_survivor', 'Sunrise Survivor', 'party', 'Sunrise', 'shield'],
  ['splash_zone', 'Splash Zone', 'party', 'Waves', 'circle'],
  ['the_chameleon', 'The Chameleon', 'party', 'Shirt', 'arch'],
  ['workshop_warrior', 'Workshop Warrior', 'grind', 'Dumbbell', 'round'],
  ['bootcamp_veteran', 'Bootcamp Veteran', 'grind', 'Medal', 'hex'],
  ['the_ambassador', 'The Ambassador', 'arena', 'Users', 'shield'],
  ['the_tracker', 'The Tracker', 'arena', 'Compass', 'circle'],
  ['thecontender', 'The Contender', 'arena', 'Trophy', 'arch'],
];

const CREAM = '#fff6e6';
const INK = '#2b2530';

const hexc = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function mix(h, t) {
  const to = t > 0 ? 255 : 0;
  const k = Math.abs(t);
  return '#' + rgb(h).map((c) => hexc(c + (to - c) * k)).join('');
}

const CX = 256;
const CY = 222; // 바탕 중심 — 리본이 아래를 가로지른다

// ── 바탕 도형(경로 문자열만) ─────────────────────────────────────────────
const SHAPES = {
  shield: `M ${CX} 60 L 392 92 L 392 232 C 392 322 318 372 ${CX} 400 C 194 372 120 322 120 232 L 120 92 Z`,
  circle: `M ${CX} 62 A 160 160 0 1 1 ${CX - 0.01} 62 Z`,
  arch: `M 108 200 A 148 148 0 0 1 404 200 L 404 372 Q 404 400 376 400 L 136 400 Q 108 400 108 372 Z`,
  hex: `M ${CX} 58 L 404 142 L 404 312 L ${CX} 396 L 108 312 L 108 142 Z`,
  round: `M 130 74 Q 256 46 382 74 L 382 246 C 382 330 320 380 ${CX} 402 C 192 380 130 330 130 246 Z`,
};

const P = (x, y) => `${x.toFixed(1)},${y.toFixed(1)}`;
function star(cx, cy, r, fill) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(P(cx + rr * Math.cos(a), cy + rr * Math.sin(a)));
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}"/>`;
}

function icon(name, size, cx, cy, color, stroke) {
  const C = Icons[name];
  if (!C) throw new Error(`아이콘 없음: ${name}`);
  return renderToStaticMarkup(createElement(C, { size, color, strokeWidth: stroke })).replace(
    '<svg ',
    `<svg x="${cx - size / 2}" y="${cy - size / 2}" `,
  );
}

function badgeSvg([code, name, track, iconName, base]) {
  const id = code;
  const [bg, ribbon] = PALETTE[track];
  const d = SHAPES[base];
  const dark = mix(ribbon, -0.35);
  const accent = bg === '#e8b33a' || bg === '#f39c2b' ? CREAM : '#f2b134'; // 별 색 — 노란 바탕엔 크림

  // 위쪽에 별 다섯 — 가운데가 제일 크다
  const stars = [-2, -1, 0, 1, 2]
    .map((k) => star(CX + k * 40, 111 + Math.abs(k) * 12, k === 0 ? 13 : 9, mix(bg, -0.5)) + star(CX + k * 40, 108 + Math.abs(k) * 12, k === 0 ? 13 : 9, accent))
    .join('');

  // 픽토그램 — 크림색, 아래에 어두운 그림자 한 겹(플랫 스타일의 깊이)
  const iconY = base === 'arch' ? CY + 6 : CY;
  // 어두운 층을 아래로 여섯 번 밀어 두께를 만들고, 그 위에 크림색 윗면과 얇은 흰 하이라이트
  const picto = `
    <g opacity=".3">${icon(iconName, 150, CX + 6, iconY + 14, INK, 2.6)}</g>
    ${[6, 5, 4, 3, 2, 1].map((k) => icon(iconName, 150, CX, iconY + k, mix(bg, -0.55), 2.5)).join('')}
    ${icon(iconName, 150, CX, iconY, CREAM, 2.4)}
    <g opacity=".7">${icon(iconName, 150, CX, iconY - 1.5, '#fff', 0.9)}</g>`;

  // 물결 리본 — 바탕 아래를 가로지르며 양끝이 바탕 밖으로 나간다
  const ry = 352;
  const tails = `
    <path d="M 30 ${ry + 22} L 84 ${ry + 6} L 84 ${ry + 72} L 30 ${ry + 88} L 52 ${ry + 55} Z" fill="${dark}"/>
    <path d="M 482 ${ry + 22} L 428 ${ry + 6} L 428 ${ry + 72} L 482 ${ry + 88} L 460 ${ry + 55} Z" fill="${dark}"/>`;
  const folds = `
    <path d="M 84 ${ry + 6} L 84 ${ry + 72} L 66 ${ry + 60} Z" fill="${mix(ribbon, -0.55)}"/>
    <path d="M 428 ${ry + 6} L 428 ${ry + 72} L 446 ${ry + 60} Z" fill="${mix(ribbon, -0.55)}"/>`;
  const front = `M 66 ${ry + 14} C 160 ${ry - 18} 352 ${ry - 18} 446 ${ry + 14} L 446 ${ry + 80} C 352 ${ry + 48} 160 ${ry + 48} 66 ${ry + 80} Z`;
  const textPath = `M 76 ${ry + 60} C 166 ${ry + 28} 346 ${ry + 28} 436 ${ry + 60}`;
  const smallPath = `M 76 ${ry + 37} C 166 ${ry + 5} 346 ${ry + 5} 436 ${ry + 37}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" data-code="${code}">
  <defs>
    <path id="tp-${id}" d="${textPath}"/>
    <path id="sp-${id}" d="${smallPath}"/>
    <filter id="sh-${id}" x="-20%" y="-20%" width="140%" height="150%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="14" stdDeviation="10" flood-color="#3a2a1a" flood-opacity=".32"/>
    </filter>
    <!-- 볼록함 — 왼쪽 위에서 오는 빛 -->
    <filter id="bevel-${id}" x="-20%" y="-20%" width="140%" height="140%" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="b"/>
      <feSpecularLighting in="b" surfaceScale="6" specularConstant="0.55" specularExponent="16" lighting-color="#fff" result="s">
        <fePointLight x="80" y="-80" z="320"/>
      </feSpecularLighting>
      <feComposite in="s" in2="SourceAlpha" operator="in" result="s2"/>
      <feComposite in="SourceGraphic" in2="s2" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/>
    </filter>
    <linearGradient id="base-${id}" x1="0" y1="0" x2=".6" y2="1">
      <stop offset="0" stop-color="${mix(bg, 0.22)}"/><stop offset=".5" stop-color="${bg}"/><stop offset="1" stop-color="${mix(bg, -0.28)}"/>
    </linearGradient>
    <linearGradient id="rib-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${mix(ribbon, 0.2)}"/><stop offset=".55" stop-color="${ribbon}"/><stop offset="1" stop-color="${mix(ribbon, -0.3)}"/>
    </linearGradient>
    <linearGradient id="gloss-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="clip-${id}"><path d="${d}"/></clipPath>
  </defs>
  <g filter="url(#sh-${id})">
    <!-- 흰 스티커 테두리(바탕 + 리본을 한 덩어리로 감싼다) — 아래에 두께 층, 위는 볼록하게 -->
    <g fill="#cfc6b8" stroke="#cfc6b8" stroke-width="30" stroke-linejoin="round" transform="translate(0 12)">
      <path d="${d}"/>
      <path d="${front}"/>
      <path d="M 30 ${ry + 22} L 84 ${ry + 6} L 84 ${ry + 72} L 30 ${ry + 88} L 52 ${ry + 55} Z"/>
      <path d="M 482 ${ry + 22} L 428 ${ry + 6} L 428 ${ry + 72} L 482 ${ry + 88} L 460 ${ry + 55} Z"/>
    </g>
    <g fill="#fff" stroke="#fff" stroke-width="30" stroke-linejoin="round" filter="url(#bevel-${id})">
      <path d="${d}"/>
      <path d="${front}"/>
      <path d="M 30 ${ry + 22} L 84 ${ry + 6} L 84 ${ry + 72} L 30 ${ry + 88} L 52 ${ry + 55} Z"/>
      <path d="M 482 ${ry + 22} L 428 ${ry + 6} L 428 ${ry + 72} L 482 ${ry + 88} L 460 ${ry + 55} Z"/>
    </g>
    <!-- 바탕: 두께 층 → 빛 받는 윗면 → 안쪽 점선 → 유리 광택 -->
    <path d="${d}" fill="${mix(bg, -0.45)}" transform="translate(0 10)"/>
    <path d="${d}" fill="url(#base-${id})" filter="url(#bevel-${id})"/>
    <path d="${d}" fill="none" stroke="${mix(bg, 0.55)}" stroke-width="3" stroke-dasharray="1 8" stroke-linecap="round" transform="translate(${CX} ${CY}) scale(.9) translate(${-CX} ${-CY})"/>
    <g clip-path="url(#clip-${id})"><ellipse cx="${CX - 10}" cy="${CY - 110}" rx="150" ry="70" fill="url(#gloss-${id})"/></g>
    ${stars}
    ${picto}
    <!-- 리본: 꼬리 → 두께 층 → 앞면(그라데이션, 볼록) → 접힘 -->
    ${tails}
    <path d="${front}" fill="${mix(ribbon, -0.5)}" transform="translate(0 8)"/>
    <path d="${front}" fill="url(#rib-${id})" filter="url(#bevel-${id})"/>
    ${folds}
    <text class="small" fill="${mix(ribbon, 0.75)}" text-anchor="middle"><textPath href="#sp-${id}" startOffset="50%">123Band · ${TRACK_EN[track]}</textPath></text>
    <text class="name shadow" data-max="330" fill="${mix(ribbon, -0.55)}" text-anchor="middle" transform="translate(0 3)"><textPath href="#tp-${id}" startOffset="50%">${name.toUpperCase()}</textPath></text>
    <text class="name" data-max="330" fill="#fff" text-anchor="middle"><textPath href="#tp-${id}" startOffset="50%">${name.toUpperCase()}</textPath></text>
  </g>
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
<link href="https://fonts.googleapis.com/css2?family=Lilita+One&family=Nunito:wght@800&display=block" rel="stylesheet">
<style>
  body { margin: 0; background: transparent; display: flex; flex-wrap: wrap; width: ${512 * 7}px; }
  svg { display: block; }
  .name { font-family: 'Lilita One', 'Arial Black', sans-serif; font-size: 36px; letter-spacing: 1px; }
  .small { font-family: 'Nunito', Arial, sans-serif; font-weight: 800; font-size: 13px; letter-spacing: 2.5px; }
</style></head><body>${list.map(badgeSvg).join('')}</body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 512 * 7, height: 512 } });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  // 긴 이름은 리본에 들어갈 때까지 글자를 줄인다.
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
  await page.addStyleTag({ content: 'body { background: #ede4d3 }' });
  await page.screenshot({ path: join(out, '_sheet.png'), fullPage: true });
} finally {
  await browser.close();
}
