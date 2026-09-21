// 오거나이저 본인 행사에 달린 피드백 설문(event_feedback) 조회.
//
// 후기와 달리 응답은 공개되지 않는다 — RLS 가 '그 행사를 파는 사람'과 운영자에게만 읽기를 연다.
// 여기서는 본인 세션으로 읽으므로 남의 행사 응답은 애초에 오지 않는다.
import { createClient } from '@/lib/supabase/server';
import type { I18n } from '@123band/shared';

export interface FeedbackEvent {
  id: string;
  name_i18n: I18n;
  code: string | null;
  slug: string | null;
  status: string;
  feedback_enabled: boolean;
  /** 받은 응답 수 — 목록에서 '어느 행사에 답이 쌓였나'를 바로 보기 위한 값. */
  responses: number;
  /** 가장 최근 응답 시각. 없으면 null. */
  last_at: string | null;
}

export interface FeedbackResponse {
  id: string;
  product_id: string;
  respondent_name: string | null;
  respondent_email: string | null;
  answers: Record<string, unknown>;
  created_at: string;
}

/**
 * 본인 행사(티켓 상품) 목록 + 행사별 응답 수.
 *
 * 설문을 아직 켜지 않은 행사도 함께 준다 — 이 화면이 스위치를 켜는 곳이기도 해서,
 * 켜진 것만 보여 주면 새로 켤 행사를 찾을 데가 없다.
 */
export async function getFeedbackEvents(sellerId: string): Promise<FeedbackEvent[]> {
  const supabase = createClient();
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name_i18n, code, slug, status, feedback_enabled')
    .eq('seller_id', sellerId)
    .eq('product_type', 'ticket')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) return []; // 컬럼 미생성(0100 전) 등 → 빈 목록으로 안전 폴백

  const ids = (products ?? []).map((p) => p.id as string);
  if (ids.length === 0) return [];

  // 응답 수는 한 번에 긁어서 세는 편이 행사마다 count 질의를 날리는 것보다 싸다.
  const { data: rows } = await supabase
    .from('event_feedback')
    .select('product_id, created_at')
    .in('product_id', ids)
    .order('created_at', { ascending: false });

  const tally = new Map<string, { n: number; last: string }>();
  for (const r of (rows ?? []) as { product_id: string; created_at: string }[]) {
    const cur = tally.get(r.product_id);
    // 내림차순이라 처음 만나는 것이 가장 최근이다.
    if (cur) cur.n++;
    else tally.set(r.product_id, { n: 1, last: r.created_at });
  }

  return (products ?? []).map((p) => {
    const t = tally.get(p.id as string);
    return {
      id: p.id as string,
      name_i18n: p.name_i18n as I18n,
      code: (p.code as string) ?? null,
      slug: (p.slug as string) ?? null,
      status: (p.status as string) ?? '',
      feedback_enabled: p.feedback_enabled === true,
      responses: t?.n ?? 0,
      last_at: t?.last ?? null,
    };
  });
}

/** 한 행사의 응답 전체(최신순). */
export async function getFeedbackResponses(productId: string): Promise<FeedbackResponse[]> {
  const { data, error } = await createClient()
    .from('event_feedback')
    .select('id, product_id, respondent_name, respondent_email, answers, created_at')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) return [];
  return (data ?? []) as unknown as FeedbackResponse[];
}
