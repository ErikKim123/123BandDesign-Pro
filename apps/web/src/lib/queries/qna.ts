// Design Ref: 상품별 문의(product_qna) 조회. 공개 목록 + 현재 사용자 식별. (후기 reviews.ts 와 동일 패턴)
import { createClient } from '@/lib/supabase/server';

export interface ProductQuestion {
  id: string;
  product_id: string;
  author_id: string;
  author_name: string | null;
  question: string;
  answer: string | null;
  answered_at: string | null;
  created_at: string;
}

export interface QnaData {
  items: ProductQuestion[];
  count: number;
  currentUserId: string | null;
}

const SELECT = 'id, product_id, author_id, author_name, question, answer, answered_at, created_at';

/**
 * 상품 문의 목록. product_qna 테이블이 아직 없으면(마이그레이션 미적용)
 * 상세 페이지가 깨지지 않도록 빈 데이터로 폴백한다.
 */
export async function getProductQna(productId: string): Promise<QnaData> {
  const supabase = createClient();
  const [
    {
      data: { user },
    },
    { data, error },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('product_qna')
      .select(SELECT)
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  const currentUserId = user?.id ?? null;
  if (error) return { items: [], count: 0, currentUserId };

  const items = (data ?? []) as ProductQuestion[];
  return { items, count: items.length, currentUserId };
}
