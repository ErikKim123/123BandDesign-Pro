// Design Ref: §10.4 — en/ko 탭 입력. 저장 시 빈 값 제외(상위 폼에서 처리)
// 한쪽 언어만 채우고 넘어가는 사고를 막기 위해 입력값을 반대 언어로 미러링한다(mirrorI18n).
'use client';
import { useRef, useState } from 'react';
import { MIRROR_LOCALES, isMirrorI18n, mirrorI18n, type I18n, type Locale } from '@123band/shared';
import { useGlobalLocale } from '@/lib/i18n/locale-context';
import { useT } from '@/i18n/useT';
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
}

export function I18nField({ label, value, onChange, multiline, required }: Props) {
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

  // 안내는 한 줄만 — EN 공백(폴백 불가) > 미러본 > 폴백 예고 순.
  const hint =
    active !== 'en' && !value.en?.trim()
      ? t.editor.enFallback
      : mirrored
        ? t.editor.mirrorNote(other.toUpperCase())
        : !cur.trim() && otherText
          ? t.editor.fallbackNote(other.toUpperCase())
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
