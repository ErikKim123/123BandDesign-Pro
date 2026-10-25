// IR 에디터 「윤곽선 SVG」용 글꼴 파일 중계 — 글자를 패스로 바꾸려면 글꼴 원본(TTF/OTF)이 통째로 필요하다.
// 브라우저가 직접 받으면 Google Fonts 가 쪼갠 WOFF2 만 주므로, 서버에서 받아 TTF 한 파일로 넘긴다. (로그인 불필요, 글꼴만 다룸)
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';

const PRETENDARD = 'https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/Pretendard-';

// Google Fonts 에 없는 시스템 글꼴은 모양·폭이 같은 무료 글꼴로 바꿔 쓴다
const SUBSTITUTE: Record<string, string> = {
  Arial: 'Arimo',
  'Times New Roman': 'Tinos',
  'Courier New': 'Cousine',
  Georgia: 'Gelasio',
  Verdana: 'Noto Sans',
  'sans-serif': 'Noto Sans',
  serif: 'Noto Serif',
};

const cache = new Map<string, Promise<{ bytes: ArrayBuffer; weight: number; type: string } | null>>();

async function googleTtfUrl(family: string, weight: number): Promise<{ url: string; weight: number } | null> {
  const base = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}`;
  for (const [query, w] of [
    [`${base}:wght@${weight}`, weight],
    [base, 400],
  ] as const) {
    const res = await fetch(query, { headers: { 'User-Agent': 'Mozilla/4.0' } });
    if (!res.ok) continue;
    const url = (await res.text()).match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/)?.[1];
    if (url) return { url, weight: w };
  }
  return null;
}

async function load(family: string, weight: number) {
  let src: { url: string; weight: number } | null;
  if (family === 'Pretendard') src = { url: `${PRETENDARD}${weight >= 600 ? 'Bold' : 'Regular'}.otf`, weight };
  else src = await googleTtfUrl(SUBSTITUTE[family] ?? family, weight);
  if (!src) return null;
  const res = await fetch(src.url);
  if (!res.ok) return null;
  return { bytes: await res.arrayBuffer(), weight: src.weight, type: src.url.endsWith('.otf') ? 'font/otf' : 'font/ttf' };
}

export async function GET(req: NextRequest) {
  const family = req.nextUrl.searchParams.get('family') ?? '';
  const weight = Number(req.nextUrl.searchParams.get('weight')) >= 600 ? 700 : 400;
  if (!/^[A-Za-z0-9 -]{1,60}$/.test(family)) {
    return NextResponse.json({ error: '글꼴 이름이 올바르지 않습니다.' }, { status: 400 });
  }
  const key = `${family}:${weight}`;
  let p = cache.get(key);
  if (!p) {
    p = load(family, weight).catch(() => null);
    cache.set(key, p);
  }
  const font = await p;
  if (!font) {
    cache.delete(key);
    return NextResponse.json({ error: '글꼴을 찾지 못했습니다.' }, { status: 404 });
  }
  return new NextResponse(font.bytes, {
    headers: {
      'Content-Type': font.type,
      'Cache-Control': 'public, max-age=86400',
      'X-Font-Weight': String(font.weight),
    },
  });
}
