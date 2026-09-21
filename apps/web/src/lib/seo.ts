// Design Ref: §7 SEO — 페이지별 메타데이터(canonical·hreflang·OG)와 전역 구조화데이터 공용 헬퍼.
// 규칙: canonical 은 항상 '자기 로케일 경로'. hreflang 은 en/ko + x-default(en).
import type { Metadata } from 'next';
import type { Locale } from '@123band/shared';
import { activeLocales } from '@/i18n/config';

// canonical/OG/sitemap/robots 전부 이 값을 공유(단일 소스) → 도메인 드리프트 방지.
// 폴백은 정식 도메인: NEXT_PUBLIC_SITE_URL 미설정 시에도 localhost/vercel.app 이 절대 새어나가지 않게.
export const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://123band-web.vercel.app';
export const SITE_NAME = '123Band';
const BRAND = '123Band';

// 링크 공유 커버. 카카오/페북 등 스크래퍼는 '이미지 URL 단위'로 캐시한다(수일~무기한).
// 커버 디자인을 바꾸면 이 버전을 올려 새 URL이 되게 해야 재수집된다 — 경로만 바꾸면 옛 이미지가 계속 뜬다.
export const OG_IMAGE = `${SITE}/og.png?v=2`;
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

/** 로케일 제외 경로('', '/shop', `/products/${id}`) → `/{locale}{path}` */
export function localePath(locale: Locale, path: string): string {
  const p = !path || path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  return `/${locale}${p}`;
}

/** hreflang 맵 — 활성 로케일 + x-default(en) */
export function hreflangAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const l of activeLocales) languages[l] = localePath(l, path);
  languages['x-default'] = localePath('en', path);
  return languages;
}

/** 페이지 공용 Metadata 빌더 — canonical override + hreflang + OG/twitter 일괄. */
export function buildMetadata(opts: {
  locale: Locale;
  path: string; // 로케일 제외 경로
  title: string; // 페이지 고유 제목
  description: string;
  image?: string; // 절대 URL (없으면 브랜드 커버 OG_IMAGE)
  noindex?: boolean;
  brandSuffix?: boolean; // false 면 접미사(| 123Band) 생략(홈 등)
  ogType?: 'website' | 'article';
}): Metadata {
  const { locale, path, title, description, image, noindex, brandSuffix = true, ogType = 'website' } = opts;
  const canonical = localePath(locale, path);
  const fullTitle = brandSuffix ? `${title} | ${BRAND}` : title;
  const img = image || OG_IMAGE;
  // width/height 명시 — 카카오/트위터가 큰 카드로 렌더할지 판단하는 근거가 된다.
  const ogImage = img === OG_IMAGE ? { url: img, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt: fullTitle } : { url: img, alt: fullTitle };
  return {
    title: fullTitle,
    description,
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
    alternates: { canonical, languages: hreflangAlternates(path) },
    openGraph: {
      title: fullTitle,
      description,
      url: canonical,
      siteName: SITE_NAME,
      locale,
      type: ogType,
      images: [ogImage],
    },
    twitter: { card: 'summary_large_image', title: fullTitle, description, images: [img] },
  };
}

/** 전역 구조화데이터 — Organization + WebSite(SearchAction). 레이아웃에서 1회 주입. */
export function siteJsonLd(locale: Locale): Record<string, unknown>[] {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE,
      logo: `${SITE}/icon-512.png`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE,
      inLanguage: locale,
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${SITE}/${locale}/search?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
  ];
}

/** BreadcrumbList 구조화데이터 — items: [{name, path(로케일 제외)}] 순서대로. */
export function breadcrumbJsonLd(
  locale: Locale,
  items: { name: string; path: string }[],
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `${SITE}${localePath(locale, it.path)}`,
    })),
  };
}
