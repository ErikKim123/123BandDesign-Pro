// Design Ref: §5.3 — 제네릭 폼 (config.formFields → 입력 렌더). i18n/prices/json/select/toggle 지원.
'use client';
import { useEffect, useState } from 'react';
import { tr, trIn } from '@/i18n/tr';
import { useLocale } from '@/lib/locale/LocaleContext';
import { I18nField } from '@/components/form/I18nField';
import { PriceField } from '@/components/form/PriceField';
import { ImageUploadField } from '@/components/form/ImageUploadField';
import { LinkListField } from '@/components/form/LinkListField';
import { genProductCode, formatEventAddress, type Locale, type EventAddress } from '@123band/shared';
import { useResourceUpsert } from '@/lib/queries/resource';
import { useT } from '@/lib/locale/LocaleContext';
import { ActiveLocaleProvider } from '@/lib/locale/active-locale';
import { cn } from '@/lib/utils';
import { fmt, type AdminDict } from '@/i18n/dict';
import type { FieldDef, ResourceConfig } from '@/lib/resource/types';

// 입력 콘텐츠 언어 토글에 노출할 언어(상품/행사패스 등은 영문·한글만)
const CONTENT_LOCALES: { locale: Locale; label: string }[] = [
  { locale: 'en', label: 'EN' },
  { locale: 'ko', label: 'KO' },
];

interface Props<T> {
  config: ResourceConfig<T>;
  initial?: Partial<T> | null;
  onDone: () => void;
  /** 특정 필드 커스텀 렌더 (예: 카테고리 parent select, 상품 attributes, AI 생성). allValues 로 다른 필드 참조 가능.
   *  setField 로 임의 필드(예: event_content)도 갱신 가능. */
  renderCustom?: (
    field: FieldDef,
    value: unknown,
    set: (v: unknown) => void,
    allValues: Record<string, unknown>,
    setField: (name: string, v: unknown) => void,
  ) => React.ReactNode;
}

/**
 * 저장 실패 사유를 사람 말로 바꾼다.
 *
 * Supabase 는 PostgrestError(평범한 객체)를 던져서 `err instanceof Error` 가 false 다.
 * 그대로 두면 무슨 일이 있어도 '저장 실패' 한 줄만 남아 원인을 알 수 없다.
 * 운영자가 실제로 마주치는 두 가지(중복 값·연결된 데이터)만 문장으로 풀고, 나머지는 원문을 보여준다.
 */
function saveErrorMessage(err: unknown, fallback: string): string {
  const e = err as { code?: string; message?: string; details?: string } | null;
  const code = e?.code;
  if (code === '23505') {
    return tr('이미 같은 값이 등록돼 있습니다. 중복되지 않는 값으로 바꿔 주세요.');
  }
  if (code === '23503') {
    return tr('연결된 데이터가 있어 저장할 수 없습니다.');
  }
  const message = (e?.message ?? '').trim();
  return message ? tr(message) : fallback;
}

export function ResourceFormPage<T extends { id?: string }>({
  config, initial, onDone, renderCustom,
}: Props<T>) {
  const t = useT();
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  // G1: json 필드별 파싱 에러 추적
  const [jsonErrors, setJsonErrors] = useState<Record<string, boolean>>({});
  // 입력 콘텐츠 전역 언어 토글(폼 상단 하나로 모든 i18n 입력 제어). 기본 EN.
  const [activeLocale, setActiveLocale] = useState<Locale>('en');
  // 저장 처리 중(자동번역 포함) 표시용 — upsert.isPending 은 DB 쓰기 구간만 커버.
  const [busy, setBusy] = useState(false);
  const upsert = useResourceUpsert<T>(config);

  // 실제 다국어(i18n) 입력 필드가 있는 폼에서만 상단 언어 토글을 노출.
  // (country/image 등 일반 custom 필드만 있는 폼에는 토글을 띄우지 않는다.)
  // bilingual 필드는 EN/KO 칸을 자체적으로 다 보여주므로 상단 토글이 필요 없다.
  const hasI18nContent = config.formFields.some(
    (f) => (f.kind === 'i18n' || f.kind === 'i18n-multiline') && !f.bilingual,
  );

  useEffect(() => {
    // 수정: 기존 행 그대로 / 신규(initial null): config.createDefaults 주입
    setValues(
      initial
        ? (initial as Record<string, unknown>)
        : { ...(config.createDefaults ?? {}) },
    );
    setJsonErrors({});
  }, [initial, config.createDefaults]);

  const set = (name: string, v: unknown) => setValues((p) => ({ ...p, [name]: v }));
  const setJsonError = (name: string, bad: boolean) =>
    setJsonErrors((p) => ({ ...p, [name]: bad }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // 필수 검증 — i18n 값은 빈 객체({})도 truthy 라 언어별 내용을 직접 본다.
    for (const f of config.formFields) {
      const v = values[f.name];
      const empty =
        f.kind === 'i18n' || f.kind === 'i18n-multiline'
          ? !Object.values((v as Record<string, string>) ?? {}).some((s) => (s ?? '').trim())
          : f.kind === 'links'
            ? !(Array.isArray(v) && v.some((u) => (u ?? '').trim()))
            : !v;
      if (f.required && empty) {
        setError(fmt(t.form.requiredField, { label: f.label }));
        return;
      }
    }
    // G1: 잘못된 JSON 차단
    const badJson = Object.entries(jsonErrors).find(([, bad]) => bad);
    if (badJson) {
      setError(t.form.jsonInvalid);
      return;
    }
    // G2: zod 스키마 검증 (Design §7)
    if (config.schema) {
      const result = config.schema.safeParse(values);
      if (!result.success) {
        const first = result.error.issues[0];
        const where = first?.path.join('.') || t.form.inputField;
        setError(`${where}: ${first?.message ?? t.form.validationFailed}`);
        return;
      }
    }
    // code 자동 생성 (폼에서 숨김) — 비어 있을 때만, 신규 생성 시.
    const payload: Record<string, unknown> = { ...values };
    // links: 빈 칸(추가만 하고 안 채운 줄)을 걸러내고 개수 상한까지만 저장한다.
    for (const f of config.formFields) {
      if (f.kind !== 'links') continue;
      const v = payload[f.name];
      if (!Array.isArray(v)) continue;
      payload[f.name] = (v as unknown[])
        .map((u) => (typeof u === 'string' ? u.trim() : ''))
        .filter(Boolean)
        .slice(0, f.maxItems ?? 3);
    }
    if (config.autoCodePrefix && !payload.code) {
      payload.code = genProductCode(config.autoCodePrefix);
    }
    setBusy(true);
    try {
      // 상세 i18n(HTML) 자동번역 — KO 비면 EN→KO 생성. 이름 등 짧은 필드는 제외(영문 폴백 유지).
      // AI 키 미설정/실패 시 무시하고 영문만 저장(폴백). 저장 자체는 막지 않는다.
      await autoTranslateI18n(payload, config.autoTranslate);
      await upsert.mutateAsync(payload as Partial<T>);
      onDone();
    } catch (err) {
      setError(saveErrorMessage(err, t.form.saveFailed));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ActiveLocaleProvider value={{ locale: activeLocale, setLocale: setActiveLocale }}>
      <form onSubmit={onSubmit} className="space-y-4">
        {hasI18nContent && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-grey-50 px-3 py-2">
            <span className="label-caps text-grey-500">{t.form.inputLanguage}</span>
            <div className="flex gap-1">
              {CONTENT_LOCALES.map(({ locale, label }) => (
                <button
                  key={locale}
                  type="button"
                  onClick={() => setActiveLocale(locale)}
                  className={cn(
                    'rounded-pill px-3 py-1 text-xs font-medium uppercase transition-colors',
                    activeLocale === locale ? 'bg-black text-white' : 'bg-white text-grey-500',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        {config.formFields.map((f) => (
          <Field
            key={f.name}
            field={f}
            value={values[f.name]}
            set={(v) => set(f.name, v)}
            setField={set}
            onJsonError={(bad) => setJsonError(f.name, bad)}
            renderCustom={renderCustom}
            allValues={values}
            t={t}
          />
        ))}
        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={busy || upsert.isPending} className="btn btn-primary btn-sm">
            {busy || upsert.isPending ? t.form.saving : t.form.save}
          </button>
          <button type="button" onClick={onDone} className="btn btn-secondary btn-sm">{t.form.cancel}</button>
        </div>
      </form>
    </ActiveLocaleProvider>
  );
}

// I18n(HTML) 의 EN 이 있고 KO 가 비었거나 EN 복사본이면 EN→KO 번역해 반환.
// 키없음/실패 시 null(영문 폴백).
async function translateI18nKo(
  obj: Record<string, string> | undefined,
): Promise<Record<string, string> | null> {
  if (!obj || typeof obj !== 'object') return null;
  const en = (obj.en ?? '').trim();
  const ko = (obj.ko ?? '').trim();
  // I18nField 는 한쪽만 채우고 넘어가는 걸 막으려 반대 언어에 같은 값을 미러링한다.
  // 그 미러본(ko === en)은 "아직 번역 안 된 상태"이므로 번역 대상에 포함한다.
  if (!en || (ko && ko !== en)) return null; // EN 없거나 KO 를 직접 손봤으면 스킵
  try {
    const res = await fetch('/api/ai/translate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ html: en, targetLocale: 'ko' }),
    });
    const j = (await res.json().catch(() => ({}))) as { html?: string };
    if (res.ok && j.html) return { ...obj, ko: j.html };
  } catch {
    // 무시 — 영문 폴백 유지
  }
  return null;
}

// 지정 i18n 필드의 KO 를 EN 에서 자동 생성. event_content 처럼 sections 를 가진 값은 섹션 본문까지 번역.
// AI 키 미설정/실패 시 조용히 건너뛴다(영문 폴백 유지). 저장을 막지 않는다.
async function autoTranslateI18n(payload: Record<string, unknown>, fields?: string[]) {
  for (const name of fields ?? []) {
    const v = payload[name];
    if (!v || typeof v !== 'object') continue;
    const obj = v as Record<string, unknown>;
    // event_content: 섹션 본문(about/venue/...) + 장소(location) 번역
    if (obj.sections || obj.address || obj.location) {
      const next: Record<string, unknown> = { ...obj };
      let changed = false;
      if (obj.sections && typeof obj.sections === 'object') {
        const sections = { ...(obj.sections as Record<string, Record<string, string>>) };
        let secChanged = false;
        for (const k of Object.keys(sections)) {
          const t = await translateI18nKo(sections[k]);
          if (t) {
            sections[k] = t;
            secChanged = true;
          }
        }
        if (secChanged) {
          next.sections = sections;
          changed = true;
        }
      }
      // 장소: location.en 없으면 구조화 주소를 소스로 KO 생성
      const loc = (obj.location ?? {}) as Record<string, string>;
      const src = (loc.en ?? '').trim() || formatEventAddress(obj.address as EventAddress | undefined);
      if (src && !(loc.ko ?? '').trim()) {
        const t = await translateI18nKo({ ...loc, en: src });
        if (t) {
          next.location = { ...loc, en: src, ko: t.ko };
          changed = true;
        }
      }
      if (changed) payload[name] = next;
      continue;
    }
    // 일반 i18n(HTML) 필드 (예: detail_html_i18n)
    const t = await translateI18nKo(obj as Record<string, string>);
    if (t) payload[name] = t;
  }
}

function Field({
  field, value, set, setField, onJsonError, renderCustom, allValues, t,
}: {
  field: FieldDef;
  value: unknown;
  set: (v: unknown) => void;
  setField: (name: string, v: unknown) => void;
  onJsonError?: (bad: boolean) => void;
  renderCustom?: Props<unknown>['renderCustom'];
  allValues: Record<string, unknown>;
  t: AdminDict;
}) {
  const { locale } = useLocale();
  const tl = (v: string | undefined) => trIn(v, locale);

  if (field.readOnly) {
    return (
      <div className="space-y-1.5">
        <label className="label-caps">{tl(field.label)}</label>
        <p className="text-sm text-grey-600">{String(value ?? '—')}</p>
      </div>
    );
  }
  switch (field.kind) {
    case 'i18n':
    case 'i18n-multiline':
      return (
        <I18nField
          label={tl(field.label)}
          required={field.required}
          multiline={field.kind === 'i18n-multiline'}
          bilingual={field.bilingual}
          placeholder={tl(field.placeholder) || undefined}
          value={(value as Record<string, string>) ?? {}}
          onChange={set}
        />
      );
    case 'prices':
      return <PriceField label={tl(field.label)} value={(value as Record<string, number>) ?? {}} onChange={set} />;
    case 'select':
      return (
        <div className="space-y-1.5">
          <label className="label-caps">{tl(field.label)}{field.required && ' *'}</label>
          <select className="input" value={(value as string) ?? ''} onChange={(e) => set(e.target.value)}>
            <option value="">{t.common.select}</option>
            {field.options?.map((o) => <option key={o.value} value={o.value}>{tl(o.label)}</option>)}
          </select>
        </div>
      );
    case 'toggle':
      return (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)} />
          <span className="label-caps">{tl(field.label)}</span>
        </label>
      );
    case 'number':
      return (
        <div className="space-y-1.5">
          <label className="label-caps">{tl(field.label)}{field.required && ' *'}</label>
          <input type="number" step={field.step ?? 1} className="input" value={(value as number) ?? ''} onChange={(e) => set(e.target.value === '' ? null : Number(e.target.value))} />
          {field.hint && <p className="text-xs text-grey-500">{tl(field.hint)}</p>}
        </div>
      );
    case 'date':
      return (
        <div className="space-y-1.5">
          <label className="label-caps">{tl(field.label)}{field.required && ' *'}</label>
          <input type="date" className="input" value={(value as string) ?? ''} onChange={(e) => set(e.target.value || null)} />
        </div>
      );
    case 'textarea':
      return (
        <div className="space-y-1.5">
          <label className="label-caps">{tl(field.label)}{field.required && ' *'}</label>
          <textarea className="input min-h-32" value={(value as string) ?? ''} onChange={(e) => set(e.target.value)} placeholder={tl(field.placeholder)} />
        </div>
      );
    case 'json':
      return <JsonField field={field} value={value} set={set} onJsonError={onJsonError} t={t} />;
    case 'image':
      return (
        <ImageUploadField
          field={field}
          value={(value as string | null) ?? undefined}
          set={set}
          allValues={allValues}
        />
      );
    case 'links':
      return <LinkListField field={field} value={value as string[] | undefined} set={set} />;
    case 'custom':
      return <>{renderCustom?.(field, value, set, allValues, setField)}</>;
    default: // text
      return (
        <div className="space-y-1.5">
          <label className="label-caps">{tl(field.label)}{field.required && ' *'}</label>
          <input className="input" value={(value as string) ?? ''} onChange={(e) => set(e.target.value)} placeholder={tl(field.placeholder)} />
          {field.hint && <p className="text-xs text-grey-500">{tl(field.hint)}</p>}
        </div>
      );
  }
}

// G1: JSON 입력 — 파싱 실패 시 에러 표시 + 상위 보고(제출 차단)
function JsonField({
  field, value, set, onJsonError, t,
}: {
  field: FieldDef;
  value: unknown;
  set: (v: unknown) => void;
  onJsonError?: (bad: boolean) => void;
  t: AdminDict;
}) {
  const { locale } = useLocale();
  const tl = (v: string | undefined) => trIn(v, locale);

  const [bad, setBad] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="label-caps">{tl(field.label)}</label>
      <textarea
        className={`input min-h-24 font-mono text-xs ${bad ? 'input-error' : ''}`}
        defaultValue={value ? JSON.stringify(value, null, 2) : ''}
        onChange={(e) => {
          const raw = e.target.value.trim();
          if (raw === '') { setBad(false); onJsonError?.(false); set({}); return; }
          try {
            set(JSON.parse(raw));
            setBad(false); onJsonError?.(false);
          } catch {
            setBad(true); onJsonError?.(true);
          }
        }}
        placeholder={tl(field.placeholder) || '{ }'}
      />
      {bad && <p className="text-[11px] text-danger">{t.form.jsonInvalidShort}</p>}
    </div>
  );
}
