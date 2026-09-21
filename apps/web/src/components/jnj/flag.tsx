// 국가 표기 — 시상대 카드 · 심사위원 카드 · 전체 결과 표가 같이 쓴다.
import type { Locale } from '@123band/shared';
import { intlLocale } from '@/lib/locale';

/** ISO2 → 사용자 언어의 국가명. 알 수 없으면 ''(코드 그대로 폴백). */
export function countryName(cc: string | null | undefined, locale: Locale): string {
  const code = (cc ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  try {
    return new Intl.DisplayNames([intlLocale(locale)], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * 국기 이미지. 이모지 국기(🇰🇷)는 Windows 크롬에서 글자 'KR' 로 떨어져 표가 지저분해진다.
 * → 어느 OS 에서나 같게 보이도록 이미지로 그린다. 못 부르면 alt(국가명)만 남는다.
 */
export function CountryFlag({
  cc,
  locale,
  className = '',
}: {
  cc: string | null | undefined;
  locale: Locale;
  className?: string;
}) {
  const code = (cc ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  const name = countryName(code, locale) || code;
  const lower = code.toLowerCase();
  return (
    // next/image 를 쓰기엔 20px 국기가 너무 작다(최적화 요청만 늘어난다) — 그냥 img.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w40/${lower}.png`}
      srcSet={`https://flagcdn.com/w80/${lower}.png 2x`}
      alt={name}
      title={name}
      width={20}
      height={15}
      loading="lazy"
      className={`inline-block h-[15px] w-5 shrink-0 rounded-[2px] object-cover ring-1 ring-black/10 ${className}`}
    />
  );
}
