// 고객 문의 (오거나이저) — 본인 상품/행사패스 문의 확인 + 답변 작성.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getPartnerQna } from '@/lib/queries/partner-qna';
import { QnaView } from './QnaView';

export const dynamic = 'force-dynamic';

export default async function QnaPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const items = await getPartnerQna(user.id);
  return <QnaView items={items} sellerId={user.id} />;
}
