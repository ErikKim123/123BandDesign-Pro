// 오거나이저 본인 상품/행사패스에 달린 고객 후기(product_reviews) 조회.
import { createClient } from '@/lib/supabase/server';
import type { I18n } from '@123band/shared';

export interface PartnerReview {
  id: string;
  rating: number;
  content: string;
  author_name: string | null;
  created_at: string;
  product_id: string;
  products: { name_i18n: I18n } | null;
}

/** seller_id(오거나이저) 본인 상품의 후기만 최신순. 테이블 미생성 시 빈 목록. */
export async function getPartnerReviews(sellerId: string): Promise<PartnerReview[]> {
  const { data, error } = await createClient()
    .from('product_reviews')
    .select(
      'id, rating, content, author_name, created_at, product_id, products!inner(name_i18n, seller_id)',
    )
    .eq('products.seller_id', sellerId)
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) return []; // product_reviews 미생성(마이그레이션 전) 등 → 빈 목록으로 안전 폴백
  return (data ?? []) as unknown as PartnerReview[];
}
