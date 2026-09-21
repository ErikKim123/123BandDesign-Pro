// Design Ref: §7 SEO — robots. 개인/주문 경로는 색인 제외.
import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/seo'; // sitemap 절대경로도 canonical 도메인 단일 소스 공유

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // 관리/API + 로그인·결제·계정·장바구니·검색 등 개인/비공개·중복 경로는 색인 금지
      disallow: [
        '/admin',
        '/api/',
        '/*/login',
        '/*/signup',
        '/*/checkout',
        '/*/account',
        '/*/u/', // 소셜 QR 개인 프로필 (/{locale}/u/{code})
        '/*/cart',
        '/*/search',
      ],
    },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
