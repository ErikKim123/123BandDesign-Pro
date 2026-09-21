// Design Ref: 상품별 후기(product_reviews) 조회. 공개 목록 + 평균 별점 + 현재 사용자 식별.
import { createClient } from '@/lib/supabase/server';

export interface ProductReview {
  id: string;
  product_id: string;
  author_id: string;
  author_name: string | null;
  rating: number;
  content: string;
  created_at: string;
}

export interface ReviewData {
  reviews: ProductReview[];
  count: number;
  average: number; // 후기 없으면 0
  currentUserId: string | null;
}

const SELECT = 'id, product_id, author_id, author_name, rating, content, created_at';

/**
 * 상품 후기 + 요약. product_reviews 테이블이 아직 없으면(마이그레이션 미적용)
 * 상세 페이지가 깨지지 않도록 빈 데이터로 폴백한다.
 */
export async function getProductReviews(productId: string): Promise<ReviewData> {
  const supabase = createClient();
  const [
    {
      data: { user },
    },
    { data, error },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('product_reviews')
      .select(SELECT)
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  const currentUserId = user?.id ?? null;
  if (error) return { reviews: [], count: 0, average: 0, currentUserId };

  const reviews = (data ?? []) as ProductReview[];
  const count = reviews.length;
  const average = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;
  return { reviews, count, average, currentUserId };
}
