// 모바일 가로 오버플로 점검 — 390px 폭에서 페이지가 가로로 넘치는지 보고, 넘친다면 범인을 짚는다.
//
// 사용: node scripts/overflow-probe.mjs <url> [url ...]
//   예) node scripts/overflow-probe.mjs https://123band-web.vercel.app/ko http://localhost:3000/ko
//   폭 바꾸기: PROBE_W=360 node scripts/overflow-probe.mjs <url>   (갤럭시 흔한 폭 360·412, 작은 폰 320)
//
// 스크롤 컨테이너(overflow-x auto/scroll/hidden) 안에서 넘치는 요소는 정상이므로 걸러낸다.
import { chromium } from '@playwright/test';

// 기본 390 = iPhone 12/13/14 논리 폭. 기기마다 넘치는 지점이 달라 PROBE_W 로 바꿔 본다.
const W = Number(process.env.PROBE_W || 390);
const urls = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: 844 }, deviceScaleFactor: 2 });

for (const url of urls) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(1500);
  const report = await page.evaluate((W) => {
    const doc = document.documentElement;
    const out = { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, offenders: [] };
    if (doc.scrollWidth <= doc.clientWidth) return out;
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.right <= W + 1) continue;
      // 스크롤 컨테이너 안에서 넘치는 건 정상 — 조상 중 가로스크롤 되는 게 있으면 건너뛴다
      let p = el.parentElement, contained = false;
      while (p && p !== document.body) {
        const ov = getComputedStyle(p).overflowX;
        if ((ov === 'auto' || ov === 'scroll' || ov === 'hidden') && p.getBoundingClientRect().right <= W + 1) { contained = true; break; }
        p = p.parentElement;
      }
      if (contained) continue;
      out.offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : String(el.className || '')).slice(0, 120),
        right: Math.round(r.right), width: Math.round(r.width),
        text: (el.textContent || '').trim().slice(0, 50),
      });
    }
    return out;
  }, W);
  console.log('\n=== ' + url);
  console.log(`scrollWidth ${report.scrollWidth} / clientWidth ${report.clientWidth}` + (report.scrollWidth > report.clientWidth ? '  ⚠️ 가로 넘침' : '  OK'));
  for (const o of report.offenders.slice(0, 12)) console.log(`  <${o.tag}> right=${o.right} w=${o.width} "${o.text}" .${o.cls}`);
}
await browser.close();
