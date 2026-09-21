// 회원활동 화면 공용 표기 헬퍼.
import { tr } from '@/i18n/tr';

/** "3일 전" 상대 시각 — 카드에서 마지막 활동이 얼마나 오래됐는지 한눈에 보려고 쓴다. */
export function fmtAgo(v: string | null | undefined): string {
  if (!v) return '—';
  const ms = Date.now() - new Date(v).getTime();
  if (Number.isNaN(ms)) return '—';
  if (ms < 0) return tr('방금 전'); // 서버·클라이언트 시계 차이
  const min = Math.floor(ms / 60_000);
  if (min < 1) return tr('방금 전');
  if (min < 60) return `${min}${tr('분 전')}`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}${tr('시간 전')}`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}${tr('일 전')}`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}${tr('개월 전')}`;
  return `${Math.floor(mo / 12)}${tr('년 전')}`;
}

// ISO2 국가코드 → 표시 국가명. 회원관리 목록(members.ts)과 같은 방식.
const REGION_NAMES = (() => {
  try {
    return new Intl.DisplayNames(undefined, { type: 'region' });
  } catch {
    return null;
  }
})();

export function countryLabel(code: string | null | undefined): string {
  const v = String(code ?? '').trim();
  if (!v) return '';
  try {
    return REGION_NAMES?.of(v.toUpperCase()) ?? v;
  } catch {
    return v;
  }
}
