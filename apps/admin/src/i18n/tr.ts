// 어드민 리소스 문자열 번역기 — gettext 방식(한국어 원문을 msgid 로 사용).
//
// 왜 이 방식인가: 리소스 설정(lib/resource/configs/*.ts)은 모듈 상수라 정의 시점에
// 로케일을 알 수 없고, 컬럼 cell 함수는 훅을 쓸 수 없다(행 수만큼 호출되어 훅 순서가 깨진다).
// 설정 19개를 전부 함수로 바꾸는 대신, 렌더 시점에 원문→영문 카탈로그로 치환한다.
// 새 문자열이 카탈로그에 없으면 한국어 원문이 그대로 나온다(깨지지 않는다).
import { pickI18n, type I18n } from '@123band/shared';
import { EN } from './resource-en';
import { DEFAULT_ADMIN_LOCALE, type AdminLocale } from './dict';

// 훅을 쓸 수 없는 곳(cell 함수, 함수로 호출되는 StatusBadge)에서도 읽어야 해서 모듈 스코프에 둔다.
// LocaleProvider 와 DataTable 이 렌더 시작 시 동기적으로 갱신한다.
let current: AdminLocale = DEFAULT_ADMIN_LOCALE;

// 서버 컴포넌트는 클라이언트와 모듈 인스턴스가 달라 LocaleProvider 가 세운 값을 못 본다 —
// 그래서 서버에서 그린 화면(대시보드·방문자수 등)은 EN 으로 바꿔도 한국어로 남았다.
// 서버 쪽은 tr-server.ts 가 요청 쿠키를 읽는 리졸버를 등록해 요청마다 로케일을 정한다.
let resolver: (() => AdminLocale | null) | null = null;

export function setTrLocaleResolver(fn: () => AdminLocale | null): void {
  resolver = fn;
}

function now(): AdminLocale {
  if (resolver) {
    try {
      const l = resolver();
      if (l) return l;
    } catch {
      // 요청 밖(빌드 시 정적 렌더 등)에서는 쿠키가 없다 — 모듈 값으로.
    }
  }
  return current;
}

export function setTrLocale(locale: AdminLocale): void {
  current = locale;
}

export function trLocale(): AdminLocale {
  return now();
}

/** 한국어 원문 → 현재 로케일 문자열. 카탈로그에 없으면 원문 그대로. */
export function tr(ko: string | null | undefined): string {
  if (!ko) return '';
  if (now() === 'ko') return ko;
  return EN[ko] ?? ko;
}

/** 지정 로케일로 번역 (컨텍스트를 아는 곳에서 명시적으로 쓸 때) */
export function trIn(ko: string | null | undefined, locale: AdminLocale): string {
  if (!ko) return '';
  if (locale === 'ko') return ko;
  return EN[ko] ?? ko;
}

// ── 데이터의 다국어 값 ────────────────────────────────────────────────────────
// UI 문구(위의 tr)와 달리 name_i18n/label_i18n/title_i18n 은 DB 에 두 언어가 들어 있다.
// 목록에서 이걸 'ko' 로 고정해 읽고 있어서 EN 로 바꿔도 이름만 한국어로 남았다.
// → 현재 어드민 로케일을 우선하고, 그 언어가 비어 있으면 반대 언어로 폴백한다.
/** 현재 어드민 로케일 기준 다국어 값 (훅을 못 쓰는 cell 함수용) */
export function trI18n(value: I18n | null | undefined): string {
  return trI18nIn(value, now());
}

/** 지정 로케일 기준 다국어 값 */
export function trI18nIn(value: I18n | null | undefined, locale: AdminLocale): string {
  return pickI18n(value, locale, locale === 'ko' ? 'en' : 'ko');
}
