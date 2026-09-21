// Design Ref: Wolf Design System / signature (HeroBand) — 히어로 배너 (sunset sky + 대형 1개, 이미지+제목)
import Link from 'next/link';
import { pickI18n, type Locale } from '@123band/shared';
import type { Banner } from '@/lib/queries/home';
import { storageSrcSet } from '@/lib/image';

export function HeroSection({ banner, locale }: { banner: Banner; locale: Locale }) {
  const title = pickI18n(banner.title_i18n, locale);
  const href = banner.link_url ?? `/${locale}`;

  return (
    <section className="container-band pt-6">
      <Link
        href={href}
        className="relative flex aspect-[16/9] items-end overflow-hidden rounded-xl bg-sunset-sky md:aspect-[21/9]"
      >
        {banner.image_url ? (
          // 원본 대신 화면 폭에 맞는 한 장(Storage 는 webp 로 변환, 외부 URL 은 그대로).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            {...storageSrcSet(banner.image_url, [640, 960, 1280, 1920])}
            sizes="(min-width: 1280px) 1216px, 100vw"
            alt=""
            aria-hidden
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        {/* 하단 스크림 — 골든아워 톤에서 제목 가독성 확보 */}
        <span
          className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/55 to-transparent"
          aria-hidden
        />
        <div className="relative z-10 p-6 md:p-10">
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-white md:text-5xl">
            {title}
          </h1>
        </div>
      </Link>
    </section>
  );
}
