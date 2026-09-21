// Design Ref: §5 Phase 2 — 슬라이드 배너 (가로 스크롤-스냅, 라이브러리 無)
import Link from 'next/link';
import { pickI18n, type Locale } from '@123band/shared';
import type { Banner } from '@/lib/queries/home';
import { storageSrcSet } from '@/lib/image';

export function BannerSlider({ banners, locale }: { banners: Banner[]; locale: Locale }) {
  if (banners.length === 0) return null;
  return (
    <section className="container-band py-6">
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {banners.map((b, i) => (
          <Link
            key={b.id}
            href={b.link_url ?? `/${locale}`}
            className="relative flex aspect-[16/9] w-[85%] flex-none snap-start items-end overflow-hidden rounded-lg bg-grey-800 sm:w-[48%] lg:w-[32%]"
          >
            {b.image_url ? (
              // CSS 배경으로 원본을 깔면 폰도 원본 PNG(수 MB)를 그대로 받고, 브라우저가 늦게야 발견한다.
              // <img srcset> 으로 화면 폭에 맞는 한 장만 받는다 — 카드는 폰 85% · 태블릿 48% · 데스크톱 32%.
              // 첫 장은 첫 화면에 보이므로 먼저 받고, 나머지는 옆으로 넘길 때 받는다.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                {...storageSrcSet(b.image_url, [400, 640, 960])}
                sizes="(min-width: 1024px) 32vw, (min-width: 640px) 48vw, 85vw"
                alt=""
                aria-hidden
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchPriority={i === 0 ? 'high' : 'auto'}
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover opacity-80"
              />
            ) : null}
            <span className="relative z-10 p-4 font-display text-lg uppercase tracking-tight text-white">
              {pickI18n(b.title_i18n, locale)}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
