// 행사 피드백 (오거나이저) — 행사별 설문 응답. 설문 켜기/끄기도 여기서 한다.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getFeedbackEvents, getFeedbackResponses } from '@/lib/queries/partner-feedback';
import { FeedbackView } from './FeedbackView';

export const dynamic = 'force-dynamic';

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: { event?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const events = await getFeedbackEvents(user.id);
  // ?event= 로 고른 행사가 내 것일 때만 응답을 읽는다(RLS 가 한 번 더 막지만 URL 로 떠보는 걸 여기서 끊는다).
  const selectedId = events.some((e) => e.id === searchParams.event) ? searchParams.event! : null;
  const responses = selectedId ? await getFeedbackResponses(selectedId) : [];

  return <FeedbackView events={events} selectedId={selectedId} responses={responses} />;
}
