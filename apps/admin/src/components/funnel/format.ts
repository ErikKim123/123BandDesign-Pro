// 퍼널분석 화면들이 공유하는 표기 규칙. 서버 컴포넌트(page.tsx)와 클라이언트 컴포넌트
// (FunnelSessions)가 같은 함수를 써야 같은 숫자가 같은 모양으로 나온다.
import { trLocale } from '@/i18n/tr';
import type { FunnelStep } from '@/lib/queries/funnel';

export const STEP_LABEL: Record<FunnelStep, string> = {
  visit: '사이트 방문',
  product_view: '상품·행사 조회',
  cart: '장바구니',
  checkout: '결제 시작',
  purchase: '결제 완료',
};

/**
 * 시각 표기. 반드시 KST 로 고정한다 — 서버(Vercel=UTC)와 브라우저(로컬 TZ)가 서로 다른
 * 문자열을 만들면 하이드레이션이 깨진다. 집계 자체가 KST 기준이라(0056) 표기도 KST 가 맞다.
 */
export function formatKst(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? '00';
  return `${get('month')}/${get('day')} ${get('hour')}:${get('minute')}`;
}

/**
 * 표 안의 좁은 칸용 — 0:42 · 3:07 처럼 분:초로 읽힌다.
 *
 * 1시간을 넘으면 시:분:초를 쓰지 않는다. "30:47:07" 은 30시간인데 30분으로 읽히고,
 * 애초에 이 자리에 몇 시간짜리 값이 나오는 건 '단계 사이 소요시간'처럼 며칠에 걸친
 * 재방문이 섞인 경우다 — 초 단위 정밀도가 의미 없다. 그래서 단위를 붙여 끊어 준다.
 */
export function formatDur(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const en = trLocale() === 'en';
  if (s >= 86400) {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    return en ? `${d}d ${h}h` : `${d}일 ${h}시간`;
  }
  if (s >= 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return en ? `${h}h ${m}m` : `${h}시간 ${m}분`;
  }
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * 큰 숫자 카드용 — "3분 7초" / "3m 7s". 읽어서 바로 감이 오게.
 * 단위는 카탈로그(tr)를 안 쓴다 — '시간'·'분' 은 이미 다른 뜻으로 번역돼 있어서
 * 여기에 맞춰 바꾸면 다른 화면이 깨진다. 로케일만 보고 직접 고른다.
 */
export function formatDurLong(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const en = trLocale() === 'en';
  const u = en
    ? { h: 'h', m: 'm', s: 's', sep: '' }
    : { h: '시간', m: '분', s: '초', sep: '' };
  if (s < 60) return `${s}${u.sep}${u.s}`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}${u.h} ${m}${u.m}`;
  return `${m}${u.m} ${s % 60}${u.s}`;
}

/** 방문 안의 화면 목록용 — 날짜는 그 방문의 머리줄에 이미 있으니 시:분만. */
export function formatKstTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

export const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
