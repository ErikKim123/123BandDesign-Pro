// Design Ref: §6 — UI 고정 텍스트는 언어별 JSON (DB 아님). ja/zh-TW 는 en 폴백.
import 'server-only';
import type { Locale } from '@123band/shared';

const loaders: Record<'en' | 'ko', () => Promise<Dictionary>> = {
  en: () => import('./dictionaries/en.json').then((m) => m.default),
  ko: () => import('./dictionaries/ko.json').then((m) => m.default),
};

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  const load = loaders[locale as 'en' | 'ko'] ?? loaders.en;
  return load();
}

// en.json 을 정전(canonical) 타입 소스로 사용
import type en from './dictionaries/en.json';
export type Dictionary = typeof en;
