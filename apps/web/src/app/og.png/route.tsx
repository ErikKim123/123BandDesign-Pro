// 링크 공유(OG) 커버 이미지 — 헤더 브랜드락업(레드 서클 마크 + 123Band)을 1200×630 으로 동적 렌더.
// 폴더명이 'og.png'(점 포함) → 미들웨어 매처(.*\..* 제외)에 걸려 로케일 리다이렉트 안 되고,
// 기존 코드의 /og.png 참조를 그대로 재사용한다(정적 public/og.png 는 삭제됨).
import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  // 자기 배포의 /wolf-mark.png 을 HTTP 로 가져와 인라인 — dev·Vercel 모두 안전(public fs 번들 의존 없음).
  const mark = await fetch(new URL('/wolf-mark.png', request.url)).then((r) => r.arrayBuffer());
  const markSrc = `data:image/png;base64,${Buffer.from(mark).toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #fa520f 0%, #ff7a2f 52%, #ffb24d 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 48 }}>
          {/* 흰 배지 안의 레드 서클 마크 — 어떤 배경에서도 또렷하게 */}
          <div
            style={{
              display: 'flex',
              width: 260,
              height: 260,
              borderRadius: 260,
              background: '#ffffff',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 24px 70px rgba(0,0,0,0.28)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={markSrc}
              width={228}
              height={228}
              style={{ width: 228, height: 228, borderRadius: 228, objectFit: 'cover' }}
              alt=""
            />
          </div>
          <div style={{ display: 'flex', fontSize: 200, fontWeight: 800, color: '#ffffff', letterSpacing: -6, lineHeight: 1 }}>
            123Band
          </div>
        </div>
        <div style={{ display: 'flex', marginTop: 52, fontSize: 42, fontWeight: 600, color: 'rgba(255,255,255,0.96)', letterSpacing: 1 }}>
          123Band
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { 'cache-control': 'public, max-age=86400, s-maxage=31536000, immutable' },
    },
  );
}
