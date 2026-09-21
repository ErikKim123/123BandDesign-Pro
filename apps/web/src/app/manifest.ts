// PWA 웹 매니페스트 — 홈 화면 추가(A2HS)/설치 가능성의 근거. Next 가 /manifest.webmanifest 로 제공하고
// <link rel="manifest"> 를 자동 주입한다. start_url '/' 는 미들웨어가 기본 로케일로 리다이렉트.
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: '123Band',
    short_name: '123Band',
    // 매니페스트는 로케일당 하나가 아니라 전역 1개 → 로케일 분기 불가. 영문으로 고정.
    description: 'Latin festival event passes, tickets & gear in one place.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#fa520f',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // 마스커블(안드로이드 홈화면)은 OS가 자체 마스크를 씌우므로 모서리가 투명한
      // 원형이 아니라 꽉 찬 정사각형을 써야 한다 → 원본 풀블리드 아이콘을 그대로 사용.
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      // 단색(monochrome) — 투명 배경 + 흰 실루엣. 안드로이드가 알림 작은 아이콘·테마 아이콘처럼
      // 색을 버리고 모양(알파)만 쓰는 자리에 쓴다. 컬러 로고를 쓰면 흰 덩어리로 보인다.
      { src: '/icon-monochrome-512.png', sizes: '512x512', type: 'image/png', purpose: 'monochrome' },
    ],
  };
}
