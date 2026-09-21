// Design Ref: 어드민 로케일 컨텍스트 — 쿠키(admin_locale) 영속 + 클라이언트 전환.
'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { ADMIN_DICT, DEFAULT_ADMIN_LOCALE, type AdminLocale } from '@/i18n/dict';
import { setTrLocale } from '@/i18n/tr';

interface LocaleCtx {
  locale: AdminLocale;
  setLocale: (l: AdminLocale) => void;
}

const Ctx = createContext<LocaleCtx>({
  locale: DEFAULT_ADMIN_LOCALE,
  setLocale: () => {},
});

export function LocaleProvider({
  initial,
  children,
}: {
  initial: AdminLocale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<AdminLocale>(initial);

  // 훅을 못 쓰는 곳(리소스 설정의 cell 함수 등)이 읽는 모듈 스코프 로케일을 렌더 시점에 맞춰 둔다.
  // 렌더는 동기라 자식이 그리기 전에 반영된다.
  setTrLocale(locale);

  function setLocale(l: AdminLocale) {
    setTrLocale(l);
    setLocaleState(l);
    // 1년 유지 — 서버 컴포넌트(<html lang> 등)도 다음 요청부터 반영
    document.cookie = `admin_locale=${l}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = l;
  }

  return <Ctx.Provider value={{ locale, setLocale }}>{children}</Ctx.Provider>;
}

export const useLocale = () => useContext(Ctx);

/** 현재 로케일의 어드민 사전 */
export function useT() {
  return ADMIN_DICT[useContext(Ctx).locale];
}
