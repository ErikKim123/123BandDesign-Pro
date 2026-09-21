// Design Ref: §10.4 — 다국어 폴백 규약 (누락 시 'en' 폴백)
import { DEFAULT_LOCALE, type I18n, type Locale } from './types/index';

/**
 * I18n 값에서 현재 locale 텍스트를 고른다.
 * 1) 요청 locale → 2) fallback locale → 3) 값이 있는 첫 언어 → 4) ''
 */
export function pickI18n(
  value: I18n | null | undefined,
  locale: Locale,
  fallback: Locale = DEFAULT_LOCALE,
): string {
  if (!value) return '';
  const direct = value[locale];
  if (direct != null && direct !== '') return direct;

  const fb = value[fallback];
  if (fb != null && fb !== '') return fb;

  for (const v of Object.values(value)) {
    if (v != null && v !== '') return v;
  }
  return '';
}

/** 입력 UI 에서 서로 미러링하는 언어쌍 (1차 en/ko — 구조는 4개 언어 대비) */
export const MIRROR_LOCALES: readonly Locale[] = ['en', 'ko'];

/**
 * 입력 언어 미러링 — 한쪽 언어에 입력하면 "아직 손대지 않은" 반대 언어에도 같은 값을 넣는다.
 * 소유(ownership) 규칙: 대상 언어가 비어 있거나 직전 입력 언어 값과 똑같으면 = 우리가 넣은 미러본 → 갱신.
 * 사용자가 대상 언어를 직접 고쳐 값이 갈라지면 소유가 풀려 다시는 덮어쓰지 않는다.
 * EN 이 폴백 언어라 KO→EN 방향도 함께 미러해 폴백 구멍(EN 빈 값)을 막는다.
 */
export function mirrorI18n(
  value: I18n,
  locale: Locale,
  text: string,
  locales: readonly Locale[] = MIRROR_LOCALES,
  /**
   * '지금 이 칸을 이어서 치는 중' 인가. 호출부가 판단해서 넘긴다.
   *
   * 이 인자가 없던 시절에는 `cur === prev` 만 보고 따라갔는데, 두 언어가 같은 동안에는
   * 그 조건이 항상 참이라 **UI 로는 두 언어를 다르게 만들 수가 없었다**:
   *   KO 에 '홈' → EN 도 '홈' → EN 탭에서 'Home' 입력 → KO 까지 'Home' 으로 덮임.
   * 다른 칸으로 건너가 첫 타를 치는 순간은 '번역을 시작한다'는 뜻이므로 따라가면 안 된다.
   */
  continuing = true,
): I18n {
  const prev = value[locale] ?? '';
  const next: I18n = { ...value, [locale]: text };
  for (const l of locales) {
    if (l === locale) continue;
    const cur = value[l] ?? '';
    // 빈 칸은 언제나 채워 준다(한쪽만 채우고 넘어가는 사고 방지).
    // 값이 있는 칸은 이어서 치는 중이고 아직 복사본일 때만 따라간다.
    if (cur === '' || (continuing && cur === prev)) next[l] = text;
  }
  return next;
}

/** 해당 언어 값이 다른 언어의 복사본(미러본)인지 — 번역 대상 판별·배지 표시용 */
export function isMirrorI18n(value: I18n | null | undefined, locale: Locale, from: Locale): boolean {
  const a = (value?.[locale] ?? '').trim();
  const b = (value?.[from] ?? '').trim();
  return !!a && a === b;
}

/** locale 문자열을 지원 목록으로 정규화 (미지원 시 기본 locale) */
export function normalizeLocale(input: string | null | undefined): Locale {
  const candidates: Locale[] = ['en', 'ko', 'ja', 'zh-TW'];
  return candidates.find((l) => l === input) ?? DEFAULT_LOCALE;
}
