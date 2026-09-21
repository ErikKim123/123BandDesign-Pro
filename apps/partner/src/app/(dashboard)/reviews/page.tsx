// 고객 후기 (오거나이저) — 본인 상품/행사패스에 달린 별점 후기 확인.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getPartnerReviews } from '@/lib/queries/partner-reviews';
import { ReviewsView } from './ReviewsView';

export const dynamic = 'force-dynamic';

export default async function ReviewsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const reviews = await getPartnerReviews(user.id);
  return <ReviewsView reviews={reviews} />;
}
