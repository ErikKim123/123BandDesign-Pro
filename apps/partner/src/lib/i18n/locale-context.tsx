// 전역 언어(EN/KO) 토글 컨텍스트.
// 위저드 등에서 ActiveLocaleProvider 로 감싸면 내부 I18nField/RichEditorI18n 이
// 각자의 토글 대신 이 전역 로케일을 따른다. Provider 가 없으면 controlled=false →
// 각 컴포넌트가 기존처럼 자체 로컬 토글을 쓴다(다른 폼 호환).
'use client';
import { createContext, useContext } from 'react';
import { pickI18n, type I18n, type Locale } from '@123band/shared';

type LocaleCtx = { locale: Locale; setLocale: (l: Locale) => void };
const LocaleContext = createContext<LocaleCtx | null>(null);

export function ActiveLocaleProvider({
  value,
  children,
}: {
  value: LocaleCtx;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** 전역 로케일 사용 여부 + 값. controlled=false 면 호출 측이 자체 로컬 상태를 쓴다. */
export function useGlobalLocale(): { locale: Locale | null; controlled: boolean } {
  const ctx = useContext(LocaleContext);
  return ctx ? { locale: ctx.locale, controlled: true } : { locale: null, controlled: false };
}

/** 토글 UI 용 — 전역 로케일 값+setter. Provider 없으면 null. */
export function useLocaleControl(): LocaleCtx | null {
  return useContext(LocaleContext);
}

/**
 * 데이터의 다국어 값(name_i18n 등)을 현재 언어로 읽는 함수.
 * 목록에서 'ko' 로 고정해 읽던 자리를 대체한다 — EN 으로 바꿔도 이름만 한국어로 남던 문제.
 * 현재 언어가 비어 있으면 반대 언어로 폴백한다.
 */
export function useI18nText(): (value: I18n | null | undefined) => string {
  const { locale } = useGlobalLocale();
  const l: Locale = locale ?? 'ko';
  return (value) => pickI18n(value, l, l === 'ko' ? 'en' : 'ko');
}
