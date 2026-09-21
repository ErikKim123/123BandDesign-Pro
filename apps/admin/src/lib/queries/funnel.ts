// Design Ref: §5 — 퍼널분석. 0057 RPC(SECURITY DEFINER) 로 집계한다.
//
// 데이터 출처가 자체 page_views/orders 인 이유는 0057_funnel.sql 머리말 참고.
// 요약: Vercel Pro 는 커스텀 이벤트 속성이 2개뿐이고 UTM 이 유료 애드온이며,
//       무엇보다 우리 orders 와 조인할 수 없어 '유입 → 실매출' 귀속이 불가능하다.
import { createClient } from '@/lib/supabase/server';

/** 퍼널 단계 코드 — 0057 admin_funnel_summary 가 돌려주는 값과 1:1. */
export type FunnelStep = 'visit' | 'product_view' | 'cart' | 'checkout' | 'purchase';

export interface FunnelRow {
  step: FunnelStep;
  /** 앞 단계를 시간순으로 거쳐 도달한 방문자 — 진짜 이탈이 보이는 값(0060) */
  visitors: number;
  /** 순서를 무시하고 그 단계에 닿기만 한 방문자 — 0057 이 쓰던 값(비교용) */
  reached: number;
  /** 선택 분기 단계(장바구니). 주 경로 전환율 계산에서 건너뛴다. */
  isBranch: boolean;
  /** 첫 단계(방문) 대비 비율 — 전체 전환율 */
  rateFromTop: number;
  /** 직전 '주 경로' 단계 대비 비율 — 어디서 새는지 */
  rateFromPrev: number;
}

export interface FunnelSource {
  source: string;
  visitors: number;
  purchases: number;
  revenue: number;
  /** 방문자 대비 구매 전환율 */
  conversion: number;
}

export interface FunnelStats {
  days: number;
  steps: FunnelRow[];
  sources: FunnelSource[];
}

const STEP_ORDER: FunnelStep[] = ['visit', 'product_view', 'cart', 'checkout', 'purchase'];

/** @param end 창의 끝 날짜(YYYY-MM-DD, KST). 없으면 오늘까지. 0104 */
export async function getFunnelStats(days: number, end: string | null = null): Promise<FunnelStats> {
  const supabase = createClient();
  const [summaryRes, sourceRes] = await Promise.all([
    supabase.rpc('admin_funnel_summary', { p_days: days, p_end: end }),
    supabase.rpc('admin_funnel_by_source', { p_days: days, p_limit: 10, p_end: end }),
  ]);

  const raw = (summaryRes.data ?? []) as {
    step: string;
    visitors: number;
    reached: number;
    is_branch: boolean;
  }[];
  const byStep = new Map(raw.map((r) => [r.step, r]));

  // 단계가 하나도 안 오더라도 5줄은 항상 그린다 — 빈 퍼널도 형태가 보여야 읽힌다.
  const top = Number(byStep.get('visit')?.visitors ?? 0);
  const steps: FunnelRow[] = STEP_ORDER.map((step, i) => {
    const row = byStep.get(step);
    const visitors = Number(row?.visitors ?? 0);
    const isBranch = Boolean(row?.is_branch);

    // 직전 '주 경로' 단계를 찾는다 — 장바구니 같은 분기는 건너뛴다.
    // 이 사이트는 장바구니를 거치지 않고 상품→결제로 직행하는 흐름이 실재해서,
    // 분기를 관문처럼 끼워 넣으면 결제시작 전환율이 실제와 무관해진다(0060).
    let prev = visitors;
    for (let j = i - 1; j >= 0; j--) {
      const prevKey = STEP_ORDER[j];
      if (prevKey == null) break;
      const cand = byStep.get(prevKey);
      if (cand && cand.is_branch) continue;
      prev = Number(cand?.visitors ?? 0);
      break;
    }

    return {
      step,
      visitors,
      reached: Number(row?.reached ?? 0),
      isBranch,
      rateFromTop: top > 0 ? visitors / top : 0,
      rateFromPrev: prev > 0 ? visitors / prev : 0,
    };
  });

  const sources: FunnelSource[] = (
    (sourceRes.data ?? []) as {
      source: string;
      visitors: number;
      purchases: number;
      revenue: number;
    }[]
  ).map((s) => ({
    source: s.source,
    visitors: Number(s.visitors),
    purchases: Number(s.purchases),
    revenue: Number(s.revenue),
    conversion: Number(s.visitors) > 0 ? Number(s.purchases) / Number(s.visitors) : 0,
  }));

  return { days, steps, sources };
}
