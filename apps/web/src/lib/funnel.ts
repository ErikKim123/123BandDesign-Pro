// 퍼널 5단계(결제완료) 기록 — 어드민 '퍼널분석' 메뉴용.
// 1~4단계(방문·상품조회·장바구니·결제시작)는 page_views 경로로 유추되므로 계측이 필요 없다.
// 결제 완료만 경로로 알 수 없어 여기서 남긴다. 방문자 쿠키를 함께 넣어야
// '어떤 유입이 매출을 만들었는지'(admin_funnel_by_source)가 이어진다.
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { VISITOR_ID_COOKIE } from '@/lib/supabase/cookie';

/**
 * 결제 확정 주문 1건을 퍼널에 기록한다.
 * 결제 성공 화면은 새로고침될 수 있으나 (order_id, step) 유니크 인덱스가 중복을 막는다.
 * 집계용이라 실패해도 결제 흐름에는 영향을 주지 않는다(조용히 무시).
 */
export async function recordPurchase(order: {
  id: string;
  total_amount: number | null;
  currency: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return; // 키 미설정 로컬 환경

  const visitorId = cookies().get(VISITOR_ID_COOKIE)?.value;
  if (!visitorId) return; // 미들웨어를 안 거친 드문 요청

  try {
    await admin.from('funnel_events').upsert(
      {
        visitor_id: visitorId,
        step: 'purchase',
        order_id: order.id,
        amount: order.total_amount ?? 0,
        currency: order.currency ?? null,
      },
      { onConflict: 'order_id,step', ignoreDuplicates: true },
    );
  } catch {
    // 집계 실패가 주문 완료 화면을 막지 않게 한다
  }
}
