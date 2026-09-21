// 전역 언어 토글(ActiveLocaleProvider)에 맞춰 오거나이저 UI 사전을 반환한다.
'use client';
import { useGlobalLocale } from '@/lib/i18n/locale-context';
import { DICT, type PartnerDict } from './dict';

export function useT(): PartnerDict {
  const { locale } = useGlobalLocale();
  return locale === 'en' ? DICT.en : DICT.ko;
}
