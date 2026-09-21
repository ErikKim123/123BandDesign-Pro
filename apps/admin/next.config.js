// Design Ref: §11.1 — NAS 심볼릭링크 미지원 → @123band/shared 를 transpilePackages + tsconfig path로 직접 참조
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @123band/shared(src TS) 를 트랜스파일 (node_modules 링크 없이 소스 참조)
  transpilePackages: ['@123band/shared'],
  experimental: {
    externalDir: true, // 모노레포 루트 밖(packages/) 파일 import 허용
    serverComponentsExternalPackages: ['pg'], // 파트너 생성 라우트의 postgres 직접연결 (런타임 require)
  },
};

module.exports = nextConfig;
