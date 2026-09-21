// Design Ref: §5 — 상품 탐색 (목록/카테고리/타입 필터). 상세 HTML 제외하고 가볍게.
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { LIST_COLS, type HomeProduct } from '@/lib/queries/home';
import { withSlugCols } from '@/lib/queries/columns';
import { activePasses, type EventTicketTier, type I18n } from '@123band/shared';

export interface ListOptions {
  categoryId?: string;
  productType?: string;
  search?: string;
  limit?: number;
}

/** 판매중(active) 상품 목록 — 카테고리/타입/검색어 필터 */
export async function listProducts(opts: ListOptions = {}): Promise<HomeProduct[]> {
  let q = createClient()
    .from('products')
    .select(await withSlugCols(LIST_COLS))
    .eq('status', 'active');
  if (opts.categoryId) q = q.eq('category_id', opts.categoryId);
  if (opts.productType) q = q.eq('product_type', opts.productType);
  if (opts.search) {
    // 코드 + 상품명(en/ko) 부분일치. ilike 특수문자(%,) 는 안전하게 제거.
    const term = opts.search.replace(/[%,()]/g, '').trim();
    if (term) {
      q = q.or(
        `code.ilike.%${term}%,name_i18n->>en.ilike.%${term}%,name_i18n->>ko.ilike.%${term}%`,
      );
    }
  }
  q = q.order('created_at', { ascending: false }).limit(opts.limit ?? 40);
  const { data, error } = await q;
  if (error) throw error;
  // select 문자열이 동적(withSlugCols)이라 행 타입 추론이 안 된다 → unknown 경유 단언.
  return (data ?? []) as unknown as HomeProduct[];
}

/** 티켓(페스티벌 패스) — 월별 필터용으로 event_content.startAt 포함. 날짜 없는 패스도 포함('전체'에만 노출). */
export interface TicketPass extends HomeProduct {
  startAt: string | null;
}
export async function listTicketPasses(): Promise<TicketPass[]> {
  const { data, error } = await createClient()
    .from('products')
    .select(await withSlugCols(`${LIST_COLS}, event_content`))
    .eq('status', 'active')
    .eq('product_type', 'ticket')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  const nowMs = Date.now();
  const rows = (data ?? []) as unknown as (HomeProduct & {
    event_content?: {
      startAt?: string;
      country?: string;
      address?: { country?: string };
      tickets?: EventTicketTier[];
    } | null;
  })[];
  return rows.map((p) => {
    const { event_content, ...rest } = p;
    // 각 패스(Full/Party 등)의 이름+현재가 → 카드에 패스명·가격 표기(상세와 동일 로직).
    const passes = activePasses(event_content?.tickets, nowMs);
    return {
      ...(rest as HomeProduct),
      passes,
      country: event_content?.country || event_content?.address?.country || null,
      startAt: event_content?.startAt ?? null,
    };
  });
}

export interface CategoryInfo {
  id: string;
  code: string | null;
  name_i18n: I18n;
}

export const getCategory = cache(async (id: string): Promise<CategoryInfo | null> => {
  const { data, error } = await createClient()
    .from('categories')
    .select('id, code, name_i18n')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as CategoryInfo | null) ?? null;
});
