// Design Ref: 첫 페이지 = 123Band 소개(Home). 행사 캘린더는 /events 로 분리.
// 참고: bachatasocialworldcup.com 홈 구성(히어로 + 소개) + 첨부 와이어프레임 카피.
import type { ReactNode, SVGProps } from 'react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Store, ExternalLink, Instagram, Youtube } from 'lucide-react';
import { pickI18n, type Locale } from '@123band/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { HeroCarousel, type HeroSlide } from '@/components/home/HeroCarousel';
import { getActiveBanners, getMainSections } from '@/lib/queries/home';
import { buildMetadata, SITE_NAME } from '@/lib/seo';

// 오거나이저(파트너) 포털 주소 — 계정 페이지·푸터와 동일 기본값.
const PARTNER_URL = process.env.NEXT_PUBLIC_PARTNER_URL ?? 'https://123band-partner.vercel.app';

// TikTok 은 lucide 에 없어서 브랜드 글리프를 직접 그린다(다른 아이콘과 동일한 size prop).
function TikTok({ size = 24, ...props }: { size?: string | number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M16.5 2h-3.02v13.06a2.55 2.55 0 1 1-1.82-2.44V9.5a5.6 5.6 0 1 0 4.84 5.54V8.9a6.9 6.9 0 0 0 4.02 1.29V7.16a3.9 3.9 0 0 1-2.9-1.42A3.9 3.9 0 0 1 16.5 2Z" />
    </svg>
  );
}

// 공식 SNS 채널 — 홈 하단 소셜 섹션.
const SOCIAL_LINKS: ReadonlyArray<{
  key: 'instagram' | 'youtube' | 'tiktok';
  href: string;
  icon: ReactNode;
}> = [
  {
    key: 'instagram',
    href: 'https://www.instagram.com/worldoflatinfestivals/',
    icon: <Instagram size={44} className="h-9 w-9 sm:h-11 sm:w-11 md:h-16 md:w-16" aria-hidden />,
  },
  {
    key: 'youtube',
    href: 'https://youtube.com/@wolf_worldoflatinfestivals?si=SqRLSpJvRU-rFZF0',
    icon: <Youtube size={44} className="h-9 w-9 sm:h-11 sm:w-11 md:h-16 md:w-16" aria-hidden />,
  },
  {
    key: 'tiktok',
    href: 'https://www.tiktok.com/@worldoflatinfestivals?_r=1&_t=ZS-98RFxqWnlju',
    icon: <TikTok size={44} className="h-9 w-9 sm:h-11 sm:w-11 md:h-16 md:w-16" aria-hidden />,
  },
];

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  const description =
    locale === 'ko'
      ? '아시아를 중심으로 전 세계 라틴 댄스 페스티벌·행사패스·티켓을 한곳에서 찾아보세요.'
      : 'Discover Latin dance festivals, event passes and tickets across Asia and beyond.';
  return buildMetadata({
    locale,
    path: '',
    title: dict.home.hero?.title || SITE_NAME,
    description,
    brandSuffix: false,
  });
}

export default async function HomePage({ params }: { params: { locale: string } }) {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  const h = dict.home;

  // 메인 히어로 배너 — position='hero' 활성 배너 최대 5개(순서대로). 실패해도 홈은 폴백으로 렌더.
  let heroSlides: HeroSlide[] = [];
  try {
    heroSlides = (await getActiveBanners())
      .filter((b) => b.position === 'hero')
      .slice(0, 5)
      .map((b) => ({
        id: b.id,
        imageUrl: b.image_url,
        title: pickI18n(b.title_i18n, locale) || pickI18n(b.title_i18n, 'en') || '',
        subtitle: b.subtitle_i18n
          ? pickI18n(b.subtitle_i18n, locale) || pickI18n(b.subtitle_i18n, 'en') || ''
          : '',
        href: b.link_url || '',
        credit: b.image_credit || '',
      }));
  } catch {
    heroSlides = [];
  }

  // 오거나이저 CTA — 어드민 메인화면관리의 활성 'organizer_cta' 섹션이 있을 때만 노출.
  let showOrganizerCta = false;
  try {
    showOrganizerCta = (await getMainSections()).some((s) => s.section_type === 'organizer_cta');
  } catch {
    showOrganizerCta = false;
  }

  return (
    <div>
      {/* ── 히어로 (자동 슬라이드, 배너 없으면 그라데이션 폴백) ── */}
      <HeroCarousel
        slides={heroSlides}
        viewLabel={h.hero.viewMore}
        creditLabel={h.hero.imageCredit}
        a11y={{ prev: h.hero.prevSlide, next: h.hero.nextSlide, goTo: h.hero.goToSlide }}
        fallback={{
          eyebrow: h.hero.eyebrow,
          title: h.hero.title,
          subtitle: h.hero.subtitle,
          cta: h.hero.cta,
          ctaHref: `/${locale}/events`,
          ctaTickets: h.hero.ctaTickets,
          ctaTicketsHref: `/${locale}/shop?type=ticket`,
        }}
      />

      {/* ── 소개 ── */}
      <section className="container-band grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
        <div>
          <p className="label-caps">{h.intro.eyebrow}</p>
          <h2 className="section-title mt-3 text-3xl md:text-4xl">{h.intro.heading}</h2>
          <p className="mt-5 text-lg font-medium text-black md:text-xl">{h.intro.lead}</p>
          <p className="mt-4 leading-relaxed text-grey-600">{h.intro.body}</p>
          <Link href={`/${locale}/shop?type=ticket`} className="btn btn-primary mt-8">
            {h.hero.ctaTickets}
          </Link>
        </div>

        {/* 123Band 브랜드 카드 — 레드 서클 댄서 엠블럼 + 워드마크, 선셋 글로우 */}
        <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-grey-900 text-white shadow-4">
          {/* 엠블럼 뒤 따뜻한 선셋 글로우 */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[40%] h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/25 blur-3xl md:h-72 md:w-72"
          />
          <div className="relative flex flex-col items-center text-center">
            {/* 레드 서클 댄서 엠블럼 */}
            <span className="relative block h-24 w-24 overflow-hidden rounded-full ring-1 ring-white/15 md:h-28 md:w-28">
              <Image
                src="/wolf-mark.png"
                alt="123Band"
                fill
                sizes="(min-width: 768px) 112px, 96px"
                className="object-cover"
              />
            </span>
            <p className="mt-6 font-display text-6xl font-extrabold uppercase leading-none tracking-tight md:text-7xl">
              123Band
            </p>
            <p className="mt-4 text-[11px] uppercase tracking-[0.3em] text-grey-300 md:text-sm">
              123Band
            </p>
            <p className="mt-1.5 text-[10px] uppercase tracking-[0.45em] text-primary/90 md:text-xs">
              The Hub to Hunt
            </p>
          </div>
          {/* 시그니처 선셋 스트립 — 카드 하단 브랜드 마감 */}
          <div className="sunset-stripe absolute inset-x-0 bottom-0" />
        </div>
      </section>

      {/* ── What to expect ── */}
      <section className="border-t border-grey-200 bg-grey-100">
        <div className="container-band py-16 md:py-24">
          <h2 className="section-title text-center">{h.expect.title}</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {h.expect.items.map((item, i) => (
              <div
                key={item.title}
                className="flex flex-col rounded-lg border border-grey-200 bg-white p-6"
              >
                <span className="font-display text-2xl text-grey-300">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-3 font-display text-xl uppercase tracking-tight">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-grey-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 소셜 미디어 ── */}
      <section className="border-t border-grey-200">
        <div className="container-band py-14 text-center">
          <h2 className="section-title">{h.social.title}</h2>
          <div className="mt-8 flex flex-nowrap items-center justify-center gap-4 md:gap-6">
            {SOCIAL_LINKS.map(({ key, href, icon }) => {
              const label = h.social[key];
              return (
                <a
                  key={key}
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={label}
                  title={label}
                  className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-grey-300 bg-white text-grey-900 transition-colors hover:border-primary hover:bg-primary hover:text-white sm:h-28 sm:w-28 md:h-40 md:w-40"
                >
                  {icon}
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 오거나이저 시작 CTA (어드민 메인화면관리에서 노출/숨김) ── */}
      {showOrganizerCta && (
        <section className="border-t border-grey-200 bg-grey-100">
          <div className="container-band py-16 md:py-20">
            <div className="mx-auto max-w-xl rounded-lg bg-ink p-8 text-center text-white md:p-10">
              <p className="text-sm text-white/60">{dict.footer.organizerPrompt}</p>
              <p className="mt-1.5 font-display text-2xl font-bold tracking-tight [word-break:keep-all] [text-wrap:balance]">
                {dict.footer.organizerCtaTitle}
              </p>
              <a
                href={`${PARTNER_URL}/login?lang=${locale}`}
                className="btn btn-primary mt-5 text-base"
              >
                <Store size={18} />
                <span>{dict.footer.organizerCtaButton}</span>
                <ExternalLink size={15} className="text-white/70" />
              </a>
            </div>
          </div>
        </section>
      )}

      {/* ── 클로징 CTA ── */}
      <section className="bg-grey-900 text-white">
        <div className="container-band py-16 text-center md:py-20">
          <p className="mx-auto max-w-2xl text-lg text-grey-200 [word-break:keep-all] [text-wrap:balance]">
            {h.closing.lead}
          </p>
          <p className="mx-auto mt-4 max-w-2xl font-display text-2xl uppercase leading-tight tracking-tight [word-break:keep-all] [text-wrap:balance] md:text-4xl">
            {h.closing.emphasis}
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/${locale}/events`}
              className="btn rounded-pill bg-white px-7 py-3 text-black hover:bg-grey-200"
            >
              {h.intro.ctaEvents}
            </Link>
            <Link
              href={`/${locale}/shop?type=ticket`}
              className="btn rounded-pill border-[1.5px] border-white/70 px-7 py-3 text-white hover:bg-white/10"
            >
              {h.hero.ctaTickets}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
