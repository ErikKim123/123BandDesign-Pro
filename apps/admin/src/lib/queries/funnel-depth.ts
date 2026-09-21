// Design Ref: §5 — 퍼널분석 심화(0085 RPC). "어떤 사람이 · 어느 화면을 · 몇 분 봤나".
//
// queries/funnel.ts 는 '몇 명이 넘어갔나'(전환율)를 다룬다. 이 파일은 거기 없던 시간 축이다.
//   · 화면별 체류시간 — 어디서 오래 머물고 어디서 나가는지
//   · 단계 사이 소요시간 — 전환에 얼마나 뜸을 들이는지
//   · 방문(세션) 목록 — 한 사람의 한 번의 방문을 화면 순서대로
//
// 체류시간의 출처가 둘(브라우저 측정 · 다음 조회까지의 간격)이라 measuredRate 를 같이 읽는다.
// 이 값이 낮은 화면의 숫자는 추정 비중이 크다는 뜻이다 — 0085 머리말 참고.
import { createClient } from '@/lib/supabase/server';
import type { FunnelStep } from './funnel';

/** 화면 한 장의 체류·이탈 요약. */
export interface PageDwellRow {
  path: string;
  /** 이 경로가 속한 퍼널 단계(해당 없으면 null) */
  step: FunnelStep | null;
  pageviews: number;
  visitors: number;
  avgSec: number;
  medianSec: number;
  totalSec: number;
  /** 이 화면에서 방문이 끝난 횟수 */
  exits: number;
  exitRate: number;
  /** 브라우저가 실제로 잰 값의 비율 — 낮으면 추정 비중이 크다 */
  measuredRate: number;
}

/** 단계 → 단계로 넘어가는 데 걸린 시간. */
export interface StepTimingRow {
  fromStep: FunnelStep;
  toStep: FunnelStep;
  samples: number;
  medianSec: number;
  avgSec: number;
  p90Sec: number;
}

/** 한 사람의 한 번의 방문. */
export interface SessionRow {
  visitorId: string;
  sessionNo: number;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  startedAt: string;
  endedAt: string;
  durationSec: number;
  pageviews: number;
  entryPath: string;
  exitPath: string;
  maxStep: FunnelStep;
  converted: boolean;
  revenue: number;
  device: string | null;
  country: string | null;
  /** page_views.city — Vercel 지오 헤더(0060). 로컬·일부 요청은 null. */
  city: string | null;
  /** profiles.gender(0108) — 로그인한 적 있는 방문자만. female | male | other */
  gender: string | null;
}

/** 기간 전체의 방문 요약 — 목록(최근 50건)이 아니라 전 기간 기준이다. */
export interface SessionStats {
  sessions: number;
  visitors: number;
  /** 로그인 이력이 있어 회원으로 식별된 방문자 수 */
  members: number;
  avgDuration: number;
  medianDuration: number;
  avgPageviews: number;
  /** 화면 하나만 보고 끝난 방문의 비율 */
  bounceRate: number;
}

/** 방문 기록 목록의 정렬 축 — 0086 admin_funnel_sessions 의 p_sort 와 1:1. */
export const SESSION_SORTS = ['visitor', 'started', 'duration', 'pageviews', 'step', 'revenue'] as const;
export type SessionSort = (typeof SESSION_SORTS)[number];
export type SortDir = 'asc' | 'desc';

export function isSessionSort(v: unknown): v is SessionSort {
  return SESSION_SORTS.includes(v as SessionSort);
}

export interface FunnelDepth {
  days: number;
  sort: SessionSort;
  dir: SortDir;
  stats: SessionStats;
  pages: PageDwellRow[];
  timings: StepTimingRow[];
  sessions: SessionRow[];
  /** 기간 내 전체 방문 수(목록은 그중 일부만 싣는다) */
  totalSessions: number;
}

const num = (v: unknown) => Number(v ?? 0);

const EMPTY_STATS: SessionStats = {
  sessions: 0,
  visitors: 0,
  members: 0,
  avgDuration: 0,
  medianDuration: 0,
  avgPageviews: 0,
  bounceRate: 0,
};

export async function getFunnelDepth(
  days: number,
  sort: SessionSort = 'started',
  dir: SortDir = 'desc',
  sessionLimit = 50,
  end: string | null = null,
): Promise<FunnelDepth> {
  const supabase = createClient();
  const [pageRes, timingRes, sessionRes, statsRes] = await Promise.all([
    supabase.rpc('admin_funnel_page_dwell', { p_days: days, p_limit: 20, p_end: end }),
    supabase.rpc('admin_funnel_step_timing', { p_days: days, p_end: end }),
    supabase.rpc('admin_funnel_sessions', {
      p_days: days,
      p_limit: sessionLimit,
      p_offset: 0,
      p_only_members: false,
      p_sort: sort,
      p_dir: dir,
      p_end: end,
    }),
    supabase.rpc('admin_funnel_session_stats', { p_days: days, p_end: end }),
  ]);

  const pages: PageDwellRow[] = ((pageRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
    path: String(r.path ?? ''),
    step: (r.step as FunnelStep | null) ?? null,
    pageviews: num(r.pageviews),
    visitors: num(r.visitors),
    avgSec: num(r.avg_sec),
    medianSec: num(r.median_sec),
    totalSec: num(r.total_sec),
    exits: num(r.exits),
    exitRate: num(r.exit_rate),
    measuredRate: num(r.measured_rate),
  }));

  const timings: StepTimingRow[] = ((timingRes.data ?? []) as Record<string, unknown>[]).map(
    (r) => ({
      fromStep: r.from_step as FunnelStep,
      toStep: r.to_step as FunnelStep,
      samples: num(r.samples),
      medianSec: num(r.median_sec),
      avgSec: num(r.avg_sec),
      p90Sec: num(r.p90_sec),
    }),
  );

  const rawSessions = (sessionRes.data ?? []) as Record<string, unknown>[];
  const sessions: SessionRow[] = rawSessions.map((r) => ({
    visitorId: String(r.visitor_id ?? ''),
    sessionNo: num(r.session_no),
    userId: (r.user_id as string | null) ?? null,
    userName: (r.user_name as string | null) ?? null,
    userEmail: (r.user_email as string | null) ?? null,
    startedAt: String(r.started_at ?? ''),
    endedAt: String(r.ended_at ?? ''),
    durationSec: num(r.duration_sec),
    pageviews: num(r.pageviews),
    entryPath: String(r.entry_path ?? ''),
    exitPath: String(r.exit_path ?? ''),
    maxStep: (r.max_step as FunnelStep) ?? 'visit',
    converted: Boolean(r.converted),
    revenue: num(r.revenue),
    device: (r.device as string | null) ?? null,
    country: (r.country as string | null) ?? null,
    city: (r.city as string | null) ?? null,
    gender: (r.gender as string | null) ?? null,
  }));

  const s = ((statsRes.data ?? []) as Record<string, unknown>[])[0];
  const stats: SessionStats = s
    ? {
        sessions: num(s.sessions),
        visitors: num(s.visitors),
        members: num(s.members),
        avgDuration: num(s.avg_duration),
        medianDuration: num(s.median_duration),
        avgPageviews: num(s.avg_pageviews),
        bounceRate: num(s.bounce_rate),
      }
    : EMPTY_STATS;

  return {
    days,
    sort,
    dir,
    stats,
    pages,
    timings,
    sessions,
    // total_count 는 필터를 적용한 전체 행 수를 매 행에 실어 보낸다(0085).
    totalSessions: num(rawSessions[0]?.total_count) || stats.sessions,
  };
}
