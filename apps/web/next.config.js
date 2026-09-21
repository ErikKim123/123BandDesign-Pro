// Design Ref: §11.1 — NAS 심볼릭링크 미지원 → @123band/shared 를 transpilePackages + tsconfig path로 직접 참조
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @123band/shared(src TS) 를 트랜스파일 (node_modules 링크 없이 소스 참조)
  transpilePackages: ['@123band/shared'],
  experimental: {
    externalDir: true, // 모노레포 루트 밖(packages/) 파일 import 허용
  },
  images: {
    // 배너/상품 이미지: 외부 URL 허용 (Supabase Storage·CDN 등)
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  // Design Ref: §7 SEO — vercel.app 기본 도메인 → 정식 도메인 301 (중복 콘텐츠 방지).
  // 123Band 정식 도메인이 정해지면 추가한다. 형식:
  //   { source: '/:path*', has: [{ type: 'host', value: '<vercel 기본 호스트>' }],
  //     destination: 'https://<정식 도메인>/:path*', statusCode: 301 }
  // (host 와 destination 이 같으면 무한 리다이렉트가 되므로 주의)
  async redirects() {
    return [];
  },
  // Design Ref: §7 보안 — 기본 보안 헤더 (CSP 는 인라인 스타일/외부이미지 영향으로 추후 별도 도입)
  async headers() {
    return [
      // 자가호스팅 폰트 — 폴더 이름에 버전이 들어 있어 내용이 바뀌지 않는다. 한 번 받으면 다시 묻지 않게.
      {
        source: '/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // camera 는 self 허용 — QR 스캔(마이페이지 소셜)이 getUserMedia 를 쓴다.
          // camera=() 로 두면 브라우저가 "camera is not allowed in this document" 로 차단한다.
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
