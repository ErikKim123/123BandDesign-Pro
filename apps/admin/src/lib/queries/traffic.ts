// Design Ref: §5 — 방문자수/트래픽수 어드민 통계. RLS 대신 SECURITY DEFINER RPC(0056)로 집계.
import { createClient } from '@/lib/supabase/server';

export interface TrafficDaily {
  day: string;
  pageviews: number;
  visitors: number;
}

export interface TrafficTopPath {
  path: string;
  pageviews: number;
  visitors: number;
}

/**
 * kind 로 유입 종류를 구분한다(0058).
 * - referrer: 외부 사이트에서 넘어옴. source 에 URL 이 들어온다.
 * - app     : 홈화면에 설치된 앱(PWA)으로 실행. source 는 null.
 * - direct  : 북마크 또는 주소창 직접입력. source 는 null.
 *             브라우저가 둘을 구분해 주지 않아 한 덩어리로 센다.
 */
export type TrafficSourceKind = 'referrer' | 'app' | 'direct';

export interface TrafficTopReferrer {
  source: string | null;
  kind: TrafficSourceKind;
  visitors: number;
}

export interface TrafficStats {
  days: number;
  daily: TrafficDaily[];
  topPaths: TrafficTopPath[];
  topReferrers: TrafficTopReferrer[];
  totalPageviews: number;
  totalVisitors: number;
  today: TrafficDaily | null;
}

/** @param end 창의 끝 날짜(YYYY-MM-DD, KST). 없으면 오늘까지. 0104 */
export async function getTrafficStats(days: number, end: string | null = null): Promise<TrafficStats> {
  const supabase = createClient();
  const [dailyRes, topPathsRes, topReferrersRes] = await Promise.all([
    supabase.rpc('admin_traffic_daily', { p_days: days, p_end: end }),
    supabase.rpc('admin_traffic_top_paths', { p_days: days, p_limit: 10, p_end: end }),
    supabase.rpc('admin_traffic_top_referrers', { p_days: days, p_limit: 10, p_end: end }),
  ]);

  const rows = (dailyRes.data ?? []) as TrafficDaily[];
  const byDay = new Map(rows.map((d) => [d.day, d]));
  const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }); // YYYY-MM-DD

  // 실데이터가 없는 날짜도 0으로 채워, 선택한 기간(7/14/30일)만큼 막대 개수가 항상 달라지게 함
  const daily: TrafficDaily[] = [];
  for (let i = days - 1; i >= 0; i--) {
    // 끝 날짜가 주어지면 그 날을 기준으로 거슬러 올라간다(KST 자정 고정).
    const d = end ? new Date(`${end}T12:00:00+09:00`) : new Date();
    d.setDate(d.getDate() - i);
    const day = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
    daily.push(byDay.get(day) ?? { day, pageviews: 0, visitors: 0 });
  }

  return {
    days,
    daily,
    topPaths: (topPathsRes.data ?? []) as TrafficTopPath[],
    topReferrers: (topReferrersRes.data ?? []) as TrafficTopReferrer[],
    totalPageviews: daily.reduce((sum, d) => sum + d.pageviews, 0),
    totalVisitors: daily.reduce((sum, d) => sum + d.visitors, 0),
    today: daily.find((d) => d.day === todayStr) ?? null,
  };
}
