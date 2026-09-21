// Design Ref: 홈 히어로 — 최대 5개 배너 자동 슬라이드(5초, 좌우 전환). 배너 없으면 그라데이션 폴백.
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { storageSrcSet } from '@/lib/image';

export interface HeroSlide {
  id: string;
  imageUrl: string | null;
  title: string;
  subtitle?: string;
  href: string;
  /** 이미지 제공(크레딧) — 있으면 슬라이드 우측 하단에 작게 표기. */
  credit?: string;
}

export interface HeroFallback {
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: string;
  ctaHref: string;
  ctaTickets: string;
  ctaTicketsHref: string;
}

const AUTOPLAY_MS = 5000;

export function HeroCarousel({
  slides,
  fallback,
  viewLabel,
  creditLabel,
  a11y,
}: {
  slides: HeroSlide[];
  fallback: HeroFallback;
  /** 슬라이드 CTA 버튼 라벨(예: "자세히 보기"). 링크가 있는 슬라이드에만 노출. */
  viewLabel: string;
  /** 이미지 제공 표기 앞에 붙는 라벨(예: "이미지 제공"). */
  creditLabel: string;
  /** 조작 버튼 스크린리더 라벨. goTo 는 "{n}" 치환. */
  a11y: { prev: string; next: string; goTo: string };
}) {
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);

  // 자동 넘김 — 슬라이드가 2개 이상일 때만, hover 시 일시정지
  useEffect(() => {
    if (count < 2 || paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [count, paused]);

  // 터치 스와이프 — 가로로 밀면 이전/다음. 세로가 우세하면(페이지 스크롤) 무시.
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t) touchRef.current = { x: t.clientX, y: t.clientY };
    setPaused(true);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchRef.current;
    touchRef.current = null;
    setPaused(false);
    const t = e.changedTouches[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? index + 1 : index - 1);
  };

  // 데스크톱·모바일 모두 기존 높이의 약 70% 수준으로 축소
  const heightCls = 'h-[38vh] min-h-[260px] md:h-[56vh]';

  // ── 배너 없음: 기존 그라데이션 히어로(폴백) ──
  if (count === 0) {
    return (
      <section className={`relative isolate flex ${heightCls} items-center justify-center overflow-hidden bg-grey-900 text-white`}>
        <span aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(120%_120%_at_80%_-10%,#7c2d92_0%,#1b1530_45%,#000_100%)] opacity-95" />
        <span aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(90%_90%_at_10%_110%,#c2185b_0%,transparent_55%)] opacity-60" />
        <div className="container-band flex flex-col items-center justify-center py-12 text-center">
          <p className="label-caps text-grey-300">{fallback.eyebrow}</p>
          {/* 슬라이드 본문과 같은 이유로 w-full — 없으면 좁은 화면에서 폭이 max-w-4xl 로 잡혀 잘린다. */}
          <h1 className="mt-4 w-full max-w-4xl font-display text-2xl uppercase leading-[1.15] tracking-tight [text-wrap:balance] sm:text-4xl sm:leading-[1.05] md:text-6xl">
            {fallback.title}
          </h1>
          <p className="mt-4 font-display text-sm uppercase tracking-[0.25em] text-grey-200 sm:mt-5 sm:text-base sm:tracking-[0.35em] md:text-xl">
            {fallback.subtitle}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href={fallback.ctaHref} className="btn rounded-pill bg-white px-7 py-3 text-black hover:bg-grey-200">
              {fallback.cta}
            </Link>
            <Link href={fallback.ctaTicketsHref} className="btn rounded-pill border-[1.5px] border-white/70 px-7 py-3 text-white hover:bg-white/10">
              {fallback.ctaTickets}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // ── 배너 슬라이드 ──
  return (
    <section
      className={`relative isolate ${heightCls} overflow-hidden bg-grey-900`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      aria-roledescription="carousel"
    >
      {/* 페이지 대표 제목(H1) — 슬라이드마다 제목이 바뀌므로 접근성/SEO용으로 1개만 둔다 */}
      <h1 className="sr-only">{fallback.title}</h1>
      {/* 좌우 슬라이드 트랙 */}
      <div
        className="flex h-full transition-transform duration-700 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((s, i) => (
          <div
            key={s.id}
            className="relative flex h-full w-full shrink-0 items-center justify-center overflow-hidden text-white"
          >
            {s.imageUrl ? (
              // 첫 화면의 가장 큰 그림(LCP)이다. CSS 배경으로 원본을 깔면 폰도 원본 PNG(최대 4.5MB)를
              // 받고, 브라우저가 CSS 를 다 읽은 뒤에야 발견한다. <img srcset> 으로 화면 폭에 맞는
              // webp 한 장만 받는다. 첫 장만 먼저 받고 나머지는 넘어올 때 받는다.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                {...storageSrcSet(s.imageUrl, [640, 960, 1280, 1920])}
                sizes="100vw"
                alt=""
                aria-hidden
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchPriority={i === 0 ? 'high' : 'auto'}
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <span aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_120%_at_80%_-10%,#7c2d92_0%,#1b1530_45%,#000_100%)]" />
            )}
            {/* 가독성 스크림 */}
            <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/30" />
            {/* w-full 이 없으면 플렉스 아이템이 max-w-3xl(768px)로 잡혀 좁은 화면에서 한 줄로 뻗다가 잘린다.
                좌우 여백은 이전/다음 버튼(약 48px) 폭만큼 띄워, 글자가 버튼에 가리지 않게 한다. */}
            <div className="relative z-10 w-full max-w-3xl px-14 text-center sm:px-16 lg:px-6">
              {s.title && (
                <p className="mx-auto max-w-4xl font-display text-xl font-bold uppercase leading-[1.15] tracking-tight drop-shadow [text-wrap:balance] sm:text-3xl sm:leading-[1.05] md:text-5xl lg:text-6xl">
                  {s.title}
                </p>
              )}
              {s.subtitle && (
                <p className="mx-auto mt-3 max-w-2xl whitespace-pre-line text-xs leading-relaxed text-white/90 drop-shadow [text-wrap:balance] sm:mt-4 sm:text-sm md:text-lg">
                  {s.subtitle}
                </p>
              )}
              {/* 링크가 있는 배너만 CTA 버튼 노출 → 누르면 해당 콘텐츠로 이동 */}
              {s.href && (
                <Link
                  href={s.href}
                  className="btn btn-sm mt-4 rounded-pill bg-primary px-5 text-white shadow-3 hover:bg-primary-deep sm:mt-6 sm:px-8 sm:text-base"
                >
                  {viewLabel}
                  <span aria-hidden>→</span>
                </Link>
              )}
            </div>
            {/* 이미지 제공(크레딧) — 우측 하단. 모바일은 인디케이터 위로 올려 겹침 방지 */}
            {s.credit && (
              <p
                className={`pointer-events-none absolute right-3 z-20 max-w-[60%] truncate text-[10px] leading-none text-white/75 drop-shadow md:right-6 md:bottom-4 md:max-w-[40%] md:text-xs ${
                  count > 1 ? 'bottom-14' : 'bottom-3'
                }`}
              >
                {creditLabel} · {s.credit}
              </p>
            )}
          </div>
        ))}
      </div>

      {count > 1 && (
        <>
          {/* 이전/다음 */}
          <button
            type="button"
            aria-label={a11y.prev}
            onClick={() => go(index - 1)}
            className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white backdrop-blur transition-colors hover:bg-black/50 md:left-6"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button
            type="button"
            aria-label={a11y.next}
            onClick={() => go(index + 1)}
            className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white backdrop-blur transition-colors hover:bg-black/50 md:right-6"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
          </button>
          {/* 인디케이터 — 번호(1~5) 버튼 */}
          <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={a11y.goTo.replace('{n}', String(i + 1))}
                aria-current={i === index}
                onClick={() => go(i)}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  i === index
                    ? 'bg-white text-black shadow'
                    : 'bg-black/35 text-white backdrop-blur hover:bg-black/55'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
