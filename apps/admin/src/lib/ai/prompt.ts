// Design Ref: §5 — 고정 템플릿 프롬프트 (디자인 일관성: 제목/특징/이미지/상세 순서 통일)

export interface ProductPromptInput {
  name: string;
  keywords?: string;
  features: string[];
  imageUrls: string[];
  category?: string;
}

// 생성 결과 구조를 강하게 고정 → 상품마다 들쭉날쭉 방지 (가이드 Act)
export const PRODUCT_HTML_SYSTEM = `You are a product-page copywriter for the "123Band" marketplace.
Output ONLY a valid HTML *fragment* — no markdown, no code fences, no <html>/<head>/<body>, and NEVER <script> or <style>.
Use this FIXED structure, in this exact order:
1. <h2> a punchy headline based on the product name
2. <p> a 2–3 sentence introduction
3. <h2>Key Features</h2> followed by <ul> with one <li> per feature
4. For EACH provided image URL: an <img src="THE_URL" alt="..."> tag. Use ONLY the URLs given — never invent URLs and never use base64/data URIs. If no URLs are given, omit images.
5. <h2>Details</h2> followed by one or two <p> with a richer description
Allowed tags only: h2, p, ul, li, img, strong, em. No classes, no inline styles, no event handlers, no links.
Write in clear, persuasive English.`;

export function buildProductPrompt(input: ProductPromptInput): string {
  const lines = [
    `Product name: ${input.name}`,
    input.category ? `Category: ${input.category}` : '',
    input.keywords ? `Keywords: ${input.keywords}` : '',
    input.features.length ? `Features:\n${input.features.map((f) => `- ${f}`).join('\n')}` : '',
    input.imageUrls.length
      ? `Image URLs (use each exactly once, in order):\n${input.imageUrls.map((u) => `- ${u}`).join('\n')}`
      : 'No image URLs provided.',
  ].filter(Boolean);
  return `Write the product detail page for:\n\n${lines.join('\n')}`;
}

const LANG_NAME: Record<string, string> = {
  ko: 'Korean',
  ja: 'Japanese',
  'zh-TW': 'Traditional Chinese (Taiwan)',
  en: 'English',
};

export const TRANSLATE_SYSTEM = `You translate HTML product descriptions.
Preserve ALL HTML tags, attributes, and structure EXACTLY. Translate only the human-readable text nodes.
Keep every <img src="..."> URL unchanged. Do not add or remove tags. Output ONLY the translated HTML fragment (no markdown, no code fences).`;

export function buildTranslatePrompt(html: string, targetLocale: string): string {
  const lang = LANG_NAME[targetLocale] ?? targetLocale;
  return `Translate the following product HTML into ${lang}:\n\n${html}`;
}

// 행사 포스터 이미지 → 위저드 자동채움용 구조화 JSON 추출 시스템 프롬프트.
export const EVENT_ANALYZE_SYSTEM = `You analyze an event flyer/poster image for a dance-event marketplace ("123Band") and extract structured data to pre-fill a listing form.
Return ONLY a single JSON object — no markdown, no code fences, no commentary.
Fill every field you can confidently read; OMIT fields you cannot determine (do not invent). Provide BOTH "en" and "ko" for text fields when possible (translate if the poster is in only one language).

JSON shape (all fields optional):
{
  "name": { "en": string, "ko": string },
  "eventType": one of "festival" | "congress" | "workshop" | "bootcamp" | "party" | "social" | "competition" | "other",
  "country": ISO 3166-1 alpha-2 code of the event location (e.g. "KR","US","JP"),
  "startAt": "YYYY-MM-DDTHH:mm", "endAt": "YYYY-MM-DDTHH:mm",
  "applyStart": "YYYY-MM-DDTHH:mm", "applyEnd": "YYYY-MM-DDTHH:mm",
  "venue": string, "address": string, "organizer": string,
  "danceStyles": string[],
  "tickets": [ { "name": { "en": string, "ko": string }, "priceUSD": number, "priceKRW": number } ],
  "about": { "en": string, "ko": string },
  "sections": {
    "inclusions": { "en": string, "ko": string },
    "venue": { "en": string, "ko": string },
    "notice": { "en": string, "ko": string },
    "recommend": { "en": string, "ko": string },
    "refund": { "en": string, "ko": string }
  },
  "seo": {
    "title": { "en": string, "ko": string },
    "description": { "en": string, "ko": string },
    "keywords": string[]
  }
}
Rules: years are 4-digit; dates valid (use T00:00 if time unknown). Prices are plain numbers in MAJOR units (dollars / won), no symbols. "about" is a 1-3 sentence plain-text summary.
"sections" values are SHORT HTML fragments (allowed tags ONLY: <p>, <ul>, <li>, <strong>) drafting each detail area for a dance event: "inclusions" = a bullet list of what the ticket/pass grants (workshops, parties, performances, shows, socials, hotel/shuttle if the poster says so) — ONLY items the poster actually names, "venue" = venue/area vibe & how-to-get-there guidance (only from what the poster shows), "notice" = practical attendee notes, "recommend" = who should attend, "refund" = a GENERIC, clearly editable cancellation/refund policy TEMPLATE (not final/binding). OMIT any section you cannot draft. NEVER invent exact facts (street addresses, phone numbers, prices).
SEO: "title" = concise meta title (~60 chars); "description" = compelling meta description (~150 chars); "keywords" = 6-12 RELEVANT search keywords (dance styles, city/region, event type, artist/organizer names, year) — lowercase, no '#'.
Output must be valid JSON parseable by JSON.parse.`;

// 행사 상세 섹션 초안(콘텐츠 단계 "빈 섹션 채우기" 버튼용) — 이미 입력된 구조화 데이터를 근거로 섹션별 HTML 초안 생성.
export interface EventSectionsInput {
  name: string;
  /** 한글 표기(있을 때) — 한국어 섹션이 영문 이름을 쓰지 않도록 언어별로 넘긴다. */
  nameKo?: string;
  eventType?: string;
  country?: string;
  venue?: string;
  venueKo?: string;
  address?: string;
  addressKo?: string;
  startAt?: string;
  endAt?: string;
  applyStart?: string;
  applyEnd?: string;
  organizer?: string;
  organizerKo?: string;
  organizerContact?: string;
  danceStyles?: string[];
  levels?: string[];
  tickets?: string[];
  priceText?: string;
  about?: string;
}

export const EVENT_SECTIONS_SYSTEM = `You draft the detail-page sections for a listing on the "123Band" dance-event marketplace, based ONLY on the structured data provided.
Return ONLY a single JSON object — no markdown, no code fences, no commentary.
Shape:
{
  "sections": {
    "about":      { "en": string, "ko": string },
    "inclusions": { "en": string, "ko": string },
    "venue":      { "en": string, "ko": string },
    "notice":     { "en": string, "ko": string },
    "channel":    { "en": string, "ko": string },
    "recommend":  { "en": string, "ko": string },
    "refund":     { "en": string, "ko": string }
  }
}
Each value is a SHORT HTML fragment — allowed tags ONLY: <p>, <ul>, <li>, <strong>, <em>, <h3>. No markdown, no code fences, no <script>/<style>, no classes/styles, no links.
Provide BOTH "en" and "ko" for every section (write natural Korean, not machine-literal).
Section intent for a dance event:
- about: 2-4 sentence introduction from the name/type/dates/city/dance styles.
- inclusions: what the ticket/pass grants, as a <ul> bullet list (workshops, parties, performances, socials, and hotel/shuttle only if such a ticket exists). Base it on the ticket names given; keep each bullet short. If ticket names give no detail, write generic full-pass style access lines the organizer can edit.
- venue: venue name/area and general "getting there / what to expect" guidance (use only the venue/address given; do NOT invent an exact address or transit line).
- notice: practical attendee notes (schedule window, what to bring, arrival/check-in, dress code) — generic but relevant to the event type.
- channel: where to follow updates (use organizer SNS/contact if given; otherwise a generic "follow the organizer's official channels" line).
- recommend: who this event is best for, based on levels/dance styles.
- refund: a GENERIC, clearly editable cancellation/refund policy TEMPLATE the organizer can adjust (e.g. tiered by days before the event). Do NOT present it as final/binding.
Language rule (IMPORTANT): write each language version in that language's own script. The English version must NOT contain Hangul/CJK — if a proper noun (event or organizer name) was given only in Korean, romanize it for the English version (or refer to it generically, e.g. "the organizer") rather than pasting the Korean text. Likewise the Korean version should use the Korean name when one is given.
Rules: NEVER invent specific facts not provided (exact street address, phone number, prices, dates). Keep each section concise. Output must be valid JSON parseable by JSON.parse.`;

export function buildEventSectionsPrompt(input: EventSectionsInput): string {
  // 이름·주최자·장소는 언어별로 따로 넘긴다 — 하나만 주면 모델이 그 표기를 두 언어에 그대로 써서
  // 영문 본문에 한글 고유명사가 박히는 사고가 난다(실제 발생).
  const pair = (label: string, en?: string, ko?: string) => {
    if (en && ko && en !== ko) return `${label}: ${en} (Korean: ${ko})`;
    return en || ko ? `${label}: ${en || ko}` : '';
  };
  const L: string[] = [pair('Event name', input.name, input.nameKo)];
  if (input.eventType) L.push(`Event type: ${input.eventType}`);
  if (input.country) L.push(`Country: ${input.country}`);
  const venue = pair('Venue', input.venue, input.venueKo);
  if (venue) L.push(venue);
  const address = pair('Address', input.address, input.addressKo);
  if (address) L.push(address);
  if (input.startAt || input.endAt) L.push(`Event dates: ${input.startAt ?? '?'} ~ ${input.endAt ?? '?'}`);
  if (input.applyStart || input.applyEnd) L.push(`Registration window: ${input.applyStart ?? '?'} ~ ${input.applyEnd ?? '?'}`);
  const organizer = pair('Organizer', input.organizer, input.organizerKo);
  if (organizer) L.push(organizer);
  if (input.organizerContact) L.push(`Organizer contact: ${input.organizerContact}`);
  if (input.danceStyles?.length) L.push(`Dance styles: ${input.danceStyles.join(', ')}`);
  if (input.levels?.length) L.push(`Attendee levels: ${input.levels.join(', ')}`);
  if (input.tickets?.length) L.push(`Tickets: ${input.tickets.join('; ')}`);
  if (input.priceText) L.push(`Price note: ${input.priceText}`);
  if (input.about) L.push(`Existing about text: ${input.about}`);
  return `Draft the detail-page sections for this event:\n\n${L.join('\n')}`;
}
