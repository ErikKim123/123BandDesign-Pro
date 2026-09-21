// Design Ref: §5 Phase 3 — 상품 상세 조회 (detail_html_i18n 포함, 상세 진입 시에만)
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { EventContent, I18n, Prices } from '@123band/shared';
import { withSlugCols } from '@/lib/queries/columns';

export interface ProductDetail {
  id: string;
  code: string | null;
  seller_id: string;
  product_type: string;
  is_partner_product: boolean;
  category_id: string | null;
  name_i18n: I18n;
  prices: Prices;
  image_url: string | null;
  attributes: Record<string, unknown> | null;
  detail_html_i18n: I18n;
  event_content: EventContent | null;
  status: string;
  created_at: string; // 최초 게시일 — VideoObject uploadDate 등 구조화데이터용
  reviews_enabled: boolean;
  qna_enabled: boolean;
  /** 행사 피드백 설문(0100). 후기·문의와 달리 기본은 꺼짐 — 행사가 끝난 뒤 주최자가 켠다. */
  feedback_enabled: boolean;
  /** URL 슬러그(0035). 없으면 레거시 /products/{id} 로 동작한다. */
  slug?: string | null;
}

const BASE_COLS =
  'id, code, seller_id, product_type, is_partner_product, category_id, name_i18n, prices, image_url, attributes, detail_html_i18n, event_content, status, created_at';

type Filter = { column: 'id' | 'slug'; value: string };

/**
 * 단건 조회 — reviews_enabled / qna_enabled 는 마이그레이션 적용 시점이 서로 달라 단계적으로 폴백한다.
 * 각 플래그는 "컬럼이 있으면 실제 값, 없으면 기본 true" — 이미 존재하는 플래그 값을 덮어쓰지 않는다.
 */
async function fetchOne(where: Filter): Promise<ProductDetail | null> {
  const supabase = createClient();
  const cols = await withSlugCols(BASE_COLS);
  const from = (select: string) =>
    supabase.from('products').select(select).eq(where.column, where.value).maybeSingle();

  // 1) 세 플래그 모두 존재(0100 이후)
  const all = await from(`${cols}, reviews_enabled, qna_enabled, feedback_enabled`);
  if (!all.error) return (all.data as ProductDetail | null) ?? null;

  // 2) feedback_enabled 만 없음(0100 전) — 설문은 꺼진 것으로 본다(켜는 건 주최자의 선택이다).
  const both = await from(`${cols}, reviews_enabled, qna_enabled`);
  if (!both.error) {
    const data = both.data as (Omit<ProductDetail, 'feedback_enabled'> | null);
    return data ? { ...data, feedback_enabled: false } : null;
  }

  // 3) qna_enabled 도 없음(0023 전) — reviews_enabled 실제 값 유지, qna 만 기본 true
  const rev = await from(`${cols}, reviews_enabled`);
  if (!rev.error) {
    const data = rev.data as (Omit<ProductDetail, 'qna_enabled' | 'feedback_enabled'> | null);
    return data ? { ...data, qna_enabled: true, feedback_enabled: false } : null;
  }

  // 4) 전부 없음(0022 전) — 후기·문의는 기본 true, 설문은 false
  const base = await from(cols);
  if (base.error) throw base.error;
  const data = base.data as (Omit<
    ProductDetail,
    'reviews_enabled' | 'qna_enabled' | 'feedback_enabled'
  > | null);
  return data ? { ...data, reviews_enabled: true, qna_enabled: true, feedback_enabled: false } : null;
}

/**
 * 상품 단건(레거시 uuid 경로 · 미리보기 링크용).
 * cache(): 같은 요청 내 generateMetadata + 페이지 렌더가 동일 상품을 각각 조회해도 DB 는 1회만.
 */
export const getProduct = cache(
  async (id: string): Promise<ProductDetail | null> => fetchOne({ column: 'id', value: id }),
);

/** 슬러그로 상세 조회 — 정식 URL(/events/{slug} · /shop/{slug})의 진입점. */
export const getProductBySlug = cache(async (slug: string): Promise<ProductDetail | null> => {
  if (!slug) return null;
  // 0035 미적용 환경에서는 슬러그 URL 자체가 존재하지 않는다(레거시 uuid URL 만 유효).
  if (!(await withSlugCols('id')).includes('slug')) return null;
  return fetchOne({ column: 'slug', value: slug });
});

/** 정식 URL 조립에 필요한 최소 정보 */
export interface ProductSlugRef {
  id: string;
  slug: string | null;
  product_type: string;
}

/**
 * 옛 슬러그(previous_slugs) 역조회 — 어드민/오거나이저가 URL 을 바꾼 뒤에도
 * 예전 주소로 들어온 방문자·크롤러를 301 로 현재 주소에 이어주기 위한 것(순위 신호 승계).
 */
export const getProductByPreviousSlug = cache(
  async (slug: string): Promise<ProductSlugRef | null> => {
    if (!slug) return null;
    const cols = await withSlugCols('id, product_type', 'slug, previous_slugs');
    if (!cols.includes('previous_slugs')) return null; // 0035 미적용
    const { data, error } = await createClient()
      .from('products')
      .select(cols)
      .contains('previous_slugs', [slug])
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return (data as ProductSlugRef | null) ?? null;
  },
);

/**
 * 티켓별 판매 수량 — {ticket_key: 판매수}. 잔여 = units - 이 값.
 *
 * 남은 수량을 컬럼에 저장해 두고 빼는 대신 주문에서 센다(0094). 환불하면 저절로 줄고
 * 손으로 맞출 일이 없다. 결제가 끝난 주문만 세므로, 결제창만 열고 닫은 건은 재고를 잡지 않는다.
 * 0094 미적용 환경에서는 빈 객체 → 지금까지처럼 수량 제한 없이 동작한다.
 */
export async function getTicketSoldCounts(productId: string): Promise<Record<string, number>> {
  try {
    const { data, error } = await createClient().rpc('ticket_sold_counts', { p_product: productId });
    if (error || !data) return {};
    return data as Record<string, number>;
  } catch {
    return {};
  }
}
