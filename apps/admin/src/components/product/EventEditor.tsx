// Design Ref: 티켓 이벤트 페이지 템플릿 — 입력형 콘텐츠 에디터(EventContent). en/ko.
// 편집 시 목록 쿼리에 event_content 가 없으므로 id 로 직접 fetch 해 기존 값을 채운다.
'use client';
import { useEffect, useRef, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import {
  EVENT_SECTION_KEYS,
  resolveMedia,
  MEDIA_KIND_LABEL,
  type EventContent,
  type EventSectionKey,
  type I18n,
} from '@123band/shared';
import { createClient } from '@/lib/supabase/client';
import { I18nField } from '@/components/form/I18nField';
import { DateTimePicker } from '@/components/form/DateTimePicker';
import { useT, useLocale } from '@/lib/locale/LocaleContext';
import { fmt } from '@/i18n/dict';

export function EventEditor({
  value,
  set,
  allValues,
}: {
  value: EventContent | undefined;
  set: (v: EventContent) => void;
  allValues: Record<string, unknown>;
}) {
  const t = useT();
  const ev: EventContent = value ?? {};
  const productType = allValues.product_type as string | undefined;
  const id = allValues.id as string | undefined;
  const fetchedRef = useRef(false);
  const [loading, setLoading] = useState(false);

  // 편집 진입 시 기존 event_content 로드 (목록 쿼리에 미포함)
  useEffect(() => {
    if (fetchedRef.current || value !== undefined || !id) return;
    fetchedRef.current = true;
    setLoading(true);
    createClient()
      .from('products')
      .select('event_content')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.event_content) set(data.event_content as EventContent);
      })
      .then(undefined, () => {})
      .then(() => setLoading(false));
  }, [id, value, set]);

  const patch = (p: Partial<EventContent>) => set({ ...ev, ...p });
  const setSection = (key: EventSectionKey, v: I18n) =>
    set({ ...ev, sections: { ...ev.sections, [key]: v } });

  // 미디어(언어공통 URL 배열)
  const media = ev.media ?? [];
  const setMedia = (m: string[]) => patch({ media: m });
  const moveMedia = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= media.length) return;
    const n = [...media];
    const a = n[i];
    const b = n[j];
    if (a === undefined || b === undefined) return;
    n[i] = b;
    n[j] = a;
    setMedia(n);
  };

  if (productType && productType !== 'ticket') {
    return (
      <p className="rounded-lg bg-grey-50 p-3 text-xs text-grey-500">{t.eventEditor.onlyTicket}</p>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-grey-200 p-4">
      <div className="flex items-center gap-2">
        <CalendarClock size={16} />
        <span className="label-caps">{t.eventEditor.title}</span>
        {loading && <span className="text-xs text-grey-400">{t.eventEditor.loading}</span>}
      </div>

      <I18nField label={t.eventEditor.field.banner} value={ev.banner ?? {}} onChange={(v) => patch({ banner: v })} />
      <I18nField label={t.eventEditor.field.badge} value={ev.badge ?? {}} onChange={(v) => patch({ badge: v })} />
      <I18nField label={t.eventEditor.field.subtitle} value={ev.subtitle ?? {}} onChange={(v) => patch({ subtitle: v })} />
      <I18nField label={t.eventEditor.field.location} value={ev.location ?? {}} onChange={(v) => patch({ location: v })} />
      <I18nField
        label={t.eventEditor.field.priceText}
        value={ev.priceText ?? {}}
        onChange={(v) => patch({ priceText: v })}
      />

      {/* 일시 / 신청 기간 */}
      <div className="grid grid-cols-2 gap-3">
        <DateTime label={t.eventEditor.field.startAt} value={ev.startAt} onChange={(v) => patch({ startAt: v })} />
        <DateTime label={t.eventEditor.field.endAt} value={ev.endAt} onChange={(v) => patch({ endAt: v })} />
        <DateTime label={t.eventEditor.field.applyStart} value={ev.applyStart} onChange={(v) => patch({ applyStart: v })} />
        <DateTime label={t.eventEditor.field.applyEnd} value={ev.applyEnd} onChange={(v) => patch({ applyEnd: v })} />
      </div>

      {/* 미디어 (언어공통) — 본문 상단 갤러리 */}
      <div className="space-y-2 border-t border-grey-100 pt-4">
        <span className="label-caps">{t.eventEditor.mediaTitle}</span>
        <p className="text-xs text-grey-500">{t.eventEditor.mediaHint}</p>
        {media.map((url, i) => {
          const kind = url.trim() ? resolveMedia(url).kind : null;
          return (
            <div key={i} className="flex items-center gap-2">
              <input
                className="input flex-1"
                value={url}
                placeholder={t.eventEditor.mediaUrlPh}
                onChange={(e) => {
                  const n = [...media];
                  n[i] = e.target.value;
                  setMedia(n);
                }}
              />
              {kind && (
                <span className="shrink-0 rounded-pill bg-grey-100 px-2 py-1 text-xs text-grey-600">
                  {MEDIA_KIND_LABEL[kind]}
                </span>
              )}
              <button type="button" className="btn btn-secondary btn-sm" disabled={i === 0}
                onClick={() => moveMedia(i, -1)}>
                ↑
              </button>
              <button type="button" className="btn btn-secondary btn-sm" disabled={i === media.length - 1}
                onClick={() => moveMedia(i, 1)}>
                ↓
              </button>
              <button type="button" className="btn btn-secondary btn-sm text-danger"
                onClick={() => setMedia(media.filter((_, j) => j !== i))}>
                {t.eventEditor.delete}
              </button>
            </div>
          );
        })}
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMedia([...media, ''])}>
          {t.eventEditor.addUrl}
        </button>
      </div>

      {/* 섹션별 i18n HTML */}
      <div className="space-y-4 border-t border-grey-100 pt-4">
        <p className="text-xs text-grey-500">{t.eventEditor.sectionsHint}</p>
        {EVENT_SECTION_KEYS.map((key) => (
          <I18nField
            key={key}
            label={fmt(t.eventEditor.sectionLabel, { name: t.eventEditor.section[key] })}
            value={ev.sections?.[key] ?? {}}
            onChange={(v) => setSection(key, v)}
            multiline
          />
        ))}
      </div>
    </div>
  );
}

function DateTime({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
}) {
  // 네이티브 datetime-local 은 Chrome 에서 브라우저 로케일(한국어)을 강제하므로 커스텀 선택기로 대체.
  const { locale } = useLocale();
  return (
    <div className="space-y-1.5">
      <label className="label-caps">{label}</label>
      <DateTimePicker value={value} onChange={onChange} locale={locale} />
    </div>
  );
}
