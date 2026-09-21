// Design Ref: §7 SEO — 상품/행사 상세의 공용 구현.
//
// 라우트는 셋인데 화면은 하나다:
//   /{locale}/events/{slug}    티켓(행사) 정식 URL
//   /{locale}/shop/{slug}      그 외 상품 정식 URL
//   /{locale}/products/{uuid}  레거시 — 슬러그가 있으면 위로 301, 없으면 그대로 렌더
// 정식 경로 계산의 단일 소스는 @123band/shared 의 productRelPath() 다.
import type { Metadata } from 'next';
import {
  pickI18n,
  addrText,
  formatPostalAddress,
  postalAddressNode,
  mapLink,
  isValidGeo,
  activeTicketTier,
  baseCurrency,
  tierPrices,
  pickPrice,
  toDisplayAmount,
  buildEventTitle,
  countryLabel,
  isUuid,
  productRelPath,
  TITLE_SHARE_MAX_WIDTH,
  type Locale,
  type EventContent,
} from '@123band/shared';
import { getDictionary, type Dictionary } from '@/i18n/dictionaries';
import {
  getProduct,
  getProductBySlug,
  getProductByPreviousSlug,
  getTicketSoldCounts,
  type ProductDetail as Product,
} from '@/lib/queries/product';
import { getProductReviews, type ReviewData } from '@/lib/queries/reviews';
import { getProductQna } from '@/lib/queries/qna';
import { ProductDetail } from '@/components/product/ProductDetail';
import { EventDetail } from '@/components/product/EventDetail';
import { ProductReviews } from '@/components/product/ProductReviews';
import { ProductQna } from '@/components/product/ProductQna';
import { EventFeedback } from '@/components/product/EventFeedback';
import { breadcrumbJsonLd, hreflangAlternates, localePath, OG_IMAGE, SITE, SITE_NAME } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { EventLiveCta } from '@/components/live/LiveEntry';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
function clamp(s: string, n = 160): string {
  const t = s.trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
}
// datetime-local(KST 관례) → ISO(+09:00). 이미 오프셋/Z 있으면 그대로.
function toIsoKst(s?: string): string | undefined {
  if (!s) return undefined;
  if (/[+Z]/.test(s)) return s;
  const withSec = /T\d\d:\d\d$/.test(s) ? `${s}:00` : s;
  return `${withSec}+09:00`;
}

// i18n(또는 레거시 string) → 현재 로케일 텍스트(폴백: 반대 로케일).
function pickL(v: Parameters<typeof pickI18n>[0], locale: Locale): string {
  const alt: Locale = locale === 'ko' ? 'en' : 'ko';
  return pickI18n(v, locale) || pickI18n(v, alt);
}

// 상세 이미지 목록(중복 제거) — 대표 이미지 + 히어로 배너. 없으면 기본 OG.
function imageList(product: Product, locale: Locale): string[] {
  const ec = product.event_content ?? undefined;
  const out: string[] = [];
  const banner = ec?.banner ? pickL(ec.banner, locale) : '';
  for (const u of [product.image_url ?? '', banner]) {
    if (/^https?:\/\//.test(u) && !out.includes(u)) out.push(u);
  }
  return out.length ? out : [OG_IMAGE];
}

// 행사 장소 → schema.org Place. 로컬 검색 신호의 핵심 노드.
// name(베뉴) + address(PostalAddress) + geo(좌표) + hasMap(지도) 을 최대한 채운다.
// 값이 전혀 없으면 undefined → Event.location 자체를 생략한다.
function placeNode(ec: EventContent, locale: Locale): Record<string, unknown> | undefined {
  const a = ec.address;
  const venue = addrText(a?.venue, locale);
  const address = postalAddressNode(a, ec.country, locale);
  // 국가는 ISO2 코드로 넘긴다 — 표시명 변환·중복 판정을 헬퍼가 맡는다.
  const addressText = formatPostalAddress(a, locale, ec.country); // 구조화가 비면 문자열 폴백
  const map = mapLink(a, locale, ec.country);
  // 베뉴명이 없으면 도시로 대체 — Place.name 이 비면 리치결과 적격성이 떨어진다.
  const name = venue || addrText(a?.city, locale) || countryLabel(ec.country, locale);
  if (!name && !address && !addressText) return undefined;
  return {
    '@type': 'Place',
    ...(name ? { name } : {}),
    ...(address ? { address } : addressText ? { address: addressText } : {}),
    ...(a && isValidGeo(a.lat, a.lng)
      ? { geo: { '@type': 'GeoCoordinates', latitude: a.lat, longitude: a.lng } }
      : {}),
    ...(map ? { hasMap: map } : {}),
  };
}

// 후기 요약 → AggregateRating (검색결과 별점). 후기 0개면 undefined.
function aggregateRating(reviews?: ReviewData | null): Record<string, unknown> | undefined {
  if (!reviews || reviews.count < 1) return undefined;
  return {
    '@type': 'AggregateRating',
    ratingValue: Math.round(reviews.average * 10) / 10,
    reviewCount: reviews.count,
    bestRating: 5,
    worstRating: 1,
  };
}

// 개별 후기 → schema.org Review(최대 10개).
function reviewNodes(reviews?: ReviewData | null): Record<string, unknown>[] | undefined {
  if (!reviews || reviews.count < 1) return undefined;
  return reviews.reviews.slice(0, 10).map((r) => ({
    '@type': 'Review',
    reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
    author: { '@type': 'Person', name: r.author_name || 'Guest' },
    ...(r.content ? { reviewBody: r.content } : {}),
    datePublished: r.created_at,
  }));
}

// 유튜브 URL → VideoObject 노드. uploadDate=상품 최초 게시일(리치결과 필수 필드).
function videoNodes(
  ec: EventContent | null,
  name: string,
  description: string,
  uploadDate: string,
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const url of ec?.videos ?? []) {
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
    if (!m) continue; // 유튜브만 자동 지원(썸네일 규칙 확정). 그 외(비메오/파일)는 데이터 보강 필요.
    const id = m[1];
    out.push({
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name,
      ...(description ? { description } : {}),
      thumbnailUrl: [`https://i.ytimg.com/vi/${id}/hqdefault.jpg`],
      embedUrl: `https://www.youtube.com/embed/${id}`,
      uploadDate,
    });
  }
  return out;
}

// 상품 → SEO 문구(제목/설명/이미지/키워드). generateMetadata·JSON-LD 공용.
function buildSeo(product: Product, locale: Locale) {
  const alt: Locale = locale === 'ko' ? 'en' : 'ko';
  const ec = product.event_content ?? undefined;
  const pick = (v?: Parameters<typeof pickI18n>[0]) => pickI18n(v, locale) || pickI18n(v, alt);

  const name = pick(product.name_i18n) || '123Band';

  // 타이틀 태그 — 규칙은 @123band/shared/seo(buildEventTitle) 단일 소스.
  // 검색용은 60폭 예산(잘림 방지), 공유(OG)용은 88폭 + 브랜드 유지.
  const isEvent = product.product_type === 'ticket' && Boolean(ec);
  const titleInput = {
    locale,
    name,
    manual: pick(ec?.seo?.title),
    eventType: ec?.eventType,
    // 도시 후보 — 오거나이저가 city 를 비우고 주소 문자열에만 도시를 쓰는 경우가 많다.
    // venue(호텔/스튜디오명)는 지역 검색어가 아니므로 후보에서 뺀다.
    cityCandidates: [
      addrText(ec?.address?.city, locale),
      addrText(ec?.address?.province, locale),
      addrText(ec?.address?.line1, locale).split(',')[0],
    ],
    country: countryLabel(ec?.country || ec?.address?.country, locale),
    startAt: ec?.startAt,
    endAt: ec?.endAt,
    intent: isEvent, // 의도어(Tickets/티켓)는 티켓 상품에만
  };
  const title = buildEventTitle(titleInput);
  const shareTitle = buildEventTitle({ ...titleInput, brand: true, maxWidth: TITLE_SHARE_MAX_WIDTH });

  const description =
    clamp(
      pick(ec?.seo?.description) ||
        pick(ec?.subtitle) ||
        stripTags(pick(ec?.sections?.about) || pick(product.detail_html_i18n) || '') ||
        name,
    ) || name;
  const image = product.image_url || OG_IMAGE;
  const keywords = ec?.seo?.keywords?.length ? ec.seo.keywords : undefined;
  return { name, title, shareTitle, description, image, keywords };
}

// ── 라우트 해석 ───────────────────────────────────────────────────────────────

export type ProductRoute =
  /** 이 URL 이 정식 주소 — 그대로 렌더 */
  | { kind: 'render'; product: Product; rel: string }
  /** 다른 주소가 정식 — 301 (레거시 uuid · 옛 슬러그 · 대문자 · 잘못된 섹션) */
  | { kind: 'redirect'; rel: string }
  | { kind: 'notfound' };

/**
 * 라우트 파라미터(슬러그 또는 레거시 uuid) → 렌더/301/404 판정.
 * 한 페이지로 가는 주소를 하나로 모아 색인 신호가 갈라지지 않게 하는 곳이다.
 *
 * @param param  URL 세그먼트 원문
 * @param here   지금 URL 의 로케일 제외 경로 (예: `/events/mbf-…-tickets`)
 */
export async function resolveProductRoute(param: string, here: string): Promise<ProductRoute> {
  // 깨진 퍼센트인코딩(%E0%A4)은 decodeURIComponent 가 던진다 → 500 이 아니라 404 로 처리.
  let raw = '';
  try {
    raw = decodeURIComponent(param ?? '').trim();
  } catch {
    return { kind: 'notfound' };
  }
  if (!raw) return { kind: 'notfound' };

  // 슬러그는 소문자가 정식 — 대문자로 들어온 주소도 찾아서 소문자 주소로 301 한다(중복 URL 방지).
  const product = isUuid(raw) ? await getProduct(raw) : await getProductBySlug(raw.toLowerCase());

  if (product) {
    const rel = productRelPath(product);
    return rel === here ? { kind: 'render', product, rel } : { kind: 'redirect', rel };
  }

  // 옛 슬러그 → 현재 정식 주소로 승계(순위 신호 유지)
  const prev = isUuid(raw) ? null : await getProductByPreviousSlug(raw.toLowerCase());
  if (prev) return { kind: 'redirect', rel: productRelPath(prev) };

  return { kind: 'notfound' };
}

/** generateMetadata 전용 — DB 오류로 메타 생성이 통째로 실패하지 않게 감싼 판정. */
export async function resolveProductRouteSafe(param: string, here: string): Promise<ProductRoute> {
  return resolveProductRoute(param, here).catch(() => ({ kind: 'notfound' }) as ProductRoute);
}

// ── 메타데이터 ────────────────────────────────────────────────────────────────

/** 상세 페이지 Metadata — canonical/hreflang 은 항상 정식 경로(rel) 기준. */
export function productMetadata(opts: {
  locale: Locale;
  product: Product;
  rel: string;
  /** 미승인·미리보기 → 색인 제외(단, canonical 은 정식 URL 유지) */
  hidden: boolean;
}): Metadata {
  const { locale, product, rel, hidden } = opts;
  const { title, shareTitle, description, image, keywords } = buildSeo(product, locale);
  const canonical = localePath(locale, rel);
  return {
    title,
    description,
    ...(keywords ? { keywords } : {}),
    ...(hidden ? { robots: { index: false, follow: false } } : {}),
    alternates: { canonical, languages: hreflangAlternates(rel) },
    openGraph: {
      title: shareTitle,
      description,
      url: canonical,
      siteName: SITE_NAME,
      locale,
      type: 'website',
      images: [{ url: image, alt: shareTitle }],
    },
    twitter: {
      card: 'summary_large_image',
      title: shareTitle,
      description,
      images: [image],
    },
  };
}

/** 없는 상품 / 301 대상 URL 의 메타 — 색인 금지. */
export function noindexMetadata(canonicalPath: string): Metadata {
  return { robots: { index: false, follow: false }, alternates: { canonical: canonicalPath } };
}

// ── 구조화 데이터 ─────────────────────────────────────────────────────────────

// schema.org JSON-LD — 이벤트(티켓)는 Event, 그 외는 Product. 검색 리치결과용.
function buildJsonLd(
  product: Product,
  locale: Locale,
  rel: string,
  reviews?: ReviewData | null,
): Record<string, unknown> {
  const { name, description } = buildSeo(product, locale);
  const image = imageList(product, locale);
  const url = `${SITE}${localePath(locale, rel)}`;
  const availability = `https://schema.org/${product.status === 'soldout' ? 'OutOfStock' : 'InStock'}`;
  const rating = aggregateRating(reviews);
  const revs = reviewNodes(reviews);

  const ec = product.event_content as EventContent | null;
  if (product.product_type === 'ticket' && ec) {
    const place = placeNode(ec, locale);
    const orgName = ec.organizer?.name ? pickL(ec.organizer.name, locale) : '';
    const orgLink = ec.organizer?.sns || ec.organizer?.contact || '';

    // 티켓별 현재 활성 구간가 수집 → AggregateOffer(lowPrice~highPrice).
    // 통화는 실제 입력된 값 기준 — USD 가 없는 행사(바트만 입력)는 행사 국가 통화로 신고한다(환산가 노출 방지).
    const now = Date.now();
    const activePrices = (ec.tickets ?? [])
      .map((t) => activeTicketTier(t.priceTiers, now))
      .filter((a): a is NonNullable<typeof a> => a != null)
      .map(tierPrices);
    const offerCur = baseCurrency(
      activePrices.length > 0 ? activePrices : [product.prices],
      'USD',
      ec.country,
    );
    const amounts: number[] = [];
    for (const p of activePrices) {
      const v = pickPrice(p, offerCur);
      if (v != null) amounts.push(v);
    }
    if (amounts.length === 0 && product.prices?.[offerCur] != null)
      amounts.push(product.prices[offerCur]!);

    const start = toIsoKst(ec.startAt);
    const end = toIsoKst(ec.endAt);
    const validFrom = toIsoKst(ec.applyStart); // 티켓 판매 시작 → offers.validFrom

    // 공연자/라인업 → schema.org Event.performer (이름 없는 항목은 제외)
    const performer: Record<string, unknown>[] = [];
    for (const p of ec.performers ?? []) {
      const nm = p.name ? pickL(p.name, locale) : '';
      if (!nm) continue;
      const link = p.sns || '';
      performer.push({
        '@type': 'Person',
        name: nm,
        ...(p.image ? { image: p.image } : {}),
        ...(/^https?:\/\//.test(link) ? { sameAs: [link] } : {}),
      });
    }

    return {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name,
      ...(description ? { description } : {}),
      image,
      ...(start ? { startDate: start } : {}),
      ...(end ? { endDate: end } : {}),
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      ...(place ? { location: place } : {}),
      ...(orgName
        ? {
            organizer: {
              '@type': 'Organization',
              name: orgName,
              ...(ec.organizer?.logo ? { logo: ec.organizer.logo } : {}),
              ...(ec.organizer?.email ? { email: ec.organizer.email } : {}),
              ...(/^https?:\/\//.test(orgLink) ? { sameAs: [orgLink] } : {}),
            },
          }
        : {}),
      ...(performer.length ? { performer } : {}),
      ...(amounts.length
        ? {
            offers: {
              '@type': 'AggregateOffer',
              priceCurrency: offerCur,
              lowPrice: toDisplayAmount(Math.min(...amounts), offerCur),
              highPrice: toDisplayAmount(Math.max(...amounts), offerCur),
              offerCount: amounts.length,
              availability,
              ...(validFrom ? { validFrom } : {}),
              url,
            },
          }
        : {}),
      ...(rating ? { aggregateRating: rating } : {}),
      ...(revs ? { review: revs } : {}),
      url,
    };
  }

  // 일반 상품(physical/subscription) → Product
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    ...(description ? { description } : {}),
    image,
    ...(product.prices?.USD != null
      ? {
          offers: {
            '@type': 'Offer',
            priceCurrency: 'USD',
            price: toDisplayAmount(product.prices.USD, 'USD'),
            availability,
            url,
          },
        }
      : {}),
    ...(rating ? { aggregateRating: rating } : {}),
    ...(revs ? { review: revs } : {}),
  };
}

// 답변 완료된 상품 문의(QnA) → FAQPage 구조화데이터. 답변 있는 항목이 없으면 null.
function faqJsonLd(
  items: { question: string; answer: string | null }[],
): Record<string, unknown> | null {
  const answered = items.filter((q) => q.answer && q.answer.trim());
  if (answered.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: answered.slice(0, 20).map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: { '@type': 'Answer', text: q.answer as string },
    })),
  };
}

/** 상위 경로 — URL 계층과 브레드크럼을 같은 모양으로 유지한다(검색결과의 경로 표시가 URL 과 일치). */
function parentCrumb(product: Product, dict: Dictionary): { name: string; path: string } {
  return product.product_type === 'ticket'
    ? { name: dict.nav.events, path: '/events' }
    : { name: dict.nav.shop, path: '/shop' };
}

// ── 화면 ──────────────────────────────────────────────────────────────────────

/** 상세 본문 — 세 라우트가 공유한다. rel 은 정식 경로(로케일 제외). */
export async function ProductPageView({
  locale,
  product,
  rel,
  preview,
}: {
  locale: Locale;
  product: Product;
  rel: string;
  preview: boolean;
}) {
  const dict = await getDictionary(locale);
  const isHidden = preview && (product.status === 'draft' || product.status === 'pending');

  const isEvent = product.product_type === 'ticket' && Boolean(product.event_content);
  // 티켓별 판매 수량 — 남은 수량 표시·초과 선택 차단에 쓴다. 티켓 상품일 때만 조회한다.
  const soldCounts = isEvent ? await getTicketSoldCounts(product.id) : {};
  const body = isEvent ? (
    <EventDetail product={product} locale={locale} dict={dict} soldCounts={soldCounts} />
  ) : (
    <ProductDetail product={product} locale={locale} dict={dict} />
  );

  // QnA·후기 는 컴포넌트 + 구조화데이터가 공유 → 각각 한 번만 조회(병렬).
  const [qnaData, reviewData] = await Promise.all([
    product.qna_enabled ? getProductQna(product.id) : Promise.resolve(null),
    product.reviews_enabled ? getProductReviews(product.id) : Promise.resolve(null),
  ]);

  // breadcrumb 항목 (홈 > Events|Shop > 상품명) — URL 계층과 같은 모양.
  const seo = buildSeo(product, locale);
  const seoName = seo.name;
  const crumbs = [
    { name: dict.nav.home, path: '' },
    parentCrumb(product, dict),
    { name: seoName, path: rel },
  ];

  // 검색 리치결과용 구조화 데이터 (Event/Product + Breadcrumb + FAQ). 미리보기(미승인)에서는 생략.
  const structured: object[] = [];
  if (!isHidden) {
    structured.push(buildJsonLd(product, locale, rel, reviewData));
    structured.push(breadcrumbJsonLd(locale, crumbs));
    const faq = qnaData ? faqJsonLd(qnaData.items) : null;
    if (faq) structured.push(faq);
    // 이벤트 동영상(유튜브) → VideoObject 노드
    structured.push(...videoNodes(product.event_content, seoName, seo.description, product.created_at));
  }

  // 게시판 — 오거나이저가 사용 설정한 상품에만 노출. 순서: QnA(문의) → 후기.
  const qna =
    product.qna_enabled && qnaData ? (
      <ProductQna productId={product.id} locale={locale} dict={dict} initial={qnaData} />
    ) : null;
  const reviews = product.reviews_enabled && reviewData ? (
    <ProductReviews
      productId={product.id}
      locale={locale}
      dict={dict}
      initial={reviewData}
    />
  ) : null;

  // 피드백 설문 — 행사(티켓)에만, 주최자가 켰을 때만. 후기 아래에 선다.
  // 남이 낸 답은 보여 주지 않으므로(주최자만 읽는다) 미리 조회할 것이 없다.
  const feedback =
    isEvent && !isHidden && product.feedback_enabled ? (
      <EventFeedback productId={product.id} locale={locale} dict={dict} />
    ) : null;

  return (
    <>
      {structured.length > 0 && <JsonLd data={structured} />}
      {isHidden ? (
        <div className="sticky top-0 z-50 bg-amber-400 px-4 py-2 text-center text-sm font-medium text-black">
          {dict.product.previewNotice}
        </div>
      ) : isEvent ? (
        // 이벤트(티켓) 상세는 히어로가 제목을 크게 보여줘 시각적 브레드크럼을 생략(경로 숨김).
        // 검색 리치결과용 BreadcrumbList JSON-LD 는 그대로 유지된다(structured 배열).
        null
      ) : (
        <Breadcrumbs locale={locale} items={crumbs} />
      )}
      {/* 이 행사의 라이브가 방송 중이면 본문 위에 시청 입구를 낸다(없으면 렌더 안 됨). */}
      {isEvent && !isHidden && <EventLiveCta productId={product.id} locale={locale} dict={dict} />}
      {body}
      {qna}
      {reviews}
      {feedback}
    </>
  );
}
