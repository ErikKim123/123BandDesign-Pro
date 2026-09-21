// Design Ref: §6 다국어 — 구조는 4개 언어 대비, 1차 오픈은 en/ko. 누락은 en 폴백.
import type { Locale } from '@123band/shared';

export const locales: Locale[] = ['en', 'ko', 'ja', 'zh-TW'];
/** 1차 오픈 활성 언어 (라우팅 노출) */
export const activeLocales: Locale[] = ['en', 'ko'];
export const defaultLocale: Locale = 'en';

export function isActiveLocale(value: string): value is Locale {
  return (activeLocales as string[]).includes(value);
}
