// 행사패스 마스터 엑셀 내려받기 — 목록 상단 '엑셀' 버튼이 호출한다.
// 목록은 페이지네이션(20건)이지만 여기선 내 행사패스 '전부'를 받아 4개 시트로 펼친다.
//   1) 행사패스   — 패스 1건 = 1행 (기본정보·일정·장소·주최자·대상·SNS·SEO)
//   2) 티켓·가격  — 패스 × 티켓 × 가격구간 = 1행 (정식가/123Band 판매가, USD·KRW·서브통화)
//   3) 상세 섹션  — 패스 × 섹션 × (EN/KO) 본문 (HTML → 읽기 좋은 평문)
//   4) 미디어·라인업 — 이미지/동영상/공연자 목록
import { NextResponse } from 'next/server';
import {
  EVENT_SECTION_KEYS,
  SUB_CURRENCIES,
  pickI18n,
  toDisplayAmount,
  type Currency,
  type EventContent,
  type EventPerformer,
  type EventPriceTier,
  type EventTicketTier,
  type I18n,
  type Locale,
  type Prices,
} from '@123band/shared';
import { requireStaff } from '@/lib/ai/guard';
import { buildXlsx, type XlsxCell, type XlsxColumn } from '@/lib/xlsx';

// node:zlib 를 쓰므로 Edge 가 아닌 Node 런타임. 매 요청 최신 데이터.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WEB_BASE = process.env.NEXT_PUBLIC_WEB_URL ?? 'https://123band-web.vercel.app';

// select('*') 결과 — 0035(slug) 미적용 환경도 있어 신규 컬럼은 선택 필드로 둔다.
interface ProductRow {
  id: string;
  code: string | null;
  status: string;
  name_i18n: I18n | null;
  prices: Prices | null;
  image_url: string | null;
  detail_html_i18n: I18n | null;
  event_content: EventContent | null;
  reviews_enabled?: boolean | null;
  qna_enabled?: boolean | null;
  slug?: string | null;
  created_at: string;
  updated_at: string;
}

// ── 표기 유틸 ────────────────────────────────────────────────
/** HTML → 평문. 블록 태그는 줄바꿈으로 바꿔 셀 안에서도 문단이 보이게 한다. */
function htmlToText(html: string): string {
  return html
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '· ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** i18n 필드에서 '그 언어에 실제로 있는 값'만 — 폴백하지 않는다.
 *  마스터 파일에서 빈 칸은 '아직 그 언어로 안 썼다'는 신호라야 번역 누락을 찾을 수 있다.
 *  레거시 문자열(주소/공연자명)은 저장 규칙대로 EN 으로 읽는다. */
function locText(v: I18n | string | null | undefined, locale: 'en' | 'ko'): string {
  if (!v) return '';
  if (typeof v === 'string') return locale === 'en' ? v.trim() : '';
  return (v[locale] ?? '').trim();
}

const KST = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Seoul',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
});

/** 일시 → 'YYYY-MM-DD HH:mm'.
 *  타임존이 붙은 값(created_at 등 DB 타임스탬프)은 KST 로 환산하고,
 *  마법사가 저장한 datetime-local(행사 일정)은 입력된 그대로 둔다(현지 시각 기준). */
function dateText(v?: string | null): string {
  const s = (v ?? '').trim();
  if (!s) return '';
  if (s.includes('T') && /(?:Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return KST.format(d).replace('T', ' ');
  }
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}` : s;
}

/** 최소단위 정수 → 표시 단위 숫자(엑셀 숫자 셀). 값 없으면 빈 셀. */
function amount(minor: number | null | undefined, currency: Currency): XlsxCell {
  return minor == null ? '' : toDisplayAmount(minor, currency);
}

function yesNo(v: unknown, L: Dict): string {
  return v === false ? L.no : L.yes;
}

/** 코드값 → 사전 라벨. 사전에 없는 값(레거시)은 코드 그대로 남긴다. */
function label(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return '';
  return map[key] ?? key;
}

// ── 라벨(엑셀 헤더/값) — UI 언어를 따른다 ────────────────────
const KO = {
  yes: '사용',
  no: '미사용',
  files: { passes: '행사패스', tickets: '티켓·가격', sections: '상세 섹션', media: '미디어·라인업' },
  fileName: '행사패스_마스터',
  status: { draft: '초안', pending: '승인대기', active: '판매중', soldout: '품절', inactive: '숨김', suspended: '정지' },
  eventType: {
    festival: '페스티벌', congress: '콩그레스', workshop: '워크숍', bootcamp: '부트캠프',
    party: '파티', social: '소셜', competition: '대회', other: '기타',
  },
  ticketType: {
    full_pass: '풀패스', day_pass: '데이패스', party_pass: '파티패스',
    hotel: '호텔', shuttle: '셔틀', other: '기타',
  },
  feeMode: { client: '구매자 부담', absorb: '주최자 부담' },
  level: { beginner: '초급', intermediate: '중급', advanced: '고급' },
  attendeesLocation: { local: '지역', national: '국내', international: '국제' },
  section: {
    about: '소개', inclusions: '티켓 포함 사항', venue: '장소', notice: '공지', contact: '문의',
    channel: '채널', recommend: '추천', refund: '환불규정', detail: '상세 본문',
  },
  mediaKind: { image: '미디어', video: '동영상', performer: '공연자' },
  h: {
    no: '번호', code: '코드', id: '패스 ID', status: '상태',
    nameEn: '행사패스명 (EN)', nameKo: '행사패스명 (KO)',
    eventType: '행사 유형', country: '국가',
    startAt: '시작 일시', endAt: '종료 일시', applyStart: '신청 시작', applyEnd: '신청 마감',
    venueEn: '베뉴 (EN)', venueKo: '베뉴 (KO)', addrEn: '주소 (EN)', addrKo: '주소 (KO)',
    cityEn: '도시 (EN)', cityKo: '도시 (KO)', provinceEn: '시/도 (EN)', provinceKo: '시/도 (KO)',
    postalCode: '우편번호', lat: '위도', lng: '경도', mapUrl: '지도 링크',
    orgNameEn: '주최자 (EN)', orgNameKo: '주최자 (KO)', orgContact: '주최자 연락처',
    orgEmail: '주최자 이메일', orgSns: '주최자 SNS', orgLogo: '주최자 로고',
    repUsd: '대표가 (USD)', repKrw: '대표가 (KRW)',
    priceTextEn: '비용 표기 (EN)', priceTextKo: '비용 표기 (KO)',
    ticketCount: '티켓 종류 수', attendees: '예상 참가자', attendeesLocation: '참가자 출신',
    levels: '추천 레벨', danceStyles: '댄스 스타일',
    instagram: '인스타그램', youtube: '유튜브', facebook: '페이스북', tiktok: '틱톡',
    seoTitleEn: 'SEO 제목 (EN)', seoTitleKo: 'SEO 제목 (KO)',
    seoDescEn: 'SEO 설명 (EN)', seoDescKo: 'SEO 설명 (KO)', seoKeywords: 'SEO 키워드',
    reviews: '후기', qna: '문의(Q&A)',
    imageUrl: '대표 이미지', mediaCount: '미디어 수', videoCount: '동영상 수',
    slug: '검색 주소', pageUrl: '고객 페이지', createdAt: '등록일', updatedAt: '수정일',
    passCode: '패스 코드', passName: '행사패스명',
    ticketNo: '티켓 번호', ticketNameEn: '티켓명 (EN)', ticketNameKo: '티켓명 (KO)',
    ticketType2: '패스 종류', units: '판매 수량', fee: '수수료 부담',
    tierNo: '구간', tierLabel: '구간명', until: '구간 마감',
    listPrice: '정식가', wolfPrice: '123Band 판매가',
    sectionKey: '섹션', contentEn: '내용 (EN)', contentKo: '내용 (KO)',
    kind: '구분', order: '순번', url: 'URL',
    performerEn: '이름 (EN)', performerKo: '이름 (KO)',
    roleEn: '역할 (EN)', roleKo: '역할 (KO)', sns: 'SNS',
  },
};

/** 사전 모양은 KO 가 기준 — EN 에 키가 빠지면 타입 에러로 잡힌다. */
type Dict = typeof KO;

const EN: Dict = {
  yes: 'On',
  no: 'Off',
  files: { passes: 'Event Passes', tickets: 'Tickets & Prices', sections: 'Detail Sections', media: 'Media & Lineup' },
  fileName: 'event-passes-master',
  status: { draft: 'Draft', pending: 'Pending', active: 'Active', soldout: 'Sold out', inactive: 'Hidden', suspended: 'Suspended' },
  eventType: {
    festival: 'Festival', congress: 'Congress', workshop: 'Workshop', bootcamp: 'Bootcamp',
    party: 'Party', social: 'Social', competition: 'Competition', other: 'Other',
  },
  ticketType: {
    full_pass: 'Full pass', day_pass: 'Day pass', party_pass: 'Party pass',
    hotel: 'Hotel', shuttle: 'Shuttle', other: 'Other',
  },
  feeMode: { client: 'Buyer pays', absorb: 'Organizer pays' },
  level: { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' },
  attendeesLocation: { local: 'Local', national: 'National', international: 'International' },
  section: {
    about: 'About', inclusions: 'Ticket Inclusions', venue: 'Venue', notice: 'Notice', contact: 'Contact',
    channel: 'Channel', recommend: 'Recommend', refund: 'Refund', detail: 'Detail body',
  },
  mediaKind: { image: 'Media', video: 'Video', performer: 'Performer' },
  h: {
    no: 'No.', code: 'Code', id: 'Pass ID', status: 'Status',
    nameEn: 'Event pass (EN)', nameKo: 'Event pass (KO)',
    eventType: 'Event type', country: 'Country',
    startAt: 'Starts', endAt: 'Ends', applyStart: 'Apply from', applyEnd: 'Apply until',
    venueEn: 'Venue (EN)', venueKo: 'Venue (KO)', addrEn: 'Address (EN)', addrKo: 'Address (KO)',
    cityEn: 'City (EN)', cityKo: 'City (KO)', provinceEn: 'Province (EN)', provinceKo: 'Province (KO)',
    postalCode: 'Postal code', lat: 'Latitude', lng: 'Longitude', mapUrl: 'Map link',
    orgNameEn: 'Organizer (EN)', orgNameKo: 'Organizer (KO)', orgContact: 'Organizer contact',
    orgEmail: 'Organizer email', orgSns: 'Organizer SNS', orgLogo: 'Organizer logo',
    repUsd: 'Headline price (USD)', repKrw: 'Headline price (KRW)',
    priceTextEn: 'Cost note (EN)', priceTextKo: 'Cost note (KO)',
    ticketCount: 'Ticket types', attendees: 'Est. attendees', attendeesLocation: 'Attendees from',
    levels: 'Levels', danceStyles: 'Dance styles',
    instagram: 'Instagram', youtube: 'YouTube', facebook: 'Facebook', tiktok: 'TikTok',
    seoTitleEn: 'SEO title (EN)', seoTitleKo: 'SEO title (KO)',
    seoDescEn: 'SEO description (EN)', seoDescKo: 'SEO description (KO)', seoKeywords: 'SEO keywords',
    reviews: 'Reviews', qna: 'Q&A',
    imageUrl: 'Cover image', mediaCount: 'Media count', videoCount: 'Video count',
    slug: 'Slug', pageUrl: 'Customer page', createdAt: 'Created', updatedAt: 'Updated',
    passCode: 'Pass code', passName: 'Event pass',
    ticketNo: 'Ticket #', ticketNameEn: 'Ticket (EN)', ticketNameKo: 'Ticket (KO)',
    ticketType2: 'Ticket type', units: 'Units', fee: 'Fees',
    tierNo: 'Tier', tierLabel: 'Tier label', until: 'Tier deadline',
    listPrice: 'List price', wolfPrice: '123Band price',
    sectionKey: 'Section', contentEn: 'Content (EN)', contentKo: 'Content (KO)',
    kind: 'Kind', order: 'Order', url: 'URL',
    performerEn: 'Name (EN)', performerKo: 'Name (KO)',
    roleEn: 'Role (EN)', roleKo: 'Role (KO)', sns: 'SNS',
  },
};

/** 국가 코드(ISO2) → 표시명. 코드가 아니면(레거시 자유입력) 그대로. */
function countryLabel(code: string | undefined, locale: Locale): string {
  if (!code) return '';
  if (!/^[A-Z]{2}$/.test(code)) return code;
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

// ── 시트 조립 ────────────────────────────────────────────────
function passesSheet(rows: ProductRow[], L: Dict, locale: Locale) {
  const H = L.h;
  const columns: XlsxColumn[] = [
    { header: H.no, width: 6 },
    { header: H.code, width: 16 },
    { header: H.status, width: 10 },
    { header: H.nameEn, width: 34 },
    { header: H.nameKo, width: 34 },
    { header: H.eventType, width: 12 },
    { header: H.country, width: 14 },
    { header: H.startAt, width: 17 },
    { header: H.endAt, width: 17 },
    { header: H.applyStart, width: 17 },
    { header: H.applyEnd, width: 17 },
    { header: H.venueEn, width: 26 },
    { header: H.venueKo, width: 26 },
    { header: H.addrEn, width: 34, wrap: true },
    { header: H.addrKo, width: 34, wrap: true },
    { header: H.cityEn, width: 16 },
    { header: H.cityKo, width: 16 },
    { header: H.provinceEn, width: 16 },
    { header: H.provinceKo, width: 16 },
    { header: H.postalCode, width: 12 },
    { header: H.lat, width: 12 },
    { header: H.lng, width: 12 },
    { header: H.mapUrl, width: 30, wrap: true },
    { header: H.orgNameEn, width: 24 },
    { header: H.orgNameKo, width: 24 },
    { header: H.orgContact, width: 20 },
    { header: H.orgEmail, width: 24 },
    { header: H.orgSns, width: 24 },
    { header: H.orgLogo, width: 24, wrap: true },
    { header: H.repUsd, width: 14 },
    { header: H.repKrw, width: 14 },
    { header: H.priceTextEn, width: 20, wrap: true },
    { header: H.priceTextKo, width: 20, wrap: true },
    { header: H.ticketCount, width: 12 },
    { header: H.attendees, width: 12 },
    { header: H.attendeesLocation, width: 14 },
    { header: H.levels, width: 20 },
    { header: H.danceStyles, width: 32, wrap: true },
    { header: H.instagram, width: 26, wrap: true },
    { header: H.youtube, width: 26, wrap: true },
    { header: H.facebook, width: 26, wrap: true },
    { header: H.tiktok, width: 26, wrap: true },
    { header: H.seoTitleEn, width: 30, wrap: true },
    { header: H.seoTitleKo, width: 30, wrap: true },
    { header: H.seoDescEn, width: 40, wrap: true },
    { header: H.seoDescKo, width: 40, wrap: true },
    { header: H.seoKeywords, width: 34, wrap: true },
    { header: H.reviews, width: 10 },
    { header: H.qna, width: 10 },
    { header: H.imageUrl, width: 30, wrap: true },
    { header: H.mediaCount, width: 10 },
    { header: H.videoCount, width: 10 },
    { header: H.slug, width: 28, wrap: true },
    { header: H.pageUrl, width: 40, wrap: true },
    { header: H.id, width: 38 },
    { header: H.createdAt, width: 17 },
    { header: H.updatedAt, width: 17 },
  ];

  const data: XlsxCell[][] = rows.map((p, i) => {
    const ec = p.event_content ?? {};
    const a = ec.address ?? {};
    const org = ec.organizer ?? {};
    const aud = ec.audience ?? {};
    const links = ec.links ?? {};
    const seo = ec.seo ?? {};
    const slug = p.slug ?? '';
    return [
      i + 1,
      p.code ?? '',
      label(L.status, p.status),
      p.name_i18n?.en ?? '',
      p.name_i18n?.ko ?? '',
      label(L.eventType, ec.eventType),
      countryLabel(ec.country, locale),
      dateText(ec.startAt),
      dateText(ec.endAt),
      dateText(ec.applyStart),
      dateText(ec.applyEnd),
      locText(a.venue, 'en'),
      locText(a.venue, 'ko'),
      locText(a.line1, 'en'),
      locText(a.line1, 'ko'),
      locText(a.city, 'en'),
      locText(a.city, 'ko'),
      locText(a.province, 'en'),
      locText(a.province, 'ko'),
      a.postalCode ?? '',
      a.lat ?? '',
      a.lng ?? '',
      a.mapUrl ?? '',
      org.name?.en ?? '',
      org.name?.ko ?? '',
      org.contact ?? '',
      org.email ?? '',
      org.sns ?? '',
      org.logo ?? '',
      amount(p.prices?.USD, 'USD'),
      amount(p.prices?.KRW, 'KRW'),
      ec.priceText?.en ?? '',
      ec.priceText?.ko ?? '',
      (ec.tickets ?? []).length,
      aud.estimatedAttendees ?? '',
      label(L.attendeesLocation, aud.attendeesLocation),
      (aud.levels ?? []).map((l) => label(L.level, l)).join(', '),
      (aud.danceStyles ?? []).join(', '),
      links.instagram ?? '',
      links.youtube ?? '',
      links.facebook ?? '',
      links.tiktok ?? '',
      seo.title?.en ?? '',
      seo.title?.ko ?? '',
      seo.description?.en ?? '',
      seo.description?.ko ?? '',
      (seo.keywords ?? []).join(', '),
      yesNo(p.reviews_enabled, L),
      yesNo(p.qna_enabled, L),
      p.image_url ?? '',
      (ec.media ?? []).filter(Boolean).length,
      (ec.videos ?? []).filter(Boolean).length,
      slug,
      `${WEB_BASE}/${locale}/products/${slug || p.id}`,
      p.id,
      dateText(p.created_at),
      dateText(p.updated_at),
    ];
  });

  return { name: L.files.passes, columns, rows: data };
}

function ticketsSheet(rows: ProductRow[], L: Dict, locale: Locale) {
  const H = L.h;
  const cur: Currency[] = ['USD', 'KRW', ...SUB_CURRENCIES];
  const columns: XlsxColumn[] = [
    { header: H.passCode, width: 16 },
    { header: H.passName, width: 32 },
    { header: H.ticketNo, width: 8 },
    { header: H.ticketNameEn, width: 26 },
    { header: H.ticketNameKo, width: 26 },
    { header: H.ticketType2, width: 12 },
    { header: H.units, width: 10 },
    { header: H.fee, width: 14 },
    { header: H.tierNo, width: 7 },
    { header: H.tierLabel, width: 14 },
    { header: H.until, width: 17 },
    ...cur.map((c) => ({ header: `${H.listPrice} ${c}`, width: 14 })),
    ...cur.map((c) => ({ header: `${H.wolfPrice} ${c}`, width: 14 })),
  ];

  const data: XlsxCell[][] = [];
  for (const p of rows) {
    const passName = pickI18n(p.name_i18n, locale) || p.code || p.id;
    const tickets = (p.event_content?.tickets ?? []) as EventTicketTier[];
    tickets.forEach((t, ti) => {
      // 가격구간이 없으면 레거시 단일가(price)를 1구간처럼 한 줄로 남긴다.
      const tiers: EventPriceTier[] = t.priceTiers?.length
        ? t.priceTiers
        : [{ listPrice: t.price?.USD, listPriceKrw: t.price?.KRW }];
      tiers.forEach((pt, pi) => {
        const list: Prices = {
          USD: pt.listPrice,
          KRW: pt.listPriceKrw,
          ...(pt.listPricesSub ?? {}),
        };
        const wolf: Prices = {
          USD: pt.wolfPrice,
          KRW: pt.wolfPriceKrw,
          ...(pt.wolfPricesSub ?? {}),
        };
        data.push([
          p.code ?? '',
          passName,
          ti + 1,
          t.name?.en ?? '',
          t.name?.ko ?? '',
          label(L.ticketType, t.type),
          t.units ?? '',
          label(L.feeMode, t.feeMode),
          pi + 1,
          pt.label ?? '',
          dateText(pt.until),
          ...cur.map((c) => amount(list[c], c)),
          ...cur.map((c) => amount(wolf[c], c)),
        ]);
      });
    });
  }

  return { name: L.files.tickets, columns, rows: data };
}

function sectionsSheet(rows: ProductRow[], L: Dict, locale: Locale) {
  const H = L.h;
  const columns: XlsxColumn[] = [
    { header: H.passCode, width: 16 },
    { header: H.passName, width: 32 },
    { header: H.sectionKey, width: 14 },
    { header: H.contentEn, width: 70, wrap: true },
    { header: H.contentKo, width: 70, wrap: true },
  ];

  const data: XlsxCell[][] = [];
  for (const p of rows) {
    const passName = pickI18n(p.name_i18n, locale) || p.code || p.id;
    const sections = p.event_content?.sections ?? {};
    // 섹션 키 + 상세 본문(detail_html_i18n)을 한 시트에서 훑는다.
    const entries: [string, I18n | undefined][] = [
      ...EVENT_SECTION_KEYS.map((k) => [k, sections[k]] as [string, I18n | undefined]),
      ['detail', p.detail_html_i18n ?? undefined],
    ];
    for (const [key, v] of entries) {
      const en = htmlToText(v?.en ?? '');
      const ko = htmlToText(v?.ko ?? '');
      if (!en && !ko) continue; // 비어 있는 섹션은 행을 만들지 않는다
      data.push([p.code ?? '', passName, label(L.section, key), en, ko]);
    }
  }

  return { name: L.files.sections, columns, rows: data };
}

function mediaSheet(rows: ProductRow[], L: Dict, locale: Locale) {
  const H = L.h;
  const columns: XlsxColumn[] = [
    { header: H.passCode, width: 16 },
    { header: H.passName, width: 32 },
    { header: H.kind, width: 12 },
    { header: H.order, width: 7 },
    { header: H.url, width: 56, wrap: true },
    { header: H.performerEn, width: 22 },
    { header: H.performerKo, width: 22 },
    { header: H.roleEn, width: 18 },
    { header: H.roleKo, width: 18 },
    { header: H.sns, width: 30, wrap: true },
  ];

  const data: XlsxCell[][] = [];
  for (const p of rows) {
    const passName = pickI18n(p.name_i18n, locale) || p.code || p.id;
    const ec = p.event_content ?? {};
    (ec.media ?? []).filter(Boolean).forEach((url, i) => {
      data.push([p.code ?? '', passName, L.mediaKind.image, i + 1, url, '', '', '', '', '']);
    });
    (ec.videos ?? []).filter(Boolean).forEach((url, i) => {
      data.push([p.code ?? '', passName, L.mediaKind.video, i + 1, url, '', '', '', '', '']);
    });
    ((ec.performers ?? []) as EventPerformer[]).forEach((f, i) => {
      data.push([
        p.code ?? '',
        passName,
        L.mediaKind.performer,
        i + 1,
        f.image ?? '',
        locText(f.name, 'en'),
        locText(f.name, 'ko'),
        locText(f.role, 'en'),
        locText(f.role, 'ko'),
        f.sns ?? '',
      ]);
    });
  }

  return { name: L.files.media, columns, rows: data };
}

// ── 라우트 ───────────────────────────────────────────────────
export async function GET(req: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const locale: Locale = new URL(req.url).searchParams.get('locale') === 'ko' ? 'ko' : 'en';
  const L = locale === 'ko' ? KO : EN;

  // 내 행사패스 전부 (RLS: products_seller_write 로 자기 것만 보인다).
  // slug 컬럼(0035)이 아직 없는 환경도 있어 select * 로 받는다.
  const { data, error } = await auth.supabase
    .from('products')
    .select('*')
    .eq('product_type', 'ticket')
    .eq('seller_id', auth.userId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as ProductRow[];
  const file = buildXlsx([
    passesSheet(rows, L, locale),
    ticketsSheet(rows, L, locale),
    sectionsSheet(rows, L, locale),
    mediaSheet(rows, L, locale),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const name = `${L.fileName}_${today}.xlsx`;
  // Response 본문은 ArrayBuffer 만 받는다(Buffer/Uint8Array 불가) — 풀링된 버퍼에서 이 파일 구간만 떼어낸다.
  const body = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
  return new NextResponse(body, {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      // 한글 파일명은 filename* (RFC 5987) 로 — 구형 대비 ASCII 폴백도 함께 준다.
      'content-disposition': `attachment; filename="event-passes-master_${today}.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'cache-control': 'no-store',
    },
  });
}
