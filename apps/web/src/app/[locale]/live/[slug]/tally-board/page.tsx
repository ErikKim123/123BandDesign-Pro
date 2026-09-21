// 탈리 화면 — /{locale}/live/{slug}/tally-board?t={토큰}
//
// 현장 노트북이 로그인 없이 여는 화면이라 접근 근거는 토큰뿐이다. 토큰은 쿼리스트링에 둔다
// (경로에 넣으면 middleware 가 소문자로 바꿔 버려 토큰이 깨진다).
// 색인 대상이 아니므로 noindex.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { Locale } from '@123band/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { getTallyState } from '@/lib/queries/live';
import { TallyBoard } from '@/components/live/TallyBoard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function TallyBoardPage({
  params,
  searchParams,
}: {
  params: { locale: string; slug: string };
  searchParams: { t?: string };
}) {
  const token = (searchParams.t ?? '').trim();
  if (!token) notFound();

  const state = await getTallyState(token);
  // 토큰이 틀렸거나, 맞더라도 주소의 방송과 다르면 열어 주지 않는다.
  if (!state || state.slug !== params.slug) notFound();

  const dict = await getDictionary(params.locale as Locale);
  return <TallyBoard token={token} initial={state} dict={dict} />;
}
