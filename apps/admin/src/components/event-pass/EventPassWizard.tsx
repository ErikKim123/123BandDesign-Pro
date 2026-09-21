// 행사패스 등록/수정 — 오거나이저(파트너) 위저드와 동일한 단계형 UI를 어드민에 이식.
// 기존 평면 폼(ResourceFormPage)을 대체. products(ticket) + event_content(jsonb) 한 번에 저장.
// 7단계: 기본정보 · 주최자 · 일정 · 장소 · 티켓 · 대상 · 상세콘텐츠
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { tr } from '@/i18n/tr';
import {
  CalendarClock,
  MapPin,
  Users,
  Ticket,
  Building2,
  Tag,
  Globe,
  Sparkles,
  Languages,
  Image as ImageIcon,
  Loader2,
  Instagram,
  Youtube,
  Facebook,
  Link2,
} from 'lucide-react';
import {
  EVENT_SECTION_KEYS,
  EVENT_TYPE_KEYS,
  ATTENDEE_LEVEL_KEYS,
  ATTENDEES_LOCATION_KEYS,
  TICKET_TIER_TYPE_KEYS,
  COUNTRY_CODES,
  COUNTRY_TIMEZONE,
  DANCE_STYLES,
  resolveMedia,
  isPlayableVideo,
  MEDIA_KIND_LABEL,
  toDisplayAmount,
  toMinorAmount,
  genProductCode,
  pickI18n,
  buildEventTitle,
  countryLabel as seoCountryLabel,
  parseGeoFromMapUrl,
  isValidGeo,
  addrText, // 아래 로컬 countryLabel(선택지 표기)과 구분 — 이쪽은 제목용 통칭
  displayWidth,
  buildProductSlug,
  slugify,
  SLUG_MAX,
  TITLE_MAX_WIDTH,
  tierPrices,
  pickPrice,
  type EventContent,
  type EventSectionKey,
  type EventType,
  type EventAddress,
  type EventLinks,
  type EventOrganizer,
  type EventTicketTier,
  type EventPriceTier,
  type EventAudience,
  type EventPerformer,
  type AttendeeLevel,
  type AttendeesLocation,
  type TicketTierType,
  type TicketFeeMode,
  type I18n,
  type Prices,
} from '@123band/shared';
import { createClient } from '@/lib/supabase/client';
import { downscaleImageToBlob, blobExt, UPLOAD_CACHE_CONTROL } from '@/lib/image';
import { useResourceUpsert } from '@/lib/queries/resource';
import { useWizardDict } from '@/i18n/wizard-dict';
import { useLocale } from '@/lib/locale/LocaleContext';
import { useGlobalLocale } from '@/lib/locale/active-locale';
import type { ResourceConfig } from '@/lib/resource/types';
import type { ProductRow } from '@/lib/resource/configs/products';
import { I18nField } from '@/components/form/I18nField';
import { DateTimePicker } from '@/components/form/DateTimePicker';
import { ProductImageField } from '@/components/product/ProductImageField';
import { AiProductGenerator } from '@/components/product/AiProductGenerator';
import { RichEditorI18n } from '@/components/editor/RichEditor';
import { cn } from '@/lib/utils';

// 국가 코드 → 표시명 (Intl.DisplayNames, 로케일별 캐시). 미지원/누락 시 코드 그대로.
const _regionNames: Record<string, Intl.DisplayNames | null> = {};
function countryLabel(code: string, locale: string): string {
  try {
    if (!(locale in _regionNames)) {
      _regionNames[locale] =
        'DisplayNames' in Intl ? new Intl.DisplayNames([locale], { type: 'region' }) : null;
    }
    return _regionNames[locale]?.of(code) ?? code;
  } catch {
    return code;
  }
}
// 타임존 → 짧은 표기(GMT+9 등). 일정 안내 문구용.
function tzShortLabel(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('ko', { timeZone: tz, timeZoneName: 'short' }).formatToParts(
      new Date(),
    );
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
}

function newTierKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'tk_' + Math.random().toString(36).slice(2, 10);
}

// 레거시 문자열 주소(venue/line1) 호환 — string 이면 {en} 으로 정규화해 i18n 으로 다룬다.
function asI18n(v?: I18n | string): I18n {
  return typeof v === 'string' ? { en: v } : (v ?? {});
}

// USD↔KRW 근사 환율(표시/자동채움용, 웹 price.ts 와 동일 기준: 1 USD ≈ 1,400 KRW)
const USD_KRW_RATE = 1400;
function usdCentsToKrwWon(cents: number): number {
  return Math.round((cents / 100) * USD_KRW_RATE);
}
function krwWonToUsdCents(won: number): number {
  return Math.round((won / USD_KRW_RATE) * 100);
}

// ── AI 포스터 분석 자동채움 ────────────────────────────────────
interface EventAnalysis {
  name?: { en?: string; ko?: string };
  eventType?: string;
  country?: string;
  startAt?: string;
  endAt?: string;
  applyStart?: string;
  applyEnd?: string;
  venue?: string;
  address?: string;
  organizer?: string;
  danceStyles?: string[];
  tickets?: { name?: { en?: string; ko?: string }; priceUSD?: number; priceKRW?: number }[];
  about?: { en?: string; ko?: string };
  sections?: Partial<Record<'inclusions' | 'venue' | 'notice' | 'recommend' | 'refund', { en?: string; ko?: string }>>;
  seo?: {
    title?: { en?: string; ko?: string };
    description?: { en?: string; ko?: string };
    keywords?: string[];
  };
}

// Blob → base64 (data URL 접두 제거). AI 비전 전송용.
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      resolve(s.slice(s.indexOf(',') + 1));
    };
    r.onerror = () => reject(new Error('read failed'));
    r.readAsDataURL(blob);
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 이미 HTML 태그가 있으면 그대로, 아니면 <p> 로 감싼다(평문 요약 → 섹션 본문용).
function asHtmlFragment(s: string): string {
  const t = s.trim();
  if (!t) return '';
  return /<[a-z][\s\S]*>/i.test(t) ? t : `<p>${escapeHtml(t)}</p>`;
}

// 틱톡 브랜드 아이콘 (lucide 미제공) — currentColor 로 상속.
// size 를 number|string 으로 받는다 — lucide 아이콘(LucideProps.size: string|number)과
// 같은 배열에 담기려면 두 컴포넌트의 prop 타입이 호환돼야 한다(빌드 타입 오류 원인).
function TikTokIcon({ size = 16 }: { size?: number | string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.5 3c.3 2.1 1.6 3.6 3.5 3.9v2.5c-1.3.1-2.5-.3-3.6-1v5.9c0 3.4-2.7 6-6 6-3.2 0-5.7-2.6-5.7-5.8 0-3 2.3-5.5 5.3-5.8.4 0 .8 0 1.2.1v2.7c-.4-.1-.7-.2-1.1-.2-1.4 0-2.5 1.1-2.5 2.5s1.1 2.5 2.5 2.5 2.5-1.1 2.5-2.5V3h3.4z" />
    </svg>
  );
}

// 관련 SNS 링크 플랫폼 — 오거나이저 입력 4종(인스타·유튜브·페북·틱톡). key = EventLinks 필드.
const SOCIAL_PLATFORMS: {
  key: keyof EventLinks;
  label: string;
  placeholder: string;
  Icon: React.ComponentType<{ size?: number | string }>;
}[] = [
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/…', Icon: Instagram },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@…', Icon: Youtube },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/…', Icon: Facebook },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@…', Icon: TikTokIcon },
];

const MAX_AUTOFILL_IMAGES = 8;

// 이미지를 미리보기로 모은 뒤(최대 8장) "AI 분석" 버튼으로 한 번에 처리.
// 분석 시: 압축→스토리지 업로드(대표+미디어 순서대로) + 첫 장 AI 분석으로 전 단계 자동채움.
function AutoFillButton({
  onApply,
  onImages,
  existing,
  onRemoveExisting,
}: {
  onApply: (d: EventAnalysis) => void;
  onImages: (urls: string[]) => void;
  existing: string[];
  onRemoveExisting: (url: string) => void;
}) {
  const td = useWizardDict();
  const ref = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(true); // AI 자동 채우기 패널 기본 펼침
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // 미리보기 URL (files 변경 시 재생성, 이전 것 revoke)
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  function addFiles(list: File[]) {
    setErr(null);
    setMsg(null);
    const imgs = list.filter((f) => f.type.startsWith('image/'));
    if (!imgs.length) {
      setErr(td.wizard.autoFill.errType);
      return;
    }
    if (imgs.some((f) => f.size > 25 * 1024 * 1024)) {
      setErr(td.wizard.autoFill.errSize);
      return;
    }
    setFiles((prev) => [...prev, ...imgs].slice(0, MAX_AUTOFILL_IMAGES));
  }

  async function analyze() {
    if (!files.length || busy) return;
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const urls: string[] = [];
      let firstBlob: Blob | null = null;
      for (const f of files) {
        const blob = await downscaleImageToBlob(f);
        if (!firstBlob) firstBlob = blob;
        try {
          const path = `autofill/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${blobExt(blob)}`;
          const { error: upErr } = await supabase.storage
            .from('band123-product-images')
            .upload(path, blob, { cacheControl: UPLOAD_CACHE_CONTROL, upsert: true, contentType: blob.type || 'image/jpeg' });
          if (!upErr) urls.push(supabase.storage.from('band123-product-images').getPublicUrl(path).data.publicUrl);
        } catch {
          /* 개별 업로드 실패는 건너뜀 */
        }
      }
      if (urls.length) onImages(urls); // 대표(첫 장) + 미디어(순서대로)

      // 첫 장(포스터)만 AI 분석 → 전 단계 자동채움
      if (firstBlob) {
        const base64 = await blobToBase64(firstBlob);
        const res = await fetch('/api/ai/analyze-event', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mediaType: 'image/jpeg' }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? td.wizard.autoFill.errFail);
        onApply((d.data ?? {}) as EventAnalysis);
      }
      setFiles([]); // 적용 후 스테이징 비움
      setMsg(td.wizard.autoFill.done);
    } catch (ex) {
      setErr(ex instanceof Error ? tr(ex.message) : td.wizard.autoFill.errFail);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  }

  // 접힌 상태 — 아이콘 버튼만 표시(업로드된 이미지 개수 배지).
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={td.wizard.autoFill.btn}
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-grey-300 bg-grey-50 text-grey-600 transition-colors hover:bg-grey-100"
      >
        <Sparkles size={16} />
        {existing.length > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-black px-1 text-[10px] font-medium leading-none text-white">
            {existing.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!busy) setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (busy) return;
        const fs = Array.from(e.dataTransfer.files ?? []);
        if (fs.length) addFiles(fs);
      }}
      className={cn(
        'w-64 shrink-0 space-y-2 rounded-lg border border-dashed p-2.5 transition-colors',
        drag ? 'border-black bg-grey-100' : 'border-grey-300 bg-grey-50',
      )}
    >
      <div className="flex items-center justify-between gap-1.5 text-xs font-medium text-grey-600">
        <span className="flex items-center gap-1.5"><Sparkles size={13} /> {td.wizard.autoFill.btn}</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex h-5 w-5 items-center justify-center rounded text-grey-400 hover:bg-grey-200 hover:text-grey-600"
          aria-label="collapse"
        >
          ×
        </button>
      </div>
      <p className="text-[10px] leading-tight text-grey-400">{td.wizard.autoFill.hint}</p>

      {/* 이미 업로드/분석된 이미지 — 재방문 시에도 미리보기 유지 */}
      {existing.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] text-grey-400">{td.wizard.autoFill.uploaded}</span>
          <div className="flex flex-wrap gap-1">
            {existing.map((u) => (
              <div key={u} className="relative h-10 w-10 overflow-hidden rounded border border-grey-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" className="h-full w-full object-cover" />
                {!busy && (
                  <button
                    type="button"
                    onClick={() => onRemoveExisting(u)}
                    className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center bg-black/60 text-[10px] leading-none text-white"
                    aria-label="remove"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { const fs = Array.from(e.target.files ?? []); if (fs.length) addFiles(fs); }}
      />

      {/* 미리보기 (스테이징) */}
      {previews.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {previews.map((u, i) => (
            <div key={i} className="relative h-10 w-10 overflow-hidden rounded border border-grey-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="h-full w-full object-cover" />
              {!busy && (
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center bg-black/60 text-[10px] leading-none text-white"
                  aria-label="remove"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1.5">
        <button
          type="button"
          className="btn btn-secondary btn-sm flex-1 justify-center"
          disabled={busy || files.length >= MAX_AUTOFILL_IMAGES}
          onClick={() => ref.current?.click()}
        >
          {td.wizard.autoFill.add}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm flex-1 justify-center"
          disabled={busy || !files.length}
          onClick={analyze}
        >
          <Sparkles size={13} /> {busy ? td.wizard.autoFill.busy : `${td.wizard.autoFill.analyze}${files.length ? ` (${files.length})` : ''}`}
        </button>
      </div>

      {msg && <p className="text-[11px] text-success">{msg}</p>}
      {err && <p className="text-[11px] text-danger">{err}</p>}
    </div>
  );
}

// ── 메인 마법사 ───────────────────────────────────────────────
export function EventPassWizard({
  initial,
  config,
  sellerId,
  onDone,
  onCancel,
}: {
  initial: Record<string, unknown> | null; // null = 신규
  config: ResourceConfig<ProductRow>;
  sellerId?: string; // 어드민 자체 등록은 없음(파트너 대행 시에만)
  onDone: () => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    initial
      ? { ...initial }
      : { ...(config.createDefaults ?? {}), ...(sellerId ? { seller_id: sellerId } : {}) },
  );
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // 저장 중(자동번역 포함) 표시용 — upsert.isPending 은 DB 쓰기 구간만 커버.
  const [saving, setSaving] = useState(false);
  const td = useWizardDict();
  const STEPS = td.wizard.steps;
  const upsert = useResourceUpsert(config as never);

  // 수정 시 상세 HTML(detail_html_i18n)은 목록 select 에서 제외 → 콘텐츠 단계 진입 시 1회 로드
  const fetchedDetail = useRef(false);
  useEffect(() => {
    const id = values.id as string | undefined;
    if (step !== 6 || fetchedDetail.current || !id || values.detail_html_i18n) return;
    fetchedDetail.current = true;
    createClient()
      .from('products')
      .select('detail_html_i18n')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.detail_html_i18n) setValues((v) => ({ ...v, detail_html_i18n: data.detail_html_i18n }));
      })
      .then(undefined, () => {});
  }, [step, values.id, values.detail_html_i18n]);

  // 검색 주소(슬러그)도 목록 select 에 없다 → 수정 진입 시 1회 로드.
  // 이 값이 있어야 "이미 발행된 주소" 로 인식해 저장 때 새로 만들지 않는다(URL 고정).
  const fetchedSlug = useRef(false);
  useEffect(() => {
    const id = values.id as string | undefined;
    if (fetchedSlug.current || !id || values.slug !== undefined) return;
    fetchedSlug.current = true;
    createClient()
      .from('products')
      .select('slug')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        const s = (data as { slug?: string | null } | null)?.slug;
        if (s) setValues((v) => ({ ...v, slug: s }));
      })
      .then(undefined, () => {}); // 0035 미적용이면 그냥 비워둔다
  }, [values.id, values.slug]);

  const ec = (values.event_content as EventContent) ?? {};
  const set = (name: string, v: unknown) => setValues((p) => ({ ...p, [name]: v }));
  const setEc = (p: Partial<EventContent>) =>
    setValues((v) => ({ ...v, event_content: { ...((v.event_content as EventContent) ?? {}), ...p } }));

  // AI 분석 결과를 전체 단계(이름·유형·국가·일정·장소·주최자·티켓·대상·소개)에 병합.
  function applyAutoFill(r: EventAnalysis) {
    setValues((prev) => {
      const next: Record<string, unknown> = { ...prev };
      const ec: EventContent = { ...((prev.event_content as EventContent) ?? {}) };
      if (r.name && (r.name.en || r.name.ko)) {
        next.name_i18n = {
          ...((prev.name_i18n as I18n) ?? {}),
          ...(r.name.en ? { en: r.name.en } : {}),
          ...(r.name.ko ? { ko: r.name.ko } : {}),
        };
      }
      if (r.eventType && (EVENT_TYPE_KEYS as readonly string[]).includes(r.eventType)) ec.eventType = r.eventType as EventType;
      if (r.country) ec.country = r.country;
      if (r.startAt) ec.startAt = r.startAt;
      if (r.endAt) ec.endAt = r.endAt;
      if (r.applyStart) ec.applyStart = r.applyStart;
      if (r.applyEnd) ec.applyEnd = r.applyEnd;
      if (r.venue || r.address) {
        ec.address = {
          ...(ec.address ?? {}),
          ...(r.venue ? { venue: { ...asI18n(ec.address?.venue), en: r.venue } } : {}),
          ...(r.address ? { line1: { ...asI18n(ec.address?.line1), en: r.address } } : {}),
        };
      }
      if (r.organizer) ec.organizer = { ...(ec.organizer ?? {}), name: { ...(ec.organizer?.name ?? {}), en: r.organizer } };
      if (Array.isArray(r.danceStyles)) {
        const ds = r.danceStyles.filter((s) => (DANCE_STYLES as readonly string[]).includes(s));
        if (ds.length) ec.audience = { ...(ec.audience ?? {}), danceStyles: ds };
      }
      if (Array.isArray(r.tickets) && r.tickets.length) {
        ec.tickets = r.tickets.map((tk) => ({
          key: newTierKey(),
          name: { ...(tk.name?.en ? { en: tk.name.en } : {}), ...(tk.name?.ko ? { ko: tk.name.ko } : {}) },
          type: 'full_pass' as TicketTierType,
          feeMode: 'client' as TicketFeeMode,
          priceTiers:
            typeof tk.priceUSD === 'number' && tk.priceUSD > 0
              ? [{ label: '1', listPrice: Math.round(tk.priceUSD * 100), wolfPrice: Math.round(tk.priceUSD * 100) }]
              : [],
        }));
      }
      if (r.about && (r.about.en || r.about.ko)) {
        const about: I18n = { ...(ec.sections?.about ?? {}) };
        if (r.about.en) about.en = `<p>${escapeHtml(r.about.en)}</p>`;
        if (r.about.ko) about.ko = `<p>${escapeHtml(r.about.ko)}</p>`;
        ec.sections = { ...(ec.sections ?? {}), about };
      }
      // AI 가 추가로 뽑아낸 섹션 초안(장소·공지·추천·환불) — 비어 있는 섹션/언어만 채운다(기존 작성분 보존).
      if (r.sections) {
        const secs: Record<string, I18n> = { ...(ec.sections ?? {}) };
        (Object.entries(r.sections) as [EventSectionKey, { en?: string; ko?: string }][]).forEach(([key, val]) => {
          if (!val) return;
          const cur = secs[key] ?? {};
          const next: I18n = { ...cur };
          if (val.en && !cur.en?.trim()) next.en = asHtmlFragment(val.en);
          if (val.ko && !cur.ko?.trim()) next.ko = asHtmlFragment(val.ko);
          secs[key] = next;
        });
        ec.sections = secs;
      }
      if (r.seo) {
        const seo = { ...(ec.seo ?? {}) };
        if (r.seo.title && (r.seo.title.en || r.seo.title.ko)) {
          seo.title = {
            ...(seo.title ?? {}),
            ...(r.seo.title.en ? { en: r.seo.title.en } : {}),
            ...(r.seo.title.ko ? { ko: r.seo.title.ko } : {}),
          };
        }
        if (r.seo.description && (r.seo.description.en || r.seo.description.ko)) {
          seo.description = {
            ...(seo.description ?? {}),
            ...(r.seo.description.en ? { en: r.seo.description.en } : {}),
            ...(r.seo.description.ko ? { ko: r.seo.description.ko } : {}),
          };
        }
        if (Array.isArray(r.seo.keywords)) {
          const kw = r.seo.keywords.map((k) => String(k).trim()).filter(Boolean);
          if (kw.length) seo.keywords = kw;
        }
        ec.seo = seo;
      }
      next.event_content = ec;
      return next;
    });
  }

  // 업로드 이미지 → 대표 이미지(첫 장) + 7스텝 미디어 갤러리(순서대로 추가).
  function applyImages(urls: string[]) {
    if (!urls.length) return;
    setValues((prev) => {
      const next: Record<string, unknown> = { ...prev };
      const ec: EventContent = { ...((prev.event_content as EventContent) ?? {}) };
      next.image_url = urls[0];
      const existing = (ec.media ?? []).filter(Boolean);
      ec.media = [...existing, ...urls];
      next.event_content = ec;
      return next;
    });
  }

  const nameOk = !!values.name_i18n && Object.values(values.name_i18n as I18n).some(Boolean);

  async function save() {
    setError(null);
    if (!nameOk) {
      setStep(0);
      setError(td.wizard.errNameRequired);
      return;
    }
    // 대표가(목록/카드용 products.prices) = 첫 티켓의 첫 구간 123Band 판매가(USD).
    // priceTiers 없으면 레거시 price 폴백.
    const tickets = (ec.tickets ?? []) as EventTicketTier[];
    let rep: Prices | undefined;
    for (const t of tickets) {
      // 값이 0/빈 구간은 건너뛰고 첫 유효(>0) 판매가 구간을 대표가로 잡는다.
      // (과거엔 September 의 잔여 KRW 0 같은 0값 구간이 대표가로 잡혀 헤드라인이 0/빈값이 됐음.)
      // 123Band 판매가 우선, 없으면 정식가. 대표가 자체는 결제통화(USD/KRW) 기준으로 저장한다.
      for (const pt of t.priceTiers ?? []) {
        const usd = pt.wolfPrice ?? pt.listPrice;
        const krw = pt.wolfPriceKrw ?? pt.listPriceKrw;
        const r: Prices = {};
        if (usd != null && usd > 0) r.USD = usd;
        if (krw != null && krw > 0) r.KRW = krw;
        // USD/KRW 없이 서브통화(바트 등)만 넣은 구간 — 예전엔 대표가가 비어 목록 카드·헤드라인이 빈칸이 됐다.
        // 입력된 서브통화에서 USD 로 근사 환산해 채운다(상세·견적의 pickPrice 폴백과 같은 환율).
        if (Object.keys(r).length === 0) {
          const fromSub = pickPrice(tierPrices(pt), 'USD');
          if (fromSub != null && fromSub > 0) r.USD = fromSub;
        }
        if (Object.keys(r).length > 0) {
          rep = r;
          break;
        }
      }
      if (rep) break;
      if (t.price && Object.values(t.price).some((v) => typeof v === 'number' && v > 0)) {
        rep = t.price;
        break;
      }
    }
    const payload: Record<string, unknown> = { ...values };
    // 대표가(목록/상세 헤드라인)는 항상 티켓에서 도출 — 가격 있는 티켓이 없으면 비운다(과거 값 잔존 방지).
    payload.prices = rep ?? {};
    // code 자동 생성 (폼에서 숨김) — 비어 있을 때만
    if (!payload.code) payload.code = genProductCode('EVT');

    // 검색 주소(URL 슬러그) — 비어 있을 때만 생성한다.
    // 이미 발행된 주소는 이름을 고쳐도 그대로 둔다(URL 이 바뀌면 쌓아둔 검색 순위가 초기화된다).
    // 사람이 SEO 단계에서 직접 바꾼 경우만 변경 — 옛 주소는 DB 트리거가 previous_slugs 에 남겨 301 로 잇는다.
    const typedSlug = typeof payload.slug === 'string' ? slugify(payload.slug) : '';
    payload.slug =
      typedSlug ||
      buildProductSlug({
        name: payload.name_i18n as I18n | undefined,
        productType: (payload.product_type as string) ?? 'ticket',
        eventType: ec.eventType,
        city: addrText(ec.address?.city, 'en') || addrText(ec.address?.province, 'en'),
        country: seoCountryLabel(ec.country, 'en'),
        startAt: ec.startAt,
      });
    if (!payload.slug) delete payload.slug; // 생성 불가(이름이 전부 비ASCII) → DB 트리거에 맡긴다

    if (config.schema) {
      const r = config.schema.safeParse(payload);
      if (!r.success) {
        const first = r.error.issues[0];
        setError(td.wizard.validation(first?.path.join('.') || '—', first?.message ?? td.wizard.errSaveFail));
        return;
      }
    }
    setSaving(true);
    try {
      // 번역은 8단계(AI 번역)에서 사용자가 직접 실행할 때만 적용된다(자동 번역 없음).
      try {
        await upsert.mutateAsync(payload as never);
      } catch (e) {
        // 42703 = slug 컬럼 없음(0035 미적용) → 슬러그를 빼고 저장한다. 저장 자체가 막히면 안 된다.
        if (!isMissingSlugColumn(e) || payload.slug === undefined) throw e;
        delete payload.slug;
        await upsert.mutateAsync(payload as never);
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? tr(e.message) : td.wizard.errSaveFail);
    } finally {
      setSaving(false);
    }
  }

  const isLast = step === STEPS.length - 1;
  const cur = STEPS[step]!;

  return (
    <div className="space-y-5">
      {/* 스텝퍼 */}
      <ol className="flex items-center">
        {STEPS.map((s, i) => (
          <li key={i} className={cn('flex items-center', i < STEPS.length - 1 && 'flex-1')}>
            <button
              type="button"
              onClick={() => setStep(i)}
              title={s.title}
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                i === step
                  ? 'bg-black text-white'
                  : i < step
                    ? 'bg-grey-600 text-white'
                    : 'bg-grey-200 text-grey-500',
              )}
            >
              {i + 1}
            </button>
            {i < STEPS.length - 1 && (
              <span className={cn('mx-1 h-0.5 flex-1', i < step ? 'bg-grey-600' : 'bg-grey-200')} />
            )}
          </li>
        ))}
      </ol>

      {/* 단계 헤더 — 스텝1 우측에 AI 자동채움(포스터 분석) */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold">{cur.title}</h3>
          <p className="text-sm text-grey-500">{cur.desc}</p>
        </div>
        {step === 0 && (
          <AutoFillButton
            onApply={applyAutoFill}
            onImages={applyImages}
            existing={(ec.media ?? []).filter(Boolean)}
            onRemoveExisting={(url) => {
              setValues((prev) => {
                const next: Record<string, unknown> = { ...prev };
                const pec: EventContent = { ...((prev.event_content as EventContent) ?? {}) };
                pec.media = (pec.media ?? []).filter((u) => u && u !== url);
                if (prev.image_url === url) next.image_url = pec.media[0] ?? null;
                next.event_content = pec;
                return next;
              });
            }}
          />
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* 단계 본문 */}
      <div className="min-h-[18rem]">
        {step === 0 && (
          <StepBasic values={values} set={set} ec={ec} setEc={setEc} />
        )}
        {step === 1 && <OrganizerStep value={ec.organizer ?? {}} onChange={(v) => setEc({ organizer: v })} />}
        {step === 2 && <ScheduleStep ec={ec} setEc={setEc} />}
        {step === 3 && <AddressStep value={ec.address ?? {}} onChange={(v) => setEc({ address: v })} />}
        {step === 4 && (
          <TicketsStep
            productId={values.id as string | undefined}
            value={ec.tickets ?? []}
            onChange={(v) => setEc({ tickets: v })}
            priceText={ec.priceText ?? {}}
            onPriceText={(v) => setEc({ priceText: v })}
          />
        )}
        {step === 5 && <AudienceStep value={ec.audience ?? {}} onChange={(v) => setEc({ audience: v })} />}
        {step === 6 && (
          <ContentStep values={values} set={set} ec={ec} setEc={setEc} />
        )}
        {step === 7 && <TranslateStep values={values} setValues={setValues} />}
      </div>

      {/* 풋터 네비게이션 */}
      <div className="flex items-center justify-between border-t border-grey-100 pt-4">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={step === 0 ? onCancel : () => setStep((s) => s - 1)}
        >
          {step === 0 ? td.wizard.cancel : td.wizard.prev}
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-grey-400">{td.wizard.stepOf(step + 1, STEPS.length)}</span>
          {isLast ? (
            <button type="button" className="btn btn-primary btn-sm" disabled={saving || upsert.isPending} onClick={save}>
              {saving || upsert.isPending ? td.wizard.saving : initial ? td.wizard.saveEdit : td.wizard.create}
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setStep((s) => s + 1)}>
              {td.wizard.next}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Step 1: 기본 정보 ─────────────────────────────────────────
function StepBasic({
  values, set, ec, setEc,
}: {
  values: Record<string, unknown>;
  set: (n: string, v: unknown) => void;
  ec: EventContent;
  setEc: (p: Partial<EventContent>) => void;
}) {
  const td = useWizardDict();
  const loc = useLocale().locale;
  return (
    <div className="space-y-4">
      <I18nField
        label={td.wizard.basic.passName}
        required
        value={(values.name_i18n as I18n) ?? {}}
        onChange={(v) => set('name_i18n', v)}
      />
      <div className="space-y-1.5">
        <label className="label-caps flex items-center gap-1.5"><Tag size={13} /> {td.wizard.basic.eventType}</label>
        <select
          className="input"
          value={ec.eventType ?? ''}
          onChange={(e) => setEc({ eventType: (e.target.value || undefined) as EventType | undefined })}
        >
          <option value="">{td.wizard.basic.select}</option>
          {EVENT_TYPE_KEYS.map((k) => <option key={k} value={k}>{td.wizard.eventType[k]}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <label className="label-caps flex items-center gap-1.5"><Globe size={13} /> {td.wizard.basic.country}</label>
        <select
          className="input"
          value={(ec.country as string) ?? ''}
          onChange={(e) => setEc({ country: e.target.value || undefined })}
        >
          <option value="">{td.wizard.basic.select}</option>
          {/* 기존 저장값이 목록에 없으면(예: 자유입력 잔존) 유지용 옵션 추가 */}
          {ec.country && !COUNTRY_CODES.includes(ec.country as never) && (
            <option value={ec.country}>{ec.country}</option>
          )}
          {COUNTRY_CODES.map((c) => (
            <option key={c} value={c}>{countryLabel(c, loc)}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ── Step 2: 주최자 ────────────────────────────────────────────
function OrganizerStep({ value, onChange }: { value: EventOrganizer; onChange: (v: EventOrganizer) => void }) {
  const td = useWizardDict();
  const set = (p: Partial<EventOrganizer>) => onChange({ ...value, ...p });
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 text-grey-500">
        <Building2 size={15} /> <span className="label-caps">{td.wizard.organizer.header}</span>
      </div>
      <I18nField label={td.wizard.organizer.name} value={value.name ?? {}} onChange={(v) => set({ name: v })} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="label-caps">{td.wizard.organizer.logo}</label>
          <input className="input" placeholder="https://…" value={value.logo ?? ''} onChange={(e) => set({ logo: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <label className="label-caps">{td.wizard.organizer.contact}</label>
          <input className="input" placeholder={td.wizard.organizer.contactPh} value={value.contact ?? ''} onChange={(e) => set({ contact: e.target.value })} />
        </div>
      </div>
      <I18nField label={td.wizard.organizer.desc} value={value.description ?? {}} onChange={(v) => set({ description: v })} multiline />
    </div>
  );
}

// ── Step 3: 일정 ──────────────────────────────────────────────
function ScheduleStep({ ec, setEc }: { ec: EventContent; setEc: (p: Partial<EventContent>) => void }) {
  const td = useWizardDict();
  const loc = useLocale().locale;
  // 스텝1 국가 선택에 따라 시간 기준 안내를 해당 국가 현지 시간으로 표기.
  const country = (ec.country as string) || '';
  const tz = country ? COUNTRY_TIMEZONE[country as keyof typeof COUNTRY_TIMEZONE] : undefined;
  const tzNote = country
    ? td.wizard.schedule.tzNote(countryLabel(country, loc), tz ? tzShortLabel(tz) : '')
    : td.wizard.schedule.tzNoteDefault;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 text-grey-500">
        <CalendarClock size={15} /> <span className="label-caps">{td.wizard.schedule.header}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <DateTime label={td.wizard.schedule.startAt} value={ec.startAt} onChange={(v) => setEc({ startAt: v })} />
        <DateTime label={td.wizard.schedule.endAt} value={ec.endAt} onChange={(v) => setEc({ endAt: v })} />
        <DateTime label={td.wizard.schedule.applyStart} value={ec.applyStart} onChange={(v) => setEc({ applyStart: v })} />
        <DateTime label={td.wizard.schedule.applyEnd} value={ec.applyEnd} onChange={(v) => setEc({ applyEnd: v })} />
      </div>
      <p className="text-xs text-grey-400">{tzNote}</p>
    </div>
  );
}

// ── Step 4: 장소(구조화 주소) ─────────────────────────────────
function AddressStep({ value, onChange }: { value: EventAddress; onChange: (v: EventAddress) => void }) {
  const td = useWizardDict();
  const set = (p: Partial<EventAddress>) => onChange({ ...value, ...p });
  // 지도 링크를 붙여넣으면 좌표를 자동 추출한다(구글맵 @lat,lng 등).
  // 좌표(Place.geo)는 로컬 검색에서 가중치가 큰 신호라 손입력을 기대하지 않고 링크에서 뽑는다.
  const onMapUrl = (url: string) => {
    const geo = parseGeoFromMapUrl(url);
    set({ mapUrl: url || undefined, ...(geo ? { lat: geo.lat, lng: geo.lng } : {}) });
  };
  const geoOk = isValidGeo(value.lat, value.lng);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-grey-500">
        <MapPin size={15} /> <span className="label-caps">{td.wizard.address.header}</span>
      </div>
      <p className="text-xs text-grey-500">{td.wizard.address.seoNote}</p>
      {/* 베뉴명·주소도 언어별(i18n) — 입력 언어 토글을 따른다. 레거시 문자열은 정규화해 표시. */}
      <I18nField label={td.wizard.address.venue} value={asI18n(value.venue)} onChange={(v) => set({ venue: v })} />
      <I18nField label={td.wizard.address.addr} value={asI18n(value.line1)} onChange={(v) => set({ line1: v })} />
      <div className="grid gap-3 sm:grid-cols-2">
        <I18nField label={td.wizard.address.city} value={asI18n(value.city)} onChange={(v) => set({ city: v })} />
        <I18nField label={td.wizard.address.province} value={asI18n(value.province)} onChange={(v) => set({ province: v })} />
      </div>
      <div className="space-y-1.5">
        <label className="label-caps">{td.wizard.address.postalCode}</label>
        <input
          className="input"
          value={value.postalCode ?? ''}
          placeholder={td.wizard.address.postalCodePh}
          onChange={(e) => set({ postalCode: e.target.value || undefined })}
        />
      </div>
      <div className="space-y-1.5">
        <label className="label-caps">{td.wizard.address.mapUrl}</label>
        <input
          className="input"
          value={value.mapUrl ?? ''}
          placeholder={td.wizard.address.mapUrlPh}
          onChange={(e) => onMapUrl(e.target.value)}
        />
        <p className={cn('text-[11px]', geoOk ? 'text-success' : 'text-grey-400')}>
          {geoOk ? td.wizard.address.geoOk(value.lat as number, value.lng as number) : td.wizard.address.geoHint}
        </p>
      </div>
    </div>
  );
}

// ── Step 5: 티켓 티어 ─────────────────────────────────────────
function TicketsStep({
  productId, value, onChange, priceText, onPriceText,
}: {
  /** 저장된 상품이어야 판매량을 셀 수 있다. 신규 작성 중이면 undefined. */
  productId?: string;
  value: EventTicketTier[];
  onChange: (v: EventTicketTier[]) => void;
  priceText: I18n;
  onPriceText: (v: I18n) => void;
}) {
  const td = useWizardDict();
  // 티켓별 판매 수량(0094). 남은 수량을 저장해 두고 빼는 대신 주문에서 센다 —
  // 환불하면 저절로 줄고, 운영자가 숫자를 손으로 맞출 일이 없다.
  const [sold, setSold] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!productId) return;
    let alive = true;
    createClient()
      .rpc('ticket_sold_counts', { p_product: productId })
      .then(({ data }) => {
        if (alive && data) setSold(data as Record<string, number>);
      });
    return () => {
      alive = false;
    };
  }, [productId]);
  const update = (i: number, p: Partial<EventTicketTier>) => onChange(value.map((t, j) => (j === i ? { ...t, ...p } : t)));
  const add = () => onChange([...value, { key: newTierKey(), type: 'full_pass', feeMode: 'client' }]);
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i));
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-grey-500">
        <Ticket size={15} /> <span className="label-caps">{td.wizard.tickets.header}</span>
      </div>
      {value.length === 0 && (
        <p className="rounded-lg bg-grey-50 p-3 text-xs text-grey-500">{td.wizard.tickets.empty}</p>
      )}
      {value.map((t, i) => (
        <div key={t.key} className="space-y-2 rounded-lg border border-grey-200 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-grey-600">{td.wizard.tickets.ticketN(i + 1)}</span>
            <button type="button" className="btn btn-secondary btn-sm text-danger" onClick={() => remove(i)}>{td.wizard.tickets.delete}</button>
          </div>
          <I18nField label={td.wizard.tickets.name} value={t.name ?? {}} onChange={(v) => update(i, { name: v })} />
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="label-caps">{td.wizard.tickets.type}</label>
              <select className="input" value={t.type ?? 'full_pass'} onChange={(e) => update(i, { type: e.target.value as TicketTierType })}>
                {TICKET_TIER_TYPE_KEYS.map((k) => <option key={k} value={k}>{td.wizard.ticketType[k]}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="label-caps">{td.wizard.tickets.units}</label>
              <input type="number" min={0} step={1} className="input" value={t.units ?? ''}
                onChange={(e) => update(i, { units: e.target.value === '' ? undefined : Math.max(0, Math.trunc(Number(e.target.value) || 0)) })} />
              {/* 판매/잔여 — 이 칸은 '총 수량'이다. 팔린 만큼을 빼서 남은 수를 따로 보여준다. */}
              {productId && typeof t.units === 'number' && t.units > 0 && (
                <p className="text-xs text-grey-500">
                  {td.wizard.tickets.soldLine(sold[t.key] ?? 0, Math.max(0, t.units - (sold[t.key] ?? 0)))}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="label-caps">{td.wizard.tickets.fee}</label>
              <select className="input" value={t.feeMode ?? 'client'} onChange={(e) => update(i, { feeMode: e.target.value as TicketFeeMode })}>
                {(['client', 'absorb'] as TicketFeeMode[]).map((m) => <option key={m} value={m}>{td.wizard.feeMode[m]}</option>)}
              </select>
            </div>
          </div>
          <PriceHikeTable
            value={t.priceTiers ?? legacyToTiers(t.price)}
            onChange={(v) => update(i, { priceTiers: v })}
          />
        </div>
      ))}
      <button type="button" className="btn btn-secondary btn-sm" onClick={add}>{td.wizard.tickets.addTicket}</button>

      {/* 비용 표기(선택) — 입력 시 티켓 가격 대신 이 문구가 COST 에 표시(현장결제/문의 등) */}
      <div className="border-t border-grey-100 pt-3">
        <I18nField label={td.wizard.tickets.priceText} value={priceText ?? {}} onChange={onPriceText} />
        <p className="mt-1 text-[11px] text-grey-400">{td.wizard.tickets.priceTextHint}</p>
      </div>
    </div>
  );
}

// 레거시 단일가(price) → Price Hike 1구간으로 변환 (기존 데이터 표시용)
function legacyToTiers(price?: Prices): EventPriceTier[] {
  if (price?.USD != null) return [{ label: tr('1차'), listPrice: price.USD, wolfPrice: price.USD }];
  return [];
}

// ── Price Hike 구간 표 (기간별 정식가/123Band 판매가, USD) ────────────────
function PriceHikeTable({
  value,
  onChange,
}: {
  value: EventPriceTier[];
  onChange: (v: EventPriceTier[]) => void;
}) {
  const td = useWizardDict();
  // 통화 전환은 입력 언어 토글(전역)을 따른다 — 없으면 어드민 UI 로케일.
  const ui = useLocale().locale;
  const g = useGlobalLocale();
  const loc = g.controlled && g.locale ? g.locale : ui;
  const showKrw = loc === 'ko'; // EN→USD($), KO→KRW(₩) 만 표시
  // 비어있으면 3구간 기본 노출. 첫 편집 시 그대로 저장된다.
  const tiers = value.length ? value : [{}, {}, {}];
  const update = (i: number, p: Partial<EventPriceTier>) =>
    onChange(tiers.map((t, j) => (j === i ? { ...t, ...p } : t)));
  const add = () => onChange([...tiers, {}]);
  const remove = (i: number) => onChange(tiers.filter((_, j) => j !== i));
  return (
    <div className="space-y-2">
      <label className="label-caps">{td.wizard.tickets.priceHeader}</label>
      <div className="grid grid-cols-12 gap-2 px-1 text-[11px] text-grey-400">
        <span className="col-span-2">{td.wizard.tickets.colName}</span>
        <span className="col-span-4">{td.wizard.tickets.colDeadline}</span>
        <span className="col-span-2">{td.wizard.tickets.colList}</span>
        <span className="col-span-2">{td.wizard.tickets.colWolf}</span>
        <span className="col-span-2" />
      </div>
      {tiers.map((t, i) => (
        <div key={i} className="grid grid-cols-12 items-center gap-2">
          <input
            className="input col-span-2"
            placeholder={String(i + 1)}
            value={t.label ?? ''}
            onChange={(e) => update(i, { label: e.target.value })}
          />
          <div className="col-span-4">
            <DateTimePicker
              value={t.until ?? ''}
              onChange={(v) => update(i, { until: v || undefined })}
              locale={loc}
            />
          </div>
          <div className="col-span-2">
            {showKrw ? (
              <WonInput value={t.listPriceKrw} onChange={(c) => update(i, { listPriceKrw: c })} />
            ) : (
              <DollarInput value={t.listPrice} onChange={(c) => update(i, { listPrice: c })} />
            )}
          </div>
          <div className="col-span-2">
            {showKrw ? (
              <WonInput value={t.wolfPriceKrw} onChange={(c) => update(i, { wolfPriceKrw: c })} />
            ) : (
              <DollarInput value={t.wolfPrice} onChange={(c) => update(i, { wolfPrice: c })} />
            )}
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm col-span-2 text-danger"
            onClick={() => remove(i)}
          >
            {td.wizard.tickets.delete}
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-secondary btn-sm" onClick={add}>{td.wizard.tickets.addTier}</button>
      <p className="text-[11px] text-grey-400">{td.wizard.tickets.tierNote}</p>
    </div>
  );
}

// USD 달러 입력(센트 저장). 소수점 입력 중 잘림 방지를 위해 로컬 텍스트 상태 사용.
function DollarInput({
  value,
  onChange,
  placeholder,
}: {
  value?: number;
  onChange: (cents: number | undefined) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(value != null ? String(toDisplayAmount(value, 'USD')) : '');
  useEffect(() => {
    const cur = text.trim() === '' ? undefined : toMinorAmount(Number(text), 'USD');
    if (cur !== value) setText(value != null ? String(toDisplayAmount(value, 'USD')) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-grey-400">$</span>
      <input
        type="number"
        min={0}
        step="0.01"
        className="input pl-6"
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          onChange(
            raw.trim() === '' || Number.isNaN(Number(raw)) ? undefined : toMinorAmount(Number(raw), 'USD'),
          );
        }}
      />
    </div>
  );
}

// KRW 원화 입력(원 단위 정수 저장, 선택). 입력하면 KO 에서 정확 표시, 없으면 USD 환산 폴백.
function WonInput({ value, onChange }: { value?: number; onChange: (won: number | undefined) => void }) {
  const [text, setText] = useState(value != null ? String(value) : '');
  useEffect(() => {
    const cur = text.trim() === '' ? undefined : toMinorAmount(Number(text), 'KRW');
    if (cur !== value) setText(value != null ? String(value) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-grey-400">₩</span>
      <input
        type="number"
        min={0}
        step={100}
        className="input pl-6"
        placeholder="KRW"
        value={text}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          onChange(
            raw.trim() === '' || Number.isNaN(Number(raw)) ? undefined : toMinorAmount(Number(raw), 'KRW'),
          );
        }}
      />
    </div>
  );
}

// ── Step 6: 대상(오디언스) ────────────────────────────────────
function AudienceStep({ value, onChange }: { value: EventAudience; onChange: (v: EventAudience) => void }) {
  const set = (p: Partial<EventAudience>) => onChange({ ...value, ...p });
  const levels = value.levels ?? [];
  const styles = value.danceStyles ?? [];
  const toggleLevel = (l: AttendeeLevel) => set({ levels: levels.includes(l) ? levels.filter((x) => x !== l) : [...levels, l] });
  const toggleStyle = (s: string) => set({ danceStyles: styles.includes(s) ? styles.filter((x) => x !== s) : [...styles, s] });
  const td = useWizardDict();
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 text-grey-500">
        <Users size={15} /> <span className="label-caps">{td.wizard.audience.header}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="label-caps">{td.wizard.audience.estimated}</label>
          <input type="number" min={0} step={1} className="input" value={value.estimatedAttendees ?? ''}
            onChange={(e) => set({ estimatedAttendees: e.target.value === '' ? undefined : Math.max(0, Math.trunc(Number(e.target.value) || 0)) })} />
        </div>
        <div className="space-y-1.5">
          <label className="label-caps">{td.wizard.audience.origin}</label>
          <select className="input" value={value.attendeesLocation ?? ''}
            onChange={(e) => set({ attendeesLocation: (e.target.value || undefined) as AttendeesLocation | undefined })}>
            <option value="">{td.wizard.audience.select}</option>
            {ATTENDEES_LOCATION_KEYS.map((k) => <option key={k} value={k}>{td.wizard.origin[k]}</option>)}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="label-caps">{td.wizard.audience.levels}</label>
        <div className="flex flex-wrap gap-2">
          {ATTENDEE_LEVEL_KEYS.map((l) => (
            <Chip key={l} active={levels.includes(l)} onClick={() => toggleLevel(l)}>{td.wizard.level[l]}</Chip>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="label-caps">{td.wizard.audience.danceStyles} {styles.length > 0 && <span className="text-grey-400">({styles.length})</span>}</label>
        <div className="flex flex-wrap gap-1.5">
          {DANCE_STYLES.map((s) => (
            <Chip key={s} active={styles.includes(s)} onClick={() => toggleStyle(s)} small>{s}</Chip>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Step 7: 상세 콘텐츠 ───────────────────────────────────────
// 검색결과에 실제 노출될 <title> 미리보기.
// 생성 규칙은 @123band/shared(buildEventTitle) 단일 소스 — SEO 제목을 비워두면 이 문구가 그대로 쓰인다.
// 길이 예산을 넘겨 잘린(…) 경우엔 빨간색으로 경고해 제목을 줄이도록 유도한다.
function SeoTitlePreview({ name, ec }: { name?: I18n; ec: EventContent }) {
  const td = useWizardDict();
  const addr = ec.address ?? {};
  const rows = (['en', 'ko'] as const).map((l) => {
    // line1 은 레거시 string 데이터가 섞여 있어 addrText 로 정규화한다.
    const line1 = addrText(addr.line1, l);
    const title = buildEventTitle({
      locale: l,
      name: pickI18n(name, l),
      manual: pickI18n(ec.seo?.title, l),
      eventType: ec.eventType,
      cityCandidates: [addrText(addr.city, l), addrText(addr.province, l), line1.split(',')[0]],
      country: seoCountryLabel(ec.country, l),
      startAt: ec.startAt,
      endAt: ec.endAt,
    });
    // 제목이 길면 예산에 밀려 의도어(Tickets/티켓)가 빠진다 — 검색노출 손실이라 경고한다.
    const missIntent = !title.toLowerCase().includes(l === 'en' ? 'tickets' : '티켓');
    const width = displayWidth(title);
    return { l, title, width, warn: width > TITLE_MAX_WIDTH || missIntent };
  });
  const warned = rows.some((r) => r.warn);
  return (
    <div className="space-y-2 rounded-lg bg-grey-50 p-3">
      <p className="text-[11px] text-grey-500">{td.wizard.content.seoTitlePreview}</p>
      {rows.map((r) => (
        <div key={r.l} className="flex items-start gap-2">
          <span className="mt-px rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase text-grey-500">
            {r.l}
          </span>
          <span className="flex-1 break-all text-[13px] leading-snug text-blue-700">{r.title}</span>
          <span className={cn('shrink-0 text-[11px] tabular-nums', r.warn ? 'text-red-500' : 'text-grey-400')}>
            {r.width}/{TITLE_MAX_WIDTH}
          </span>
        </div>
      ))}
      {warned && <p className="text-[11px] text-red-500">{td.wizard.content.seoTitleWarn}</p>}
      <p className="text-[11px] text-grey-400">{td.wizard.content.seoTitleRule}</p>
    </div>
  );
}

// 고객 사이트 주소 — 미리보기/URL 표시용.
const WEB_BASE = process.env.NEXT_PUBLIC_WEB_URL ?? 'https://123band-web.vercel.app';

/** products.slug(0035) 미적용 환경 판별 — 이때는 슬러그만 빼고 저장한다(저장 자체를 막지 않는다). */
function isMissingSlugColumn(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null;
  if (err?.code === '42703') return true; // undefined_column
  return /slug.*column|column.*slug/i.test(err?.message ?? '');
}

// 검색 주소(URL 슬러그). 검색결과에 그대로 노출되고, 한 번 발행하면 바꾸지 않는 값이다.
// 비워두면 저장 시 자동 생성 — 규칙은 @123band/shared(buildProductSlug) 단일 소스.
function SeoUrlField({
  values,
  ec,
  set,
}: {
  values: Record<string, unknown>;
  ec: EventContent;
  set: (n: string, v: unknown) => void;
}) {
  const td = useWizardDict();
  const current = typeof values.slug === 'string' ? values.slug : '';
  const productType = (values.product_type as string) ?? 'ticket';
  const auto = buildProductSlug({
    name: values.name_i18n as I18n | undefined,
    productType,
    eventType: ec.eventType,
    // 슬러그는 로케일 공용(영문) — 도시·국가도 영문 표기로 뽑는다.
    city: addrText(ec.address?.city, 'en') || addrText(ec.address?.province, 'en'),
    country: seoCountryLabel(ec.country, 'en'),
    startAt: ec.startAt,
  });
  const slug = current || auto;
  const section = productType === 'ticket' ? 'events' : 'shop';
  const published = Boolean(values.id) && Boolean(current);
  const over = slug.length > SLUG_MAX;
  return (
    <div className="space-y-1.5">
      <label className="label-caps">{td.wizard.content.seoUrl}</label>
      <div className="flex items-center rounded-lg border border-grey-200 bg-white px-2">
        <span className="shrink-0 py-2 text-[12px] text-grey-400">/en/{section}/</span>
        <input
          className="w-full border-0 bg-transparent py-2 text-[13px] outline-none"
          value={current}
          placeholder={auto}
          // 입력 중에는 끝 하이픈을 허용한다(중간 단어를 이어 칠 수 있게). 최종 정규화는 저장 시 slugify.
          onChange={(e) =>
            set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+/, ''))
          }
        />
      </div>
      <p className="break-all text-[11px] text-blue-700">{`${WEB_BASE}/en/${section}/${slug}`}</p>
      <p className={cn('text-[11px]', over ? 'text-red-500' : 'text-grey-400')}>
        {over
          ? td.wizard.content.seoUrlWarn
          : published
            ? td.wizard.content.seoUrlLocked
            : td.wizard.content.seoUrlHint}
      </p>
    </div>
  );
}

function ContentStep({
  values, set, ec, setEc,
}: {
  values: Record<string, unknown>;
  set: (n: string, v: unknown) => void;
  ec: EventContent;
  setEc: (p: Partial<EventContent>) => void;
}) {
  const td = useWizardDict();
  const setSection = (key: EventSectionKey, v: I18n) => setEc({ sections: { ...ec.sections, [key]: v } });
  const media = ec.media ?? [];
  const setMedia = (m: string[]) => setEc({ media: m });
  const moveMedia = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= media.length) return;
    const n = [...media];
    const a = n[i]; const b = n[j];
    if (a === undefined || b === undefined) return;
    n[i] = b; n[j] = a; setMedia(n);
  };

  // 라인업/공연자 — 검색 Event.performer 리치결과 소스
  const performers = ec.performers ?? [];
  const setPerformers = (p: EventPerformer[]) => setEc({ performers: p });
  const updPerformer = (i: number, patch: Partial<EventPerformer>) => {
    const n = [...performers];
    n[i] = { ...n[i], ...patch };
    setPerformers(n);
  };

  // 전용 동영상(유튜브·비메오·동영상파일) — 상세페이지에서 플레이어로 임베드
  const videos = ec.videos ?? [];
  const setVideos = (v: string[]) => setEc({ videos: v });
  const moveVideo = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= videos.length) return;
    const n = [...videos];
    const a = n[i]; const b = n[j];
    if (a === undefined || b === undefined) return;
    n[i] = b; n[j] = a; setVideos(n);
  };

  // ── 섹션 AI 초안(빈 섹션만 채우기) ─────────────────────────────
  const [secBusy, setSecBusy] = useState(false);
  const [secMsg, setSecMsg] = useState<string | null>(null);
  const [secErr, setSecErr] = useState<string | null>(null);
  const oneOf = (v?: I18n) => (v?.en?.trim() || v?.ko?.trim() || '');
  async function generateSections() {
    setSecErr(null);
    setSecMsg(null);
    const name = oneOf(values.name_i18n as I18n | undefined);
    if (!name) {
      setSecErr(td.wizard.content.aiSectionsErrName);
      return;
    }
    setSecBusy(true);
    try {
      const org = ec.organizer;
      const contactBits = [org?.contact, org?.email, org?.sns].map((s) => s?.trim()).filter(Boolean).join(' / ');
      const tickets = (ec.tickets ?? []).map((t) => oneOf(t.name)).filter(Boolean);
      const res = await fetch('/api/ai/generate-sections', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          // 이름·주최자·장소는 en/ko 를 따로 넘긴다 — 하나만 주면 영문 섹션에 한글이 박힌다.
          name,
          nameKo: (values.name_i18n as I18n | undefined)?.ko?.trim() || undefined,
          eventType: ec.eventType,
          country: ec.country,
          venue: oneOf(asI18n(ec.address?.venue)),
          venueKo: asI18n(ec.address?.venue)?.ko?.trim() || undefined,
          address: oneOf(asI18n(ec.address?.line1)),
          addressKo: asI18n(ec.address?.line1)?.ko?.trim() || undefined,
          startAt: ec.startAt,
          endAt: ec.endAt,
          applyStart: ec.applyStart,
          applyEnd: ec.applyEnd,
          organizer: oneOf(org?.name),
          organizerKo: org?.name?.ko?.trim() || undefined,
          organizerContact: contactBits,
          danceStyles: ec.audience?.danceStyles ?? [],
          levels: ec.audience?.levels ?? [],
          tickets,
          priceText: oneOf(ec.priceText),
          about: stripTags(oneOf(ec.sections?.about)),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? td.wizard.content.aiSectionsErr);
      const gen = (data.sections ?? {}) as Record<string, { en?: string; ko?: string }>;
      const nextSections: Record<string, I18n> = { ...(ec.sections ?? {}) };
      let filled = 0;
      for (const key of EVENT_SECTION_KEYS) {
        if (key === 'contact') continue; // 문의는 주최자 정보에서 자동 생성 → 여기서 건드리지 않음
        const g = gen[key];
        if (!g) continue;
        const cur = nextSections[key] ?? {};
        const next: I18n = { ...cur };
        let touched = false;
        (['en', 'ko'] as const).forEach((loc) => {
          if (g[loc] && !cur[loc]?.trim()) {
            next[loc] = asHtmlFragment(g[loc]!);
            touched = true;
          }
        });
        if (touched) {
          nextSections[key] = next;
          filled++;
        }
      }
      if (filled > 0) setEc({ sections: nextSections });
      setSecMsg(filled > 0 ? td.wizard.content.aiSectionsDone(filled) : td.wizard.content.aiSectionsNoneFilled);
    } catch (e) {
      setSecErr(e instanceof Error ? tr(e.message) : td.wizard.content.aiSectionsErr);
    } finally {
      setSecBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* 대표 이미지(포스터) */}
      <div className="space-y-1.5">
        <label className="label-caps flex items-center gap-1.5"><ImageIcon size={13} /> {td.wizard.content.poster}</label>
        <ProductImageField
          value={values.image_url as string | undefined}
          set={(v) => set('image_url', v)}
          allValues={values}
        />
      </div>

      {/* 히어로 / 소개 */}
      <div className="space-y-3 border-t border-grey-100 pt-4">
        <I18nField label={td.wizard.content.banner} value={ec.banner ?? {}} onChange={(v) => setEc({ banner: v })} />
        <I18nField label={td.wizard.content.badge} value={ec.badge ?? {}} onChange={(v) => setEc({ badge: v })} />
        <I18nField label={td.wizard.content.subtitle} value={ec.subtitle ?? {}} onChange={(v) => setEc({ subtitle: v })} />
      </div>

      {/* 미디어 갤러리 */}
      <div className="space-y-2 border-t border-grey-100 pt-4">
        <span className="label-caps">{td.wizard.content.mediaHeader}</span>
        <p className="text-xs text-grey-500">{td.wizard.content.mediaNote}</p>
        {media.map((url, i) => {
          const kind = url.trim() ? resolveMedia(url).kind : null;
          return (
            <div key={i} className="flex items-center gap-2">
              <input className="input flex-1" value={url}
                placeholder={td.wizard.content.mediaPh}
                onChange={(e) => { const n = [...media]; n[i] = e.target.value; setMedia(n); }} />
              {kind && <span className="shrink-0 rounded-pill bg-grey-100 px-2 py-1 text-xs text-grey-600">{MEDIA_KIND_LABEL[kind]}</span>}
              <button type="button" className="btn btn-secondary btn-sm" disabled={i === 0} onClick={() => moveMedia(i, -1)}>↑</button>
              <button type="button" className="btn btn-secondary btn-sm" disabled={i === media.length - 1} onClick={() => moveMedia(i, 1)}>↓</button>
              <button type="button" className="btn btn-secondary btn-sm text-danger" onClick={() => setMedia(media.filter((_, j) => j !== i))}>{td.wizard.tickets.delete}</button>
            </div>
          );
        })}
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMedia([...media, ''])}>{td.wizard.content.addUrl}</button>
      </div>

      {/* 동영상 (유튜브·비메오) — 상세페이지에서 플레이어로 재생 */}
      <div className="space-y-2 border-t border-grey-100 pt-4">
        <span className="label-caps">{td.wizard.content.videoHeader}</span>
        <p className="text-xs text-grey-500">{td.wizard.content.videoNote}</p>
        {videos.map((url, i) => {
          const kind = url.trim() ? resolveMedia(url).kind : null;
          const playable = kind ? isPlayableVideo(kind) : true;
          return (
            <div key={i} className="flex items-center gap-2">
              <input className="input flex-1" value={url}
                placeholder={td.wizard.content.videoPh}
                onChange={(e) => { const n = [...videos]; n[i] = e.target.value; setVideos(n); }} />
              {kind && (
                <span className={cn(
                  'shrink-0 rounded-pill px-2 py-1 text-xs',
                  playable ? 'bg-grey-100 text-grey-600' : 'bg-danger/10 text-danger',
                )}>
                  {playable ? MEDIA_KIND_LABEL[kind] : td.wizard.content.videoInvalid}
                </span>
              )}
              <button type="button" className="btn btn-secondary btn-sm" disabled={i === 0} onClick={() => moveVideo(i, -1)}>↑</button>
              <button type="button" className="btn btn-secondary btn-sm" disabled={i === videos.length - 1} onClick={() => moveVideo(i, 1)}>↓</button>
              <button type="button" className="btn btn-secondary btn-sm text-danger" onClick={() => setVideos(videos.filter((_, j) => j !== i))}>{td.wizard.tickets.delete}</button>
            </div>
          );
        })}
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setVideos([...videos, ''])}>{td.wizard.content.addVideo}</button>
      </div>

      {/* 라인업 / 공연자 — 검색 Event.performer 리치결과 소스 */}
      <div className="space-y-2 border-t border-grey-100 pt-4">
        <span className="label-caps">{td.wizard.content.performerHeader}</span>
        <p className="text-xs text-grey-500">{td.wizard.content.performerNote}</p>
        {performers.map((p, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-grey-100 p-3">
            <div className="flex items-center justify-between">
              <span className="label-caps text-grey-400">#{i + 1}</span>
              <button type="button" className="btn btn-secondary btn-sm text-danger"
                onClick={() => setPerformers(performers.filter((_, j) => j !== i))}>{td.wizard.tickets.delete}</button>
            </div>
            <I18nField label={td.wizard.content.performerName} value={p.name ?? {}} onChange={(v) => updPerformer(i, { name: v })} />
            <I18nField label={td.wizard.content.performerRole} value={p.role ?? {}} onChange={(v) => updPerformer(i, { role: v })} />
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="label-caps">{td.wizard.content.performerImage}</label>
                <input className="input" placeholder="https://…/photo.jpg" value={p.image ?? ''}
                  onChange={(e) => updPerformer(i, { image: e.target.value || undefined })} />
              </div>
              <div className="space-y-1.5">
                <label className="label-caps">{td.wizard.content.performerSns}</label>
                <input className="input" placeholder="https://instagram.com/…" value={p.sns ?? ''}
                  onChange={(e) => updPerformer(i, { sns: e.target.value || undefined })} />
              </div>
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPerformers([...performers, {}])}>{td.wizard.content.performerAdd}</button>
      </div>

      {/* 섹션별 콘텐츠 (리치 에디터) */}
      <div className="space-y-4 border-t border-grey-100 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-grey-500">{td.wizard.content.sectionsNote}</p>
          <button
            type="button"
            className="btn btn-secondary btn-sm shrink-0"
            onClick={generateSections}
            disabled={secBusy}
          >
            {secBusy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {secBusy ? td.wizard.content.aiSectionsBusy : td.wizard.content.aiSectionsBtn}
          </button>
        </div>
        <p className="text-[11px] leading-tight text-grey-400">{td.wizard.content.aiSectionsNote}</p>
        {secMsg && <p className="text-[11px] text-success">{secMsg}</p>}
        {secErr && <p className="text-[11px] text-danger">{secErr}</p>}
        {EVENT_SECTION_KEYS.map((key) => (
          <RichEditorI18n key={key} label={td.wizard.content.sectionPrefix(td.wizard.section[key])}
            value={ec.sections?.[key] ?? {}} onChange={(v) => setSection(key, v)} />
        ))}
      </div>

      {/* 관련 SNS 링크 (인스타·유튜브·페북·틱톡) — 상세페이지에 버튼으로 노출 */}
      <div className="space-y-3 border-t border-grey-100 pt-4">
        <div>
          <span className="label-caps flex items-center gap-1.5"><Link2 size={13} /> {td.wizard.content.linksHeader}</span>
          <p className="text-xs text-grey-500">{td.wizard.content.linksNote}</p>
        </div>
        {SOCIAL_PLATFORMS.map(({ key, label, placeholder, Icon }) => (
          <div key={key} className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-grey-200 bg-grey-50 text-grey-600" title={label}>
              <Icon size={16} />
            </span>
            <input
              className="input flex-1"
              type="url"
              placeholder={placeholder}
              value={(ec.links ?? {})[key] ?? ''}
              onChange={(e) => setEc({ links: { ...(ec.links ?? {}), [key]: e.target.value } })}
            />
          </div>
        ))}
      </div>

      {/* SEO (검색 최적화) */}
      <div className="space-y-3 border-t border-grey-100 pt-4">
        <div>
          <span className="label-caps">{td.wizard.content.seoHeader}</span>
          <p className="text-xs text-grey-500">{td.wizard.content.seoNote}</p>
        </div>
        <SeoUrlField values={values} ec={ec} set={set} />
        <I18nField label={td.wizard.content.seoTitle} value={ec.seo?.title ?? {}}
          onChange={(v) => setEc({ seo: { ...(ec.seo ?? {}), title: v } })} />
        <SeoTitlePreview name={values.name_i18n as I18n | undefined} ec={ec} />
        <I18nField label={td.wizard.content.seoDesc} value={ec.seo?.description ?? {}}
          onChange={(v) => setEc({ seo: { ...(ec.seo ?? {}), description: v } })} multiline />
        <div className="space-y-1.5">
          <label className="label-caps">{td.wizard.content.seoKeywords}</label>
          <input className="input" value={(ec.seo?.keywords ?? []).join(', ')}
            placeholder={td.wizard.content.seoKeywordsPh}
            onChange={(e) => setEc({ seo: { ...(ec.seo ?? {}), keywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } })} />
          <p className="text-[11px] text-grey-400">{td.wizard.content.seoKeywordsHint}</p>
        </div>
      </div>

      {/* 상세 페이지(AI) */}
      <div className="space-y-1.5 border-t border-grey-100 pt-4">
        <label className="label-caps">{td.wizard.content.aiDetail}</label>
        <AiProductGenerator
          value={values.detail_html_i18n as I18n | undefined}
          set={(v) => set('detail_html_i18n', v)}
          allValues={values}
        />
      </div>
    </div>
  );
}

// ── 공용 위젯 ─────────────────────────────────────────────────
function Chip({ active, onClick, children, small }: {
  active: boolean; onClick: () => void; children: React.ReactNode; small?: boolean;
}) {
  return (
    <button type="button" onClick={onClick}
      className={cn(
        'rounded-pill border font-medium transition-colors',
        small ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
        active ? 'border-transparent bg-black text-white' : 'border-grey-200 bg-white text-grey-600 hover:border-grey-300',
      )}>
      {children}
    </button>
  );
}

// ── Step 8: AI 번역(EN ↔ KO) — 한쪽 언어만 채워진 항목을 반대 언어로 채운다(선택). ──
type TxLocale = 'en' | 'ko';
function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}
// 단일 텍스트를 AI 로 번역. plain 이면 HTML 태그 제거(이름·짧은 필드용). 실패 시 null.
async function translateText(text: string, to: TxLocale, plain: boolean): Promise<string | null> {
  try {
    const res = await fetch('/api/ai/translate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ html: text, targetLocale: to }),
    });
    const j = (await res.json().catch(() => ({}))) as { html?: string };
    if (res.ok && j.html) return plain ? stripTags(j.html) : j.html;
  } catch {
    /* 무시 */
  }
  return null;
}
// 번역 대상 i18n 필드 수집 — 주어진 values(클론) 위에서 get/set 클로저를 만든다.
function collectTxFields(
  v: Record<string, unknown>,
  td: ReturnType<typeof useWizardDict>,
): { label: string; plain: boolean; get: () => I18n | undefined; set: (x: I18n) => void }[] {
  const out: { label: string; plain: boolean; get: () => I18n | undefined; set: (x: I18n) => void }[] = [];
  out.push({ label: td.wizard.basic.passName, plain: true, get: () => v.name_i18n as I18n | undefined, set: (x) => { v.name_i18n = x; } });
  out.push({ label: td.wizard.content.aiDetail, plain: false, get: () => v.detail_html_i18n as I18n | undefined, set: (x) => { v.detail_html_i18n = x; } });
  const ec = (v.event_content as EventContent) ?? {};
  v.event_content = ec;
  if (ec.organizer) {
    const org = ec.organizer;
    out.push({ label: td.wizard.organizer.name, plain: true, get: () => org.name, set: (x) => { org.name = x; } });
    out.push({ label: td.wizard.organizer.desc, plain: true, get: () => org.description, set: (x) => { org.description = x; } });
  }
  out.push({ label: td.wizard.content.badge, plain: true, get: () => ec.badge, set: (x) => { ec.badge = x; } });
  out.push({ label: td.wizard.content.subtitle, plain: true, get: () => ec.subtitle, set: (x) => { ec.subtitle = x; } });
  out.push({ label: td.wizard.tickets.priceText, plain: true, get: () => ec.priceText, set: (x) => { ec.priceText = x; } });
  out.push({ label: td.wizard.address.header, plain: true, get: () => ec.location, set: (x) => { ec.location = x; } });
  if (ec.address) {
    const addr = ec.address;
    out.push({ label: td.wizard.address.venue, plain: true, get: () => asI18n(addr.venue), set: (x) => { addr.venue = x; } });
    out.push({ label: td.wizard.address.addr, plain: true, get: () => asI18n(addr.line1), set: (x) => { addr.line1 = x; } });
  }
  if (ec.seo) {
    const seo = ec.seo;
    out.push({ label: td.wizard.content.seoTitle, plain: true, get: () => seo.title, set: (x) => { seo.title = x; } });
    out.push({ label: td.wizard.content.seoDesc, plain: true, get: () => seo.description, set: (x) => { seo.description = x; } });
  }
  if (Array.isArray(ec.tickets)) {
    ec.tickets.forEach((tk, i) => out.push({ label: `${td.wizard.tickets.name} #${i + 1}`, plain: true, get: () => tk.name, set: (x) => { tk.name = x; } }));
  }
  if (ec.sections) {
    const sections = ec.sections as Record<string, I18n>;
    for (const k of Object.keys(sections)) {
      out.push({
        label: td.wizard.content.sectionPrefix(td.wizard.section[k as EventSectionKey] ?? k),
        plain: false,
        get: () => sections[k],
        set: (x) => { sections[k] = x; },
      });
    }
  }
  return out;
}

function TranslateStep({
  values,
  setValues,
}: {
  values: Record<string, unknown>;
  setValues: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
}) {
  const td = useWizardDict();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [changes, setChanges] = useState<{ label: string; to: TxLocale; text: string }[]>([]);
  const [showReview, setShowReview] = useState(false);

  async function run(from: TxLocale, to: TxLocale) {
    if (busy) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const next = JSON.parse(JSON.stringify(values)) as Record<string, unknown>;
      const fields = collectTxFields(next, td);
      const done: { label: string; to: TxLocale; text: string }[] = [];
      for (const f of fields) {
        const cur = f.get();
        if (!cur) continue;
        const src = (cur[from] ?? '').trim();
        const tgt = (cur[to] ?? '').trim();
        // 소스 없으면 스킵. 타깃이 있어도 소스와 똑같으면 입력 미러본(아직 번역 전)이라 덮어쓴다.
        if (!src || (tgt && tgt !== src)) continue;
        const out = await translateText(src, to, f.plain);
        if (out) {
          f.set({ ...cur, [to]: out });
          done.push({ label: f.label, to, text: f.plain ? out : stripTags(out) });
        }
      }

      // 가격 자동 채움: 반대 통화가 비어 있으면 근사 환산값으로 채운다(이미 있으면 유지).
      // EN→KO: USD→KRW, KO→EN: KRW→USD.
      const ecn = next.event_content as EventContent | undefined;
      ecn?.tickets?.forEach((t, ti) => {
        (t.priceTiers ?? []).forEach((pt) => {
          const tn = td.wizard.tickets.ticketN(ti + 1);
          if (to === 'ko') {
            if (pt.listPrice != null && pt.listPriceKrw == null) {
              pt.listPriceKrw = usdCentsToKrwWon(pt.listPrice);
              done.push({ label: `${tn} · ${td.wizard.tickets.colList}`, to, text: `₩${pt.listPriceKrw.toLocaleString()}` });
            }
            if (pt.wolfPrice != null && pt.wolfPriceKrw == null) {
              pt.wolfPriceKrw = usdCentsToKrwWon(pt.wolfPrice);
              done.push({ label: `${tn} · ${td.wizard.tickets.colWolf}`, to, text: `₩${pt.wolfPriceKrw.toLocaleString()}` });
            }
          } else {
            if (pt.listPriceKrw != null && pt.listPrice == null) {
              pt.listPrice = krwWonToUsdCents(pt.listPriceKrw);
              done.push({ label: `${tn} · ${td.wizard.tickets.colList}`, to, text: `$${(pt.listPrice / 100).toLocaleString()}` });
            }
            if (pt.wolfPriceKrw != null && pt.wolfPrice == null) {
              pt.wolfPrice = krwWonToUsdCents(pt.wolfPriceKrw);
              done.push({ label: `${tn} · ${td.wizard.tickets.colWolf}`, to, text: `$${(pt.wolfPrice / 100).toLocaleString()}` });
            }
          }
        });
      });

      if (done.length) {
        setValues(next);
        setChanges(done);
        setShowReview(true);
        setMsg(td.wizard.translate.filled(done.length));
      } else {
        setMsg(td.wizard.translate.none);
      }
    } catch (e) {
      setErr(e instanceof Error ? tr(e.message) : td.wizard.translate.fail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 text-grey-500">
        <Languages size={15} /> <span className="label-caps">{td.wizard.translate.header}</span>
      </div>
      <p className="text-xs text-grey-500">{td.wizard.translate.note}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => run('en', 'ko')}>
          <Sparkles size={14} /> {td.wizard.translate.enToKo}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => run('ko', 'en')}>
          <Sparkles size={14} /> {td.wizard.translate.koToEn}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={changes.length === 0}
          onClick={() => setShowReview((s) => !s)}
        >
          {td.wizard.translate.review}{changes.length ? ` (${changes.length})` : ''}
        </button>
      </div>
      {busy && <p className="text-xs text-grey-500">{td.wizard.translate.busy}</p>}
      {msg && <p className="text-sm text-success">{msg}</p>}
      {err && <p className="text-sm text-danger">{err}</p>}

      {showReview && (
        <div className="space-y-2 rounded-lg border border-grey-200 p-3">
          <span className="label-caps">{td.wizard.translate.reviewTitle}</span>
          {changes.length === 0 ? (
            <p className="text-xs text-grey-400">{td.wizard.translate.reviewNone}</p>
          ) : (
            changes.map((c, i) => (
              <div key={i} className="border-t border-grey-100 pt-2 first:border-t-0 first:pt-0">
                <div className="flex items-center gap-1.5">
                  <span className="rounded-pill bg-grey-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-grey-600">{c.to}</span>
                  <span className="text-xs font-medium text-grey-700">{c.label}</span>
                </div>
                <p className="mt-1 line-clamp-3 text-xs text-grey-600">{c.text}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function DateTime({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  const loc = useLocale().locale;
  return (
    <div className="space-y-1.5">
      <label className="label-caps">{label}</label>
      <DateTimePicker value={value} onChange={onChange} locale={loc} />
    </div>
  );
}
