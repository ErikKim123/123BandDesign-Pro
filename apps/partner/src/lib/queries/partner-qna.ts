// 오거나이저 본인 상품/행사패스에 달린 고객 문의(product_qna) 조회.
import { createClient } from '@/lib/supabase/server';
import type { I18n } from '@123band/shared';

export interface PartnerQuestion {
  id: string;
  product_id: string;
  author_name: string | null;
  question: string;
  answer: string | null;
  answered_at: string | null;
  created_at: string;
  products: { name_i18n: I18n } | null;
}

/** seller_id(오거나이저) 본인 상품의 문의만 최신순. 테이블 미생성 시 빈 목록. */
export async function getPartnerQna(sellerId: string): Promise<PartnerQuestion[]> {
  const { data, error } = await createClient()
    .from('product_qna')
    .select(
      'id, product_id, author_name, question, answer, answered_at, created_at, products!inner(name_i18n, seller_id)',
    )
    .eq('products.seller_id', sellerId)
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) return []; // product_qna 미생성(마이그레이션 전) 등 → 빈 목록으로 안전 폴백
  return (data ?? []) as unknown as PartnerQuestion[];
}
