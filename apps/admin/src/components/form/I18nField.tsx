// Design Ref: §10.4 — en/ko 탭 입력. 저장 시 빈 값 제외(상위 폼에서 처리)
// 한쪽 언어만 채우고 넘어가는 사고를 막기 위해 입력값을 반대 언어로 미러링한다(mirrorI18n).
'use client';
import { useRef, useState } from 'react';
import { MIRROR_LOCALES, isMirrorI18n, mirrorI18n, type I18n, type Locale } from '@123band/shared';
import { useT } from '@/lib/locale/LocaleContext';
import { useGlobalLocale } from '@/lib/locale/active-locale';
import { cn } from '@/lib/utils';

// 1차: en/ko (구조는 4개 언어 대비)
const TABS: { locale: Locale; label: string }[] = [
  { locale: 'en', label: 'EN' },
  { locale: 'ko', label: 'KO' },
];

interface Props {
  label: string;
  value: I18n;
  onChange: (next: I18n) => void;
  multiline?: boolean;
  required?: boolean;
  /** 토글 없이 EN(왼쪽)·KO(오른쪽) 입력칸을 나란히 노출 */
  bilingual?: boolean;
  /** 설정(FieldDef)의 안내 문구 — 두 언어가 다 비었을 때 "비우면 어떻게 되는지" 를 알려준다. */
  placeholder?: string;
}

/**
 * 좌우 2열 입력 — 왼쪽 EN(원문), 오른쪽 KO(번역).
 * 토글식과 달리 두 언어가 항상 보여서 "한글을 안 채운 글"이 눈에 바로 걸린다.
 * 미러링(반대 언어 자동 복사)은 하지 않는다 — 옆 칸이 비어 있는 게 곧 번역 필요 표시다.
 */
function BilingualField({ label, value, onChange, multiline, required, placeholder }: Props) {
  const t = useT();
  const set = (locale: Locale, text: string) => onChange({ ...value, [locale]: text });
  const en = value.en ?? '';
  const ko = value.ko ?? '';

  return (
    <div className="space-y-1.5">
      <label className="label-caps">{label}{required && ' *'}</label>
      <div className="grid gap-3 md:grid-cols-2">
        {TABS.map(({ locale, label: tab }) => {
          const cur = locale === 'en' ? en : ko;
          return (
            <div key={locale} className="space-y-1">
              <span className="inline-flex items-center rounded-pill bg-grey-100 px-2 py-0.5 text-[11px] font-medium uppercase text-grey-600">
                {tab}
              </span>
              {multiline ? (
                <textarea
                  // 본문은 원문·번역을 나란히 놓고 끝까지 읽어야 해서 넉넉하게 잡는다.
                  className="input min-h-[26rem] leading-relaxed"
                  value={cur}
                  placeholder={locale === 'ko' && !ko ? en || undefined : undefined}
                  onChange={(e) => set(locale, e.target.value)}
                />
              ) : (
                <input
                  className="input"
                  value={cur}
                  placeholder={locale === 'ko' && !ko ? en || undefined : undefined}
                  onChange={(e) => set(locale, e.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>
      {/* 둘 다 비었으면 "비워 두면 어떻게 되는지" 안내부터 — 부문 FORMAT 처럼 상위 값으로 폴백되는 칸이 있다. */}
      {!en.trim() && !ko.trim() && !!placeholder && (
        <p className="text-[11px] text-grey-400">{placeholder}</p>
      )}
      {/* KO 를 비우면 고객 화면에서 영문으로 노출된다(폴백). */}
      {!ko.trim() && !!en.trim() && (
        <p className="text-[11px] text-grey-400">{t.form.i18nFallbackFrom('EN')}</p>
      )}
    </div>
  );
}

export function I18nField({ label, value, onChange, multiline, required, bilingual, placeholder }: Props) {
  if (bilingual) {
    return (
      <BilingualField
        label={label}
        value={value}
        onChange={onChange}
        multiline={multiline}
        required={required}
        placeholder={placeholder}
      />
    );
  }
  return (
    <ToggleI18nField
      label={label}
      value={value}
      onChange={onChange}
      multiline={multiline}
      required={required}
      placeholder={placeholder}
    />
  );
}

function ToggleI18nField({ label, value, onChange, multiline, required, placeholder }: Props) {
  // 전역 토글이 있으면 그 로케일을 따르고 자체 토글은 숨긴다. 없으면 로컬 토글.
  const t = useT();
  const g = useGlobalLocale();
  const [localActive, setLocalActive] = useState<Locale>('en');
  const active = g.controlled && g.locale ? g.locale : localActive;

  // 반대 언어(en↔ko) — 미러 상태 표시와 빈 칸 플레이스홀더에 쓴다.
  const other = MIRROR_LOCALES.find((l) => l !== active) ?? 'en';
  const cur = value[active] ?? '';
  const otherText = (value[other] ?? '').trim();
  const mirrored = isMirrorI18n(value, active, other);

  // 마지막으로 친 칸. 다른 칸으로 건너가 첫 타를 치는 순간은 '번역을 시작한다'는 뜻이라
  // 반대 언어를 따라가게 두면 안 된다(그렇게 두면 EN 을 고칠 때 KO 까지 덮인다).
  const lastEdited = useRef<Locale | null>(null);

  function set(locale: Locale, text: string) {
    const continuing = lastEdited.current === locale;
    lastEdited.current = locale;
    onChange(mirrorI18n(value, locale, text, MIRROR_LOCALES, continuing));
  }

  // 안내는 한 줄만 — 통째로 빈 칸(설정 안내) > EN 공백(폴백 불가) > 미러본 > 폴백 예고 순.
  const hint =
    !cur.trim() && !otherText && placeholder
      ? placeholder
      : active !== 'en' && !value.en?.trim()
        ? t.form.i18nFallbackHint
        : mirrored
          ? t.form.i18nMirrorHint(other.toUpperCase())
          : !cur.trim() && otherText
            ? t.form.i18nFallbackFrom(other.toUpperCase())
            : null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="label-caps">{label}{required && ' *'}</label>
        {!g.controlled && (
          <div className="flex gap-1">
            {TABS.map(({ locale, label }) => (
              <button
                key={locale}
                type="button"
                onClick={() => setLocalActive(locale)}
                className={cn(
                  'rounded-pill px-2.5 py-0.5 text-[11px] font-medium uppercase transition-colors',
                  active === locale ? 'bg-black text-white' : 'bg-grey-100 text-grey-500',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      {multiline ? (
        <textarea
          className="input min-h-24"
          value={cur}
          placeholder={!cur ? otherText || undefined : undefined}
          onChange={(e) => set(active, e.target.value)}
        />
      ) : (
        <input
          className="input"
          value={cur}
          placeholder={!cur ? otherText || undefined : undefined}
          onChange={(e) => set(active, e.target.value)}
        />
      )}
      {hint && <p className="text-[11px] text-grey-400">{hint}</p>}
    </div>
  );
}
