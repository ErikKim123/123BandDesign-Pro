// Design Ref: 행사 캘린더 — 티켓(event_content) 상품을 startAt 기준으로 캘린더에 배치.
import { createClient } from '@/lib/supabase/server';
import { withSlugCols } from '@/lib/queries/columns';
import { activePasses, type ActivePass, type EventContent, type I18n, type Prices } from '@123band/shared';

/** 캘린더/카드에 필요한 행사(티켓) 항목 */
export interface EventListItem {
  id: string;
  code: string | null;
  product_type: string;
  seller_id: string;
  is_partner_product: boolean;
  name_i18n: I18n;
  prices: Prices;
  image_url: string | null;
  event_content: EventContent;
  /** 각 패스(Full/Party 등) 이름 + 현재 판매가 + 정식가 — 카드에 전 가격·할인율 표기(상세와 동일 로직). */
  passes: ActivePass[];
  /** URL 슬러그(0035). 캘린더/카드 링크가 정식 주소로 곧장 가게 한다. */
  slug?: string | null;
}

/** 판매중 + event_content.startAt 이 있는 티켓 행사 목록 (startAt 오름차순) */
export async function listEvents(): Promise<EventListItem[]> {
  const { data, error } = await createClient()
    .from('products')
    .select(
      await withSlugCols(
        'id, code, product_type, seller_id, is_partner_product, name_i18n, prices, image_url, event_content',
      ),
    )
    .eq('product_type', 'ticket')
    .eq('status', 'active')
    .not('event_content', 'is', null);
  if (error) throw error;
  const nowMs = Date.now();
  // select 문자열이 동적(withSlugCols)이라 supabase-js 가 행 타입을 추론하지 못한다 → 한 번만 단언.
  const rows = (data ?? []) as unknown as Omit<EventListItem, 'passes'>[];
  return rows
    .filter((p) => Boolean((p.event_content as EventContent | null)?.startAt))
    .sort((a, b) => (a.event_content.startAt! < b.event_content.startAt! ? -1 : 1))
    .map((row) => ({ ...row, passes: activePasses(row.event_content.tickets, nowMs) }));
}
