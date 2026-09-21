// J&J 대회 후기(jnj_reviews, 0098) 조회 — 대회의 부문 탭별 목록 + 현재 사용자 식별.
import { createClient } from '@/lib/supabase/server';
import type { ProductReview, ReviewData } from '@/lib/queries/reviews';

const SELECT = 'id, edition_id, division, author_id, author_name, rating, content, created_at';

type JnjReviewRow = Omit<ProductReview, 'product_id'> & { edition_id: string; division: string };

/**
 * 한 부문(division 코드, 부문 없는 대회는 '')의 후기. 후기 보드 컴포넌트가 상품 후기와 같은
 * 모양을 쓰므로 product_id 자리는 비워 맞춘다. 테이블이 없으면(0098 미적용) 빈 데이터.
 */
export async function getJnjReviews(editionId: string, division: string): Promise<ReviewData> {
  const supabase = createClient();
  const [
    {
      data: { user },
    },
    { data, error },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('jnj_reviews')
      .select(SELECT)
      .eq('edition_id', editionId)
      .eq('division', division)
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  const currentUserId = user?.id ?? null;
  if (error) return { reviews: [], count: 0, average: 0, currentUserId };

  const reviews = ((data ?? []) as JnjReviewRow[]).map((r) => ({ ...r, product_id: '' }));
  const count = reviews.length;
  const average = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;
  return { reviews, count, average, currentUserId };
}
