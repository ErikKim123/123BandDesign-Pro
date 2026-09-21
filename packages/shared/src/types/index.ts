// Design Ref: §3.1 — 공통 도메인 타입 (Domain 레이어, 외부 의존 없음)
// Plan SC: 다국어(*_i18n)·다통화(prices)·타입(product_type)을 1급 개념으로

// ── 기본 유니온 ──────────────────────────────────────────────
export type Locale = 'en' | 'ko' | 'ja' | 'zh-TW';
// USD/KRW = 결제 가능 통화. THB/VND/CNY/JPY = 표시 전용 '서브통화'(오거나이저 입력/AI 환산, 웹 토글로 표시만).
export type Currency = 'USD' | 'KRW' | 'THB' | 'VND' | 'CNY' | 'JPY';
export type Role = 'customer' | 'partner' | 'admin';
export type ProductType = 'physical' | 'ticket' | 'subscription';
export type ProductStatus = 'draft' | 'pending' | 'active' | 'soldout';
export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'shipped'
  | 'done'
  | 'cancelled'
  | 'refunded';
export type PaymentMethod = 'payverse' | 'transfer';
export type ShipmentRegion = 'domestic' | 'overseas';
export type ShipmentStatus = 'preparing' | 'shipped' | 'delivered';
export type PartnerStatus = 'pending' | 'active' | 'suspended';
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled';
export type BoardType = 'notice' | 'qna' | 'review' | 'faq';
export type SectionType = 'hero' | 'slider' | 'featured' | 'category_strip';

// ── 다국어/다통화 표현 ───────────────────────────────────────
/** 언어별 텍스트. 예: { en: "Apparel", ko: "의류" } */
export type I18n = Partial<Record<Locale, string>>;
/** 통화별 금액(최소단위 정수). 예: { USD: 1990, KRW: 2900000 } */
export type Prices = Partial<Record<Currency, number>>;

export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'ko', 'ja', 'zh-TW'];
export const DEFAULT_LOCALE: Locale = 'en';
// 결제 가능 통화(체크아웃/PortOne 채널이 있는 것). 서브통화는 여기 포함하지 않는다.
export const SUPPORTED_CURRENCIES: readonly Currency[] = ['USD', 'KRW'];
export const DEFAULT_CURRENCY: Currency = 'USD';
// 표시 전용 서브통화 — 오거나이저가 입력(또는 AI 환산)하면 웹에서 토글로 보여준다. 결제엔 쓰지 않는다.
export const SUB_CURRENCIES: readonly Currency[] = ['THB', 'VND', 'CNY', 'JPY'];
// 웹 통화 토글 노출 순서(값이 있는 통화만 실제 노출).
export const DISPLAY_CURRENCIES: readonly Currency[] = ['USD', 'KRW', 'THB', 'VND', 'CNY', 'JPY'];

// ── 엔티티 ───────────────────────────────────────────────────
export interface Profile {
  id: string; // = auth.users.id
  email: string | null;
  role: Role;
  name: string | null;
  phone: string | null;
  locale: Locale;
  createdAt: string;
  updatedAt: string;
}

export interface Partner {
  id: string;
  userId: string; // → profiles.id (role=partner)
  companyName: string | null;
  bizNo: string | null;
  commissionRate: number; // 0..1
  settlementInfo: Record<string, unknown> | null;
  status: PartnerStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  code: string | null;
  parentId: string | null; // null = 대분류
  nameI18n: I18n;
  sortOrder: number;
  isVisible: boolean;
}

export interface Product {
  id: string;
  code: string | null;
  sellerId: string; // 자사=admin id, 오거나이저=partner profile id
  isPartnerProduct: boolean;
  productType: ProductType;
  categoryId: string | null;
  nameI18n: I18n;
  detailHtmlI18n: I18n; // 목록 쿼리에서는 제외(성능)
  prices: Prices;
  attributes: Record<string, unknown>; // ticket: {date,seat}, subscription: {tier}
  externalRef: Record<string, unknown> | null; // 123Pass 연동 대비
  aiGenerated: boolean;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

// ── 이벤트(티켓) 페이지 템플릿 ──────────────────────────────
/** 이벤트 앵커 메뉴 = 섹션 키 (렌더/메뉴 순서). 콘텐츠 있는 것만 노출 */
export const EVENT_SECTION_KEYS = [
  'about',
  'inclusions', // 티켓/패스에 포함되는 것 — 소개 바로 다음(구매 판단에 가장 먼저 필요한 정보)
  'venue',
  'notice',
  'contact',
  'channel',
  'recommend',
  'refund',
] as const;
export type EventSectionKey = (typeof EVENT_SECTION_KEYS)[number];

// ── 행사(티켓) 확장 — goandance "Create Event" 레퍼런스 기반 ──
// 모두 products.event_content(jsonb) 인라인. 별도 테이블 미사용(주최자 포함).

/** 행사 유형 (Step1 Event type) */
export const EVENT_TYPE_KEYS = [
  'festival',
  'congress',
  'workshop',
  'bootcamp',
  'party',
  'social',
  'competition',
  'other',
] as const;
export type EventType = (typeof EVENT_TYPE_KEYS)[number];

/** 참가자 추천 레벨 (Step6 Attendees levels) */
export const ATTENDEE_LEVEL_KEYS = ['beginner', 'intermediate', 'advanced'] as const;
export type AttendeeLevel = (typeof ATTENDEE_LEVEL_KEYS)[number];

/** 참가자 주요 출신 (Step6 Attendees location) */
export const ATTENDEES_LOCATION_KEYS = ['local', 'national', 'international'] as const;
export type AttendeesLocation = (typeof ATTENDEES_LOCATION_KEYS)[number];

/** 티켓(패스) 종류 (Step5 Ticket type) */
export const TICKET_TIER_TYPE_KEYS = [
  'full_pass',
  'day_pass',
  'party_pass',
  'hotel',
  'shuttle',
  'other',
] as const;
export type TicketTierType = (typeof TICKET_TIER_TYPE_KEYS)[number];

/** 결제 수수료 부담 주체 (Step5 Fees) */
export type TicketFeeMode = 'client' | 'absorb';

/** 댄스 스타일 — 멀티선택 칩 (Step6 Dancing styles). 값=영문 표준 명칭, 표시도 동일. */
export const DANCE_STYLES = [
  'Bachata', 'Kizomba', 'Salsa',
  'Afro', 'Afro House', 'Bachata Influence', 'Bachazouk', 'Balboa', 'Ballet',
  'Ballroom dancing', 'Belly Dance', 'Bolero', 'Bollywood', 'Break Dance', 'Burlesque',
  'Capoeira', 'Cha Cha Cha', 'Classic dance', 'Contemporary dance', 'Country', 'Cuban Salsa',
  'DanceHall', 'Dembow', 'Dominican Bachata', 'Flamenco', 'Forró', 'Funky', 'Guaguanco',
  'Hip Hop', 'Hula', 'Jazz', 'Krump', 'Kuduru', 'Lady style', 'Lambazouk', 'Lindy Hop',
  'Locking', 'Mambo', 'Merengue', 'Modern dance', 'Oriental dance', 'Pachanga', 'Pilates',
  'Pole Dance', 'Popping', 'Reggaeton', 'Rock & Roll', 'Rumba', 'Samba', 'Semba', 'Swing',
  'Tango', 'Tap dance', 'Twerk', 'Urban', 'Vals', 'West Coast Swing', 'Zouk',
] as const;
export type DanceStyle = (typeof DANCE_STYLES)[number];

/** 국가 선택용 ISO 3166-1 alpha-2 코드 (행사패스 기본 정보).
 *  표시명은 Intl.DisplayNames 로 로케일별 변환하므로 코드만 저장한다. */
export const COUNTRY_CODES = [
  'KR', 'JP', 'CN', 'TW', 'HK', 'SG', 'TH', 'VN', 'PH', 'ID', 'MY', 'IN',
  'US', 'CA', 'MX', 'BR', 'AR', 'CO', 'CL', 'PE',
  'GB', 'FR', 'DE', 'ES', 'IT', 'NL', 'PT', 'CH', 'SE', 'PL', 'RU', 'TR',
  'AU', 'NZ', 'AE', 'EG', 'ZA',
] as const;
export type CountryCode = (typeof COUNTRY_CODES)[number];

/** 국가 코드 → 대표 IANA 타임존 (일정 안내 문구의 현지 시간 표기에 사용).
 *  다중 타임존 국가는 대표 도시 1개로 단순화한다. */
export const COUNTRY_TIMEZONE: Record<CountryCode, string> = {
  KR: 'Asia/Seoul', JP: 'Asia/Tokyo', CN: 'Asia/Shanghai', TW: 'Asia/Taipei',
  HK: 'Asia/Hong_Kong', SG: 'Asia/Singapore', TH: 'Asia/Bangkok', VN: 'Asia/Ho_Chi_Minh',
  PH: 'Asia/Manila', ID: 'Asia/Jakarta', MY: 'Asia/Kuala_Lumpur', IN: 'Asia/Kolkata',
  US: 'America/New_York', CA: 'America/Toronto', MX: 'America/Mexico_City', BR: 'America/Sao_Paulo',
  AR: 'America/Argentina/Buenos_Aires', CO: 'America/Bogota', CL: 'America/Santiago', PE: 'America/Lima',
  GB: 'Europe/London', FR: 'Europe/Paris', DE: 'Europe/Berlin', ES: 'Europe/Madrid',
  IT: 'Europe/Rome', NL: 'Europe/Amsterdam', PT: 'Europe/Lisbon', CH: 'Europe/Zurich',
  SE: 'Europe/Stockholm', PL: 'Europe/Warsaw', RU: 'Europe/Moscow', TR: 'Europe/Istanbul',
  AU: 'Australia/Sydney', NZ: 'Pacific/Auckland', AE: 'Asia/Dubai', EG: 'Africa/Cairo',
  ZA: 'Africa/Johannesburg',
};

/** 구조화 행사 주소 (Step3 Edit address) — 로컬 검색 신호(Place/PostalAddress)의 단일 소스.
 *  venue·line1·city·province 는 i18n. 레거시 데이터는 string 일 수 있어 읽을 때 정규화한다(addrText). */
export interface EventAddress {
  venue?: I18n; // 호텔/베뉴명 (언어별) — Place.name
  line1?: I18n; // 도로명/상세 주소 (언어별) — streetAddress
  city?: I18n; // 도시 (언어별) — addressLocality
  province?: I18n; // 시/도·주 (언어별) — addressRegion
  postalCode?: string; // 우편번호 — postalCode
  country?: string; // (레거시) 국가 — 기본정보의 country(ISO2) 로 대체
  lat?: number; // 위도 — Place.geo (로컬 검색에서 가중치가 큰 신호)
  lng?: number; // 경도
  mapUrl?: string; // 지도 링크 (구글맵 등) — Place.hasMap
}

/** 주최자 프로필 (Step2) — event_content 인라인(별도 테이블 미사용) */
export interface EventOrganizer {
  name?: I18n;
  logo?: string; // 로고 이미지 URL
  description?: I18n;
  contact?: string; // 이메일/전화/URL
  email?: string; // 이메일 (전용)
  sns?: string; // SNS 계정(핸들/URL) — 인스타/페북 등
}

/** Price Hike 구간 — 기간별 가격(USD). until 까지 해당 가격 적용, 마지막 구간 until 비우면 현장가.
 *  금액은 시스템 관례대로 USD 최소단위(센트) 정수. 입력 UI 는 달러로 받아 변환한다. */
export interface EventPriceTier {
  label?: string; // 구간명 (1차/얼리버드 등)
  until?: string; // 마감일시 (datetime-local). 비우면 마지막/현장
  listPrice?: number; // 정식 판매가 (USD 센트)
  wolfPrice?: number; // 123Band 판매가 (USD 센트, 실판매가)
  listPriceKrw?: number; // 정식 판매가 (KRW 원, 선택) — 입력 시 KO 에서 정확 표시
  wolfPriceKrw?: number; // 123Band 판매가 (KRW 원, 선택)
  // 표시 전용 서브통화(THB/VND/CNY/JPY) 금액(각 통화 최소단위=정수). 값 있는 통화만 웹 토글에 노출.
  listPricesSub?: Prices; // 정식가 서브통화별
  wolfPricesSub?: Prices; // 123Band 판매가 서브통화별
}

/** 티켓(패스) 티어 — 1행사 N티켓 (Step5) */
export interface EventTicketTier {
  key: string; // 로컬 식별자(렌더 key/정렬용, 저장 유지)
  name?: I18n; // 티켓명
  type?: TicketTierType; // 패스 종류
  units?: number; // 판매 수량(총)
  feeMode?: TicketFeeMode; // 수수료 부담 주체
  priceTiers?: EventPriceTier[]; // Price Hike 구간(USD). 대표가 = 첫 구간 wolfPrice.
  price?: Prices; // (레거시) 단일 다통화가 — 기존 데이터 호환
}

/** 공연자/라인업 항목 — 아티스트/DJ/강사/퍼포먼스 팀. schema.org Event.performer 소스. */
export interface EventPerformer {
  name?: I18n; // 이름 (언어별, 레거시 string 허용)
  role?: I18n; // 역할 (DJ/강사/퍼포머 등) — 선택
  image?: string; // 사진 URL — 선택 (리치결과 이미지)
  sns?: string; // SNS/프로필 URL — 선택 (sameAs)
}

/** 관련 SNS 링크 (상세페이지 '관련 링크' 버튼). 값=URL(또는 핸들). 빈 값은 버튼 숨김. */
export interface EventLinks {
  instagram?: string;
  youtube?: string;
  facebook?: string;
  tiktok?: string;
}

/** 대상(오디언스) (Step6) */
export interface EventAudience {
  estimatedAttendees?: number; // 예상 참가자 수
  attendeesLocation?: AttendeesLocation; // 참가자 주요 출신
  levels?: AttendeeLevel[]; // 추천 레벨(복수)
  danceStyles?: string[]; // 댄스 스타일(복수)
}

/** 주소 필드(i18n 또는 레거시 string) → 현재 로케일 텍스트. 없으면 영문/임의 폴백. */
export function addrText(v?: I18n | string, locale: Locale = 'en'): string {
  if (!v) return '';
  if (typeof v === 'string') return v.trim();
  return (v[locale] ?? v.en ?? Object.values(v).find((x) => x && x.trim()) ?? '').trim();
}

/** 구조화 주소 → 한 줄 표시 문자열 (빈 값 제외, 콤마 결합). 베뉴명 포함 — 히어로/요약 표기용.
 *  베뉴 칸에 도시명을 넣거나 주소 칸에 전체 주소를 통째로 적은 데이터가 많아 중복을 걸러낸다.
 *  (예: venue "Melbourne" + line1 "Melbourne, Victoria, Australia" → "Melbourne, Victoria, Australia") */
export function formatEventAddress(a?: EventAddress, locale: Locale = 'en'): string {
  if (!a) return '';
  const t = (v?: I18n | string) => addrText(v, locale);
  const line1 = t(a.line1);
  const out: string[] = [];
  for (const raw of [t(a.venue), line1, t(a.city), t(a.province), a.postalCode, a.country]) {
    const part = (raw ?? '').trim();
    if (!part) continue;
    // 주소 문자열에 이미 들어있거나, 앞서 넣은 값과 같으면 건너뛴다.
    if (part !== line1 && line1.toLowerCase().includes(part.toLowerCase())) continue;
    if (out.some((k) => k.toLowerCase() === part.toLowerCase())) continue;
    out.push(part);
  }
  return out.join(', ');
}

/** 티켓 상품의 이벤트 페이지 콘텐츠(products.event_content). 모든 텍스트는 i18n. */
export interface EventContent {
  banner?: I18n; // 히어로 배너 이미지 URL (locale별)
  badge?: I18n; // 상단 배지 텍스트 (예: "전문가와 함께하는 …")
  subtitle?: I18n; // 부제 (예: "조직 생존을 위한 …")
  startAt?: string; // 일시 시작 (ISO, datetime-local)
  endAt?: string; // 일시 종료
  applyStart?: string; // 신청 시작
  applyEnd?: string; // 신청 종료
  priceText?: I18n; // 비용 표기 (비우면 상품가격/무료 자동)
  location?: I18n; // 장소(자유 텍스트 표기)
  media?: string[]; // 미디어 URL 목록(유튜브/인스타/이미지/동영상 자동판별, 언어공통) — 본문 상단 갤러리
  videos?: string[]; // 동영상 전용 URL 목록(유튜브/비메오/동영상파일) — 상세페이지에서 플레이어로 임베드
  sections?: Partial<Record<EventSectionKey, I18n>>; // 섹션별 i18n HTML
  // ── goandance 레퍼런스 확장 ──
  eventType?: EventType; // 행사 유형
  country?: string; // 국가 (기본 정보 — 표시명 또는 ISO). address.country(장소)와 별개.
  address?: EventAddress; // 구조화 장소
  organizer?: EventOrganizer; // 주최자 프로필(인라인)
  tickets?: EventTicketTier[]; // 티켓 티어 목록
  performers?: EventPerformer[]; // 공연자/라인업 (아티스트/DJ/강사) — Event.performer
  audience?: EventAudience; // 대상(오디언스)
  links?: EventLinks; // 관련 SNS 링크(인스타·유튜브·페북·틱톡) — 상세페이지 관련 링크 버튼
  seo?: EventSeo; // 검색엔진 최적화(메타 타이틀/설명/키워드)
}

/** SEO 메타 — 고객 상세 페이지 <head> 및 검색 노출용. */
export interface EventSeo {
  title?: I18n; // 메타 타이틀
  description?: I18n; // 메타 설명
  keywords?: string[]; // 관련 키워드
}

export interface Order {
  id: string;
  orderNo: string;
  buyerId: string;
  status: OrderStatus;
  totalAmount: number;
  currency: Currency;
  paymentMethod: PaymentMethod | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string | null;
  sellerId: string; // 정산 근거
  qty: number;
  unitPrice: number;
  lineAmount: number;
  currency: Currency;
}

export interface Shipment {
  id: string;
  orderId: string;
  region: ShipmentRegion;
  carrier: string | null;
  trackingNo: string | null;
  status: ShipmentStatus;
  shippedAt: string | null;
  eta: string | null;
  cost: number;
}

export interface Subscription {
  id: string;
  userId: string;
  plan: string; // 'JNJ' | 'DIV' (+tier)
  status: SubscriptionStatus;
  periodStart: string | null;
  periodEnd: string | null;
  price: number | null;
  currency: Currency;
}

export interface Banner {
  id: string;
  position: string | null;
  titleI18n: I18n;
  imageUrl: string | null;
  linkUrl: string | null;
  sortOrder: number;
  startAt: string | null;
  endAt: string | null;
  isActive: boolean;
}

export interface Board {
  id: string;
  boardType: BoardType | null;
  title: string | null;
  content: string | null;
  authorId: string | null;
  status: string;
  createdAt: string;
}

export interface MainSection {
  id: string;
  sectionType: SectionType | null;
  config: Record<string, unknown>;
  sortOrder: number;
  isActive: boolean;
}

export interface AiProductJob {
  id: string;
  productId: string | null;
  input: Record<string, unknown> | null;
  generatedHtml: string | null;
  status: string;
  createdAt: string;
}
