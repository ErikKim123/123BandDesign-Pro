// Design Ref: §6 / §11.1 — locale 루트 레이아웃 (html lang + Header/Footer). 모든 페이지는 /[locale] 하위.
import '../pretendard.css';
import '../globals.css';
import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { pickI18n, type Locale } from '@123band/shared';
import { Header, type NavItem } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { TrafficBeacon } from '@/components/analytics/TrafficBeacon';
import { AnalyticsConsent } from '@/components/analytics/AnalyticsConsent';
import { CartProvider } from '@/lib/cart/CartContext';
import { DisplayCurrencyProvider } from '@/lib/currency/CurrencyContext';
import { createClient } from '@/lib/supabase/server';
import { getNavMenus } from '@/lib/queries/home';
import { getActiveLive, getLiveHref } from '@/lib/queries/live';
import { getDictionary } from '@/i18n/dictionaries';
import { activeLocales, isActiveLocale } from '@/i18n/config';
import { SITE_NAME, siteJsonLd, OG_IMAGE, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { LiveGlobalBanner } from '@/components/live/LiveEntry';

// 메뉴관리(DB) 경로 → 로케일 반영 href. 외부(http)면 그대로, '/'는 홈.
function buildHref(locale: Locale, path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const p = !path || path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  return `/${locale}${p}`;
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://123band-web.vercel.app';

// PWA — 브라우저 UI 테마색(주소창 등). 홈 화면 추가 시 스플래시/상단바 색으로도 쓰인다.
export const viewport: Viewport = {
  themeColor: '#fa520f',
};

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  // 링크 공유(OG/트위터) 문구 — 소비자용 브랜드 태그라인 + 로고 이미지
  const shareTitle = "123Band — Asia's Latin Festival Hub";
  const shareDesc =
    locale === 'ko'
      ? '아시아 라틴 댄스 페스티벌·행사패스·티켓 허브'
      : 'Latin dance festivals, passes & tickets across Asia.';
  // 주의: canonical/hreflang 은 각 페이지의 generateMetadata 가 '자기 URL'로 설정한다.
  // 레이아웃에서 alternates 를 두면 모든 하위 페이지가 홈을 canonical 로 가리키므로 두지 않는다.
  return {
    metadataBase: new URL(SITE),
    title: dict.meta.title,
    description: dict.meta.description,
    openGraph: {
      title: shareTitle,
      description: shareDesc,
      siteName: SITE_NAME,
      locale,
      type: 'website',
      images: [{ url: OG_IMAGE, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt: shareTitle }],
    },
    twitter: {
      card: 'summary_large_image',
      title: shareTitle,
      description: shareDesc,
      images: [OG_IMAGE],
    },
    // PWA/홈 화면 추가 — 아이콘 + iOS 웹앱 메타 (매니페스트 링크는 app/manifest.ts 가 자동 주입)
    manifest: '/manifest.webmanifest',
    appleWebApp: { capable: true, title: '123Band', statusBarStyle: 'default' },
    icons: {
      icon: [
        { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
        { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
    },
  };
}

export function generateStaticParams() {
  return activeLocales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!isActiveLocale(params.locale)) notFound();
  const locale = params.locale as Locale;

  // 레이아웃 조회는 서로 의존이 없다 → 전부 병렬. 순차 await 이면 페이지마다 DB 왕복이
  // 그대로 직렬로 쌓여(메뉴→라이브배너) 헤더가 뜨기까지의 시간이 왕복 횟수만큼 늘어난다.
  //
  // 로그인 여부는 getSession() 으로 읽는다 — getUser() 는 매번 Supabase Auth 로 HTTP 왕복을
  // 하지만, 여기서 필요한 건 헤더 아이콘(로그인/마이페이지) 분기용 불리언뿐이다.
  // 토큰 갱신은 이미 미들웨어가 하고, 실제 접근 통제는 requireCustomer(서버 가드) + RLS 가 한다.
  const [dict, sessionRes, menuRows, live] = await Promise.all([
    getDictionary(locale),
    createClient().auth.getSession(),
    // 상단 메뉴 — 메뉴관리(DB) 활성 항목. 실패 시 헤더가 코드 기본값으로 폴백.
    getNavMenus().catch(() => [] as Awaited<ReturnType<typeof getNavMenus>>),
    // 진행 중인 라이브 (없으면 null → 배너 미렌더)
    getActiveLive().catch(() => null),
  ]);

  // session 존재 여부만 본다 — .user 를 꺼내면 supabase-js 가 서버 사용 경고를 찍는데,
  // 헤더 분기에 필요한 정보는 '세션이 있나' 뿐이라 그대로 충분하다.
  // 배너가 보낼 곳 — 방송이 붙어 있는 화면의 #live. 방송이 없으면 물어볼 것도 없다.
  const liveHref = live ? await getLiveHref(live, locale) : null;

  const isAuthed = !!sessionRes.data.session;
  const menu: NavItem[] = menuRows.map((m) => ({
    href: buildHref(locale, m.path),
    label: pickI18n(m.label_i18n, locale) || pickI18n(m.label_i18n, 'en') || '',
  }));

  return (
    <html lang={locale}>
      <body>
        <JsonLd data={siteJsonLd(locale)} />
        <TrafficBeacon />
        {/* 선택 분석 쿠키 — 동의한 사람에게만 Clarity 가 실린다. */}
        <AnalyticsConsent locale={locale} t={dict.consent} />
        <CartProvider>
          <DisplayCurrencyProvider locale={locale}>
            {/* 진행 중인 라이브가 있을 때만 1줄. 없으면 아무것도 렌더하지 않는다. */}
            <LiveGlobalBanner live={live} href={liveHref} locale={locale} dict={dict} />
            <Header locale={locale} dict={dict} isAuthed={isAuthed} menu={menu} />
            <main className="min-h-[60vh]">{children}</main>
            <Footer locale={locale} dict={dict} />
          </DisplayCurrencyProvider>
        </CartProvider>
      </body>
    </html>
  );
}
