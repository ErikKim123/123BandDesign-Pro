// 입력 콘텐츠(name_i18n·이벤트 콘텐츠·상세 HTML 등) 전역 언어 토글 컨텍스트.
// 폼을 ActiveLocaleProvider 로 감싸면 내부 I18nField/상세에디터가 각자의 토글 대신
// 이 전역 로케일을 따른다. Provider 가 없으면 controlled=false → 각 컴포넌트가
// 기존처럼 자체 로컬 토글을 쓴다(다른 폼 호환). UI 사전 로케일(LocaleContext)과는 별개.
'use client';
import { createContext, useContext } from 'react';
import type { Locale } from '@123band/shared';

type LocaleCtx = { locale: Locale; setLocale: (l: Locale) => void };
const ActiveLocaleContext = createContext<LocaleCtx | null>(null);

export function ActiveLocaleProvider({
  value,
  children,
}: {
  value: LocaleCtx;
  children: React.ReactNode;
}) {
  return <ActiveLocaleContext.Provider value={value}>{children}</ActiveLocaleContext.Provider>;
}

/** 전역 로케일 사용 여부 + 값. controlled=false 면 호출 측이 자체 로컬 상태를 쓴다. */
export function useGlobalLocale(): { locale: Locale | null; controlled: boolean } {
  const ctx = useContext(ActiveLocaleContext);
  return ctx ? { locale: ctx.locale, controlled: true } : { locale: null, controlled: false };
}

/** 토글 UI 용 — 전역 로케일 값+setter. Provider 없으면 null. */
export function useLocaleControl(): LocaleCtx | null {
  return useContext(ActiveLocaleContext);
}
