// Design Ref: §6 — locale → 표시 통화/Intl 로케일 매핑 (메인 가격 표기용)
import type { Currency, Locale } from '@123band/shared';

export function currencyForLocale(locale: Locale): Currency {
  return locale === 'ko' ? 'KRW' : 'USD';
}

export function intlLocale(locale: Locale): string {
  switch (locale) {
    case 'ko':
      return 'ko-KR';
    case 'ja':
      return 'ja-JP';
    case 'zh-TW':
      return 'zh-TW';
    default:
      return 'en-US';
  }
}
