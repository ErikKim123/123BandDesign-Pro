// Design Ref: 티켓 = 이벤트 페이지 템플릿 (히어로 + 스티키 앵커 메뉴 + 일시/신청/비용/장소 + 섹션). i18n.
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { CalendarPlus, MapPin, Instagram, Youtube, Facebook } from 'lucide-react';
import {
  EVENT_SECTION_KEYS,
  activeTicketTier,
  baseCurrency,
  pickI18n,
  addrText,
  formatEventAddress,
  formatPostalAddress,
  hasAddressSignal,
  mapLink,
  tierDeadlineMs,
  tierListPrices,
  tierPrices,
  type Currency,
  type EventAddress,
  type EventSectionKey,
  type Locale,
} from '@123band/shared';
import { currencyForLocale, intlLocale } from '@/lib/locale';
import { priceLabel } from '@/lib/price';
import { sanitizeHtml } from '@/lib/sanitize';
import { AddToCartButton } from '@/components/cart/AddToCartButton';
import { CheckoutNowButton } from '@/components/cart/CheckoutNowButton';
import { TicketPurchase } from '@/components/cart/TicketPurchase';
import { MediaGallery } from '@/components/product/MediaGallery';
import { FlightSection, StaySection } from '@/components/product/TravelAffiliate';
import { destinationAirport, STAY22_AID, TRAVELPAYOUTS_MARKER } from '@/lib/travel';
import type { ProductDetail as Product } from '@/lib/queries/product';
import type { Dictionary } from '@/i18n/dictionaries';
import { storageImageProps } from '@/lib/image';

// 틱톡 브랜드 아이콘 (lucide 미제공).
function TikTokIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.5 3c.3 2.1 1.6 3.6 3.5 3.9v2.5c-1.3.1-2.5-.3-3.6-1v5.9c0 3.4-2.7 6-6 6-3.2 0-5.7-2.6-5.7-5.8 0-3 2.3-5.5 5.3-5.8.4 0 .8 0 1.2.1v2.7c-.4-.1-.7-.2-1.1-.2-1.4 0-2.5 1.1-2.5 2.5s1.1 2.5 2.5 2.5 2.5-1.1 2.5-2.5V3h3.4z" />
    </svg>
  );
}

// 관련 링크 버튼 순서·아이콘 (인스타·유튜브·페북·틱톡). EventLinks 필드 키와 일치.
const SOCIAL_LINKS = [
  { key: 'instagram', label: 'Instagram', Icon: Instagram },
  { key: 'youtube', label: 'YouTube', Icon: Youtube },
  { key: 'facebook', label: 'Facebook', Icon: Facebook },
  { key: 'tiktok', label: 'TikTok', Icon: TikTokIcon },
] as const;

// 스킴 없는 입력(instagram.com/…)도 안전한 절대 URL 로 보정.
function normalizeUrl(u: string): string {
  const t = u.trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t.replace(/^\/+/, '')}`;
}

/** 장소(NAP) 블록 — 크롤러가 '텍스트로' 읽는 로컬 시그널.
 *  JSON-LD 만으로는 부족하다. 베뉴명 + 우편주소를 본문에 <address> 로 노출하고 지도로 잇는다. */
function VenueCard({
  address,
  countryCode,
  locale,
  labels,
}: {
  address: EventAddress;
  countryCode?: string;
  locale: Locale;
  labels: { venue: string; viewMap: string };
}) {
  // 국가는 ISO2 코드 그대로 넘긴다 — 내부에서 로케일 표시명으로 바꾸고,
  // 주소 칸에 영문 국가명이 이미 있으면("… , Vietnam") 중복으로 걸러내려면 코드가 필요하다.
  const venue = addrText(address.venue, locale);
  const postal = formatPostalAddress(address, locale, countryCode);
  const map = mapLink(address, locale, countryCode);
  return (
    <div className="rounded-xl border border-grey-200 bg-grey-50 p-4">
      <div className="flex items-start gap-2.5">
        <MapPin size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          {venue && <p className="font-semibold text-grey-900">{venue}</p>}
          {/* not-italic: 브라우저 기본 <address> 기울임 해제 */}
          {postal && (
            <address className="mt-0.5 not-italic leading-relaxed text-grey-700">{postal}</address>
          )}
          {map && (
            <a
              href={map}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
            >
              <MapPin size={14} aria-hidden="true" /> {labels.viewMap}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function EventDetail({
  product,
  locale,
  dict,
  soldCounts,
}: {
  product: Product;
  locale: Locale;
  dict: Dictionary;
  /** 티켓별 판매 수량 {ticket_key: n} — 잔여 = units - n. 없으면 수량 제한 없이 동작. */
  soldCounts?: Record<string, number>;
}) {
  const ev = product.event_content ?? {};
  const name = pickI18n(product.name_i18n, locale) || '—';
  const banner = pickI18n(ev.banner, locale);
  // 히어로 배경: 배너가 없으면 대표 포스터로 채운다(빈 검은 박스 방지).
  const heroBg = banner || product.image_url || '';
  const badge = pickI18n(ev.badge, locale);
  const subtitle = pickI18n(ev.subtitle, locale);
  // 장소: 자유 텍스트(location) 우선, 없으면 구조화 주소(address) 한 줄 표기 — 마법사 신규 행사패스 호환
  const location = pickI18n(ev.location, locale) || formatEventAddress(ev.address, locale);
  const intl = intlLocale(locale);
  const soldout = product.status === 'soldout';

  // 관련 SNS 링크 — 값(URL)이 있는 플랫폼만 버튼으로 노출.
  const socialLinks = SOCIAL_LINKS.map((s) => ({ ...s, url: ev.links?.[s.key]?.trim() ?? '' })).filter(
    (s) => s.url.length > 0,
  );

  // 주소 신호가 있으면 오거나이저가 '행사 장소' 섹션을 안 썼어도 장소 섹션을 띄운다.
  // 로컬 검색은 본문 텍스트에 주소가 있는지를 본다 — 이 블록이 그 근거가 된다.
  const showVenueCard = hasAddressSignal(ev.address, locale);

  // 콘텐츠가 있는 섹션만 (메뉴 = 섹션 순서)
  const sections = useMemo(
    () =>
      EVENT_SECTION_KEYS.map((key) => ({
        key,
        label: (dict.event.menu as Record<string, string>)[key] ?? key,
        html: sanitizeHtml(pickI18n(ev.sections?.[key as EventSectionKey], locale)),
      })).filter((s) => s.html.trim().length > 0 || (s.key === 'venue' && showVenueCard)),
    [ev.sections, locale, dict, showVenueCard],
  );

  // datetime-local(TZ 없음)은 KST 절대시각으로 고정 → 서버=클라 일치 (hydration 안전)
  const toKstDate = (iso: string) => new Date(/[+Z]/.test(iso) ? iso : `${iso}+09:00`);

  // 일시/신청 텍스트 (24시간제 + KST 고정으로 PM/오후 불일치 제거)
  const fmtDateTime = (iso?: string) => {
    if (!iso) return '';
    const d = toKstDate(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(intl, {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Seoul',
    }).format(d);
  };
  const dateText = ev.startAt
    ? `${fmtDateTime(ev.startAt)}${ev.endAt ? ` ~ ${fmtDateTime(ev.endAt)}` : ''}`
    : '';
  const periodText =
    ev.applyStart || ev.applyEnd
      ? `${fmtDateTime(ev.applyStart)} ~ ${fmtDateTime(ev.applyEnd)}`
      : '';

  // 신청 기간 열림/마감
  const now = new Date();
  const applyOpen =
    !soldout &&
    (!ev.applyStart || toKstDate(ev.applyStart) <= now) &&
    (!ev.applyEnd || toKstDate(ev.applyEnd) >= now);

  // 티켓(패스) 목록 — 각 티켓의 현재 판매가(활성 가격구간). 여러 개면 상세에서 티켓별 선택 구매.
  const nowMs = now.getTime();
  const purchaseTickets = (ev.tickets ?? [])
    .map((t) => {
      const active = activeTicketTier(t.priceTiers, nowMs);
      // 가격이 매겨진 구간만 스케줄로 노출 — 현재 구간=active, 지난=past, 다가올=upcoming
      // (판정은 activeTicketTier 와 동일하게 서브통화까지 — $ 없이 ฿ 만 넣은 구간도 스케줄에 남는다)
      const tiers = (t.priceTiers ?? [])
        .filter((pt) => Object.keys(tierPrices(pt)).length > 0)
        .map((pt, idx) => ({
          key: pt.label || String(idx + 1),
          until: pt.until,
          prices: tierPrices(pt),
          listPrices: tierListPrices(pt),
          state: (pt === active
            ? 'active'
            : tierDeadlineMs(pt.until) < nowMs
              ? 'past'
              : 'upcoming') as 'active' | 'past' | 'upcoming',
        }));
      const prices = active ? tierPrices(active) : (t.price ?? {});
      const listPrices = active ? tierListPrices(active) : {};
      // 총 수량을 안 정한 티켓은 remaining 을 주지 않는다 — 제한 없이 팔리던 동작 그대로.
      const remaining =
        typeof t.units === 'number' && t.units > 0
          ? Math.max(0, t.units - (soldCounts?.[t.key] ?? 0))
          : undefined;
      return { key: t.key, name: t.name ?? {}, prices, listPrices, tiers, remaining };
    })
    .filter((t) => Object.keys(t.prices).length > 0);
  const hasTickets = purchaseTickets.length > 0;

  // 비용: priceText(해당 로케일 값만) 우선, 없으면 기준 통화로 표시.
  // 기준 통화 = 결제 통화 가격이 있으면 그대로, 없으면 행사 국가 통화 → 바트만 넣은 행사를 US$ 로 환산하지 않는다.
  const priceTextDirect = ev.priceText?.[locale]?.trim() || '';
  const currency = currencyForLocale(locale);
  const costCurrency = baseCurrency([product.prices], currency, ev.country);
  const costText = priceLabel(product.prices, costCurrency, intl, dict.event.free, priceTextDirect);

  // 여행(항공·숙박) 어필리에이트 — 제휴 ID(env)가 있고 목적지/좌표를 알 수 있을 때만 노출.
  // 항공은 목적지 공항, 숙박은 좌표(없으면 주소 문자열)가 있어야 위젯이 의미를 갖는다.
  // 표기는 '실제로 검색하는 공항의 도시' 기준 — 행사 도시에 공항이 없으면
  // 관문공항으로 떨어지는데(붕따우 → SGN 호치민), 행사 도시명을 그대로 쓰면 검색 결과와 어긋나 보인다.
  const dest = destinationAirport(ev.address, ev.country, locale);
  const stayAddressText = formatEventAddress(ev.address, 'en') || location;
  const showFlights = Boolean(TRAVELPAYOUTS_MARKER && dest.iata && ev.startAt);
  const showStay = Boolean(
    STAY22_AID &&
      (typeof ev.address?.lat === 'number' || stayAddressText.trim().length > 0) &&
      ev.startAt,
  );
  const travelLabels = dict.event.travel;

  // 하단 도크 네비 = 콘텐츠 섹션 + 항공/숙박 + 가격(맨 뒤). 가격 항목은 신청/티켓 영역(#tickets)으로 이동.
  const navItems = useMemo(
    () => [
      ...sections.map((s) => ({ key: s.key, label: s.label })),
      ...(showFlights ? [{ key: 'flights', label: (dict.event.menu as Record<string, string>).flights }] : []),
      ...(showStay ? [{ key: 'stay', label: (dict.event.menu as Record<string, string>).stay }] : []),
      ...(socialLinks.length > 0 ? [{ key: 'links', label: dict.event.relatedLinks }] : []),
      ...(hasTickets || costText
        ? [{ key: 'tickets', label: (dict.event.menu as Record<string, string>).price }]
        : []),
    ],
    [hasTickets, costText, sections, dict, socialLinks.length, showFlights, showStay],
  );

  // 구글 캘린더 링크
  const calUrl = useMemo(() => {
    if (!ev.startAt) return null;
    const toCal = (iso?: string) => {
      const d = iso ? toKstDate(iso) : null;
      if (!d || Number.isNaN(d.getTime())) return '';
      return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };
    const start = toCal(ev.startAt);
    const end = toCal(ev.endAt) || start;
    if (!start) return null;
    const p = new URLSearchParams({
      action: 'TEMPLATE',
      text: name,
      dates: `${start}/${end}`,
      details: subtitle || '',
      location: location || '',
    });
    return `https://calendar.google.com/calendar/render?${p.toString()}`;
  }, [ev.startAt, ev.endAt, name, subtitle, location]);

  // 스크롤스파이 (현재 보이는 섹션 강조)
  const [active, setActive] = useState<string>(navItems[0]?.key ?? '');
  useEffect(() => {
    if (navItems.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: '-96px 0px -60% 0px', threshold: 0 },
    );
    // 'tickets'(가격) 앵커는 데스크톱에서 sticky 라 항상 화면에 걸쳐 스파이를 왜곡 → 관찰 제외.
    // (클릭 스크롤과 초기 하이라이트는 유지)
    navItems
      .filter((s) => s.key !== 'tickets')
      .forEach((s) => {
        const el = document.getElementById(s.key);
        if (el) obs.observe(el);
      });
    return () => obs.disconnect();
  }, [navItems]);

  // 하단 리모콘: 현재 섹션 버튼을 도크 안에서 항상 보이도록 가운데로 스크롤(모바일 잘림 방지).
  const dockRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const cont = dockRef.current;
    if (!cont || !active) return;
    const el = cont.querySelector<HTMLElement>(`[data-key="${active}"]`);
    if (!el) return;
    const target = el.offsetLeft - (cont.clientWidth - el.clientWidth) / 2;
    cont.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [active]);

  const cartItem = {
    id: product.id,
    name_i18n: product.name_i18n,
    prices: product.prices,
    seller_id: product.seller_id,
    is_partner_product: product.is_partner_product,
    product_type: product.product_type,
    image_url: product.image_url || banner || null,
    // 장바구니 부제: 장소(없으면 부제) — 어떤 행사인지 한눈에
    meta_i18n: ev.location ?? ev.subtitle,
  };

  return (
    <article className="scroll-smooth pb-36 md:pb-28">
      {/* 히어로 배너 */}
      <header className="relative isolate overflow-hidden bg-gradient-to-br from-grey-900 via-black to-grey-900 text-white">
        {heroBg && (
          <Image
            {...storageImageProps(heroBg, 1600)}
            alt={name}
            fill
            priority
            sizes="100vw"
            className="-z-10 object-cover opacity-60"
          />
        )}
        {/* 포스터 폴백은 가독성 위해 좀 더 어둡게 오버레이 */}
        <div className="absolute inset-0 -z-10 bg-black/50" />
        <div className="container-band flex flex-col items-center gap-4 py-12 text-center md:py-24">
          {badge && (
            <span className="rounded-pill bg-primary/90 px-4 py-1.5 text-sm font-semibold text-white">
              {badge}
            </span>
          )}
          <h1 className="font-display text-3xl font-bold leading-tight md:text-5xl">{name}</h1>
          {subtitle && <p className="max-w-2xl text-base text-white/80 md:text-lg">{subtitle}</p>}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-white/90">
            {dateText && <span>🗓 {dateText}</span>}
            {location && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={14} /> {location}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* 섹션 바로가기 — 하단 플로팅 리모콘(스크롤해도 항상 보임). 티켓 없는 상품은 모바일 결제바 위로 띄운다. */}
      {navItems.length > 0 && (
        <nav
          aria-label="section navigation"
          className="fixed inset-x-0 bottom-[5vh] z-40 flex justify-center px-4"
        >
          <div
            ref={dockRef}
            className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-3xl bg-grey-900/40 p-2 shadow-2xl shadow-black/40 ring-1 ring-white/10 backdrop-blur md:flex-nowrap md:overflow-x-auto md:scroll-smooth md:rounded-full md:[-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {navItems.map((s) => (
              <a
                key={s.key}
                href={`#${s.key}`}
                data-key={s.key}
                // 가격(#tickets)은 스크롤스파이 관찰 제외라 클릭 시 직접 활성 처리(색상 변경).
                onClick={() => setActive(s.key)}
                aria-current={active === s.key ? 'true' : undefined}
                className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2.5 text-[15px] font-semibold transition-colors ${
                  active === s.key
                    ? 'bg-primary text-white shadow'
                    : 'text-white/75 hover:bg-white/10 hover:text-white active:bg-white/20'
                }`}
              >
                {s.label}
              </a>
            ))}
          </div>
        </nav>
      )}

      {/* 본문(좌) + 우측 sticky 신청 사이드바 */}
      <div className="container-band py-8">
        {/* grid-cols-1(=minmax(0,1fr)) 명시 + 데스크톱도 minmax(0,1fr): 컬럼 최소폭 0 으로 잡아
            본문/사이드바의 내부 콘텐츠(캐러셀 등)가 그리드 트랙을 밀어 페이지가 가로로 넘치는 것 방지. */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          {/* 섹션 본문 (좌) — 모바일에선 위(미디어 먼저), 데스크톱은 좌측.
              min-w-0: 캐러셀(overflow-x-auto + shrink-0 슬라이드)의 intrinsic 폭이 그리드 컬럼을
              밀어 페이지가 가로로 넘치는 것(flex/grid blowout) 방지. */}
          <div className="order-1 min-w-0 space-y-12 pb-12 lg:order-1">
            {/* 미디어 갤러리 (유튜브·인스타·이미지·동영상) */}
            <MediaGallery items={ev.media} replayLabel={dict.event.replay} alt={name} />
            {/* 동영상 전용 섹션 (유튜브·비메오·동영상파일) — 플레이어로 임베드 */}
            {ev.videos?.some((u) => u && u.trim()) && (
              <section id="videos" className="scroll-mt-24">
                <h2 className="mb-4 border-l-4 border-primary pl-3 font-display text-2xl font-bold">
                  {dict.event.videos}
                </h2>
                <MediaGallery items={ev.videos} replayLabel={dict.event.replay} alt={name} />
              </section>
            )}
            {sections.map((s) => (
              <section key={s.key} id={s.key} className="scroll-mt-24">
                <h2 className="mb-4 border-l-4 border-primary pl-3 font-display text-2xl font-bold">
                  {s.label}
                </h2>
                {/* 장소 섹션 맨 위에 구조화 주소(NAP) — 오거나이저 본문보다 먼저 노출 */}
                {s.key === 'venue' && showVenueCard && ev.address && (
                  <div className="mb-4">
                    <VenueCard
                      address={ev.address}
                      countryCode={ev.country}
                      locale={locale}
                      labels={{ venue: s.label, viewMap: dict.event.viewMap }}
                    />
                  </div>
                )}
                {s.html.trim() && (
                  <div
                    className="prose-band text-grey-800 [&_h3]:mt-6 [&_h3]:font-display [&_h3]:text-xl [&_img]:my-4 [&_img]:rounded-lg [&_li]:my-1 [&_p]:my-3 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5"
                    dangerouslySetInnerHTML={{ __html: s.html }}
                  />
                )}
              </section>
            ))}
            {/* 항공 — 행사 기간·목적지가 채워진 항공권 검색(제휴) */}
            {showFlights && (
              <FlightSection
                destination={dest.iata}
                destinationLabel={dest.label}
                destinationNote={dest.nearCity}
                startAt={ev.startAt}
                endAt={ev.endAt}
                locale={locale}
                campaign={product.slug || product.code || product.id}
                labels={travelLabels}
              />
            )}
            {/* 숙박 — 베뉴 주변 숙소 지도(제휴) */}
            {showStay && (
              <StaySection
                address={ev.address}
                addressText={stayAddressText}
                startAt={ev.startAt}
                endAt={ev.endAt}
                locale={locale}
                campaign={product.slug || product.code || product.id}
                labels={travelLabels}
              />
            )}
            {/* 관련 SNS 링크 (인스타·유튜브·페북·틱톡) — 값이 있는 것만 버튼으로 노출 */}
            {socialLinks.length > 0 && (
              <section id="links" className="scroll-mt-24">
                <h2 className="mb-4 border-l-4 border-primary pl-3 font-display text-2xl font-bold">
                  {dict.event.relatedLinks}
                </h2>
                <div className="flex flex-wrap gap-2.5">
                  {socialLinks.map(({ key, label, Icon, url }) => (
                    <a
                      key={key}
                      href={normalizeUrl(url)}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      aria-label={label}
                      title={label}
                      className="inline-flex items-center gap-2 rounded-full border border-grey-200 bg-white px-4 py-2.5 text-sm font-semibold text-grey-800 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
                    >
                      <Icon size={18} />
                      <span>{label}</span>
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* 메타 정보 + 신청 — 모바일에선 하단(결제정보 아래로), 데스크톱은 우측 sticky */}
          <aside id="tickets" className="order-2 min-w-0 scroll-mt-24 lg:order-2 lg:sticky lg:top-20">
            <div className="space-y-4 rounded-xl border border-grey-200 p-4">
              <dl className="divide-y divide-grey-100">
                {dateText && (
                  <Row label={dict.event.date}>
                    <span>{dateText}</span>
                    {calUrl && (
                      <a
                        href={calUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        <CalendarPlus size={14} /> {dict.event.addCalendar}
                      </a>
                    )}
                  </Row>
                )}
                {periodText && (
                  <Row label={dict.event.period}>
                    <span>{periodText}</span>
                    <span
                      className={`ml-2 rounded-pill px-2.5 py-0.5 text-xs font-medium ${
                        applyOpen ? 'bg-success/10 text-success' : 'bg-grey-100 text-grey-500'
                      }`}
                    >
                      {applyOpen ? dict.event.open : dict.event.closed}
                    </span>
                  </Row>
                )}
                {!hasTickets && <Row label={dict.event.cost}>{costText || '—'}</Row>}
                {location && <Row label={dict.event.location}>{location}</Row>}
              </dl>

              {hasTickets ? (
                /* 티켓 여러 개 — 티켓별 수량 선택 후 담기/결제 (모바일·데스크톱 공통) */
                <div className="border-t border-grey-100 pt-3">
                  <TicketPurchase
                    tickets={purchaseTickets}
                    base={cartItem}
                    locale={locale}
                    currency={currency as Currency}
                    country={ev.country}
                    labels={{
                      addToCart: soldout ? dict.event.soldout : dict.product.addToCart,
                      added: dict.product.added,
                      pay: dict.cart.pay,
                      total: dict.cart.total,
                      saleActive: dict.event.saleActive,
                      saleUpcoming: dict.event.saleUpcoming,
                      saleEnded: dict.event.saleEnded,
                      remaining: dict.event.remaining,
                      soldOut: dict.event.soldout,
                      saleUntil: dict.event.saleUntil,
                    }}
                    disabled={soldout || !applyOpen}
                  />
                </div>
              ) : (
                <>
                  {/* 가격 강조 (신청 버튼 위) */}
                  <div className="flex items-baseline justify-between border-t border-grey-100 pt-3">
                    <span className="label-caps text-grey-500">{dict.event.cost}</span>
                    <span className="font-display text-2xl font-bold text-grey-900">{costText || '—'}</span>
                  </div>

                  {/* 데스크톱: 장바구니 담기 + 결제하기 */}
                  <div className="hidden md:block">
                    <AddToCartButton
                      item={cartItem}
                      label={soldout ? dict.event.soldout : dict.product.addToCart}
                      addedLabel={dict.product.added}
                      disabled={soldout || !applyOpen}
                    />
                    <CheckoutNowButton
                      item={cartItem}
                      label={dict.cart.pay}
                      disabled={soldout || !applyOpen}
                    />
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* 모바일 고정 바: 장바구니 담기 + 결제하기 (티켓 선택형은 사이드바 셀렉터가 대신) */}
      {!hasTickets && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-grey-200 bg-white p-3 md:hidden">
          <AddToCartButton
            item={cartItem}
            label={soldout ? dict.event.soldout : dict.product.addToCart}
            addedLabel={dict.product.added}
            disabled={soldout || !applyOpen}
          />
          <CheckoutNowButton
            item={cartItem}
            label={dict.cart.pay}
            disabled={soldout || !applyOpen}
          />
        </div>
      )}
    </article>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-x-3 gap-y-1 px-4 py-3 text-sm">
      <dt className="w-24 shrink-0 break-words leading-tight label-caps text-grey-500">{label}</dt>
      <dd className="flex min-w-0 flex-1 flex-wrap items-center text-grey-800">{children}</dd>
    </div>
  );
}
