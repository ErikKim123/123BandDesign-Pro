// Design Ref: J&J 개별 대회 상세 — 에디션별 canonical URL(공유·색인용). 본문은 허브와 동일 컴포넌트.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { pickI18n, type Locale } from '@123band/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { createClient } from '@/lib/supabase/server';
import { buildMetadata } from '@/lib/seo';
import {
  divisionTabs,
  getJnjEdition,
  listJnjDivisions,
  listJnjJudges,
  listJnjParticipants,
  listJnjScores,
  listJnjWinners,
} from '@/lib/queries/jnj';
import { JnjHero } from '@/components/jnj/JnjHero';
import { JnjEditionView } from '@/components/jnj/JnjEditionView';
import { getJnjReviews } from '@/lib/queries/jnj-reviews';
import { getLiveForJnjEdition } from '@/lib/queries/live';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: { locale: string; slug: string };
}): Promise<Metadata> {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  const edition = await getJnjEdition(params.slug);
  if (!edition) {
    return buildMetadata({
      locale,
      path: `/jnj/${params.slug}`,
      title: dict.jnj.title,
      description: dict.jnj.intro,
      noindex: true,
    });
  }
  const title = `${pickI18n(edition.title_i18n, locale)} · ${dict.jnj.title}`;
  const description = pickI18n(edition.subtitle_i18n, locale) || dict.jnj.intro;
  return buildMetadata({
    locale,
    path: `/jnj/${edition.slug}`,
    title,
    description,
    image: edition.cover_url ?? undefined,
  });
}

export default async function JnjEditionPage({
  params,
  searchParams,
}: {
  params: { locale: string; slug: string };
  searchParams: { d?: string };
}) {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  const edition = await getJnjEdition(params.slug);
  if (!edition) notFound();

  const [winners, divisions, judges, scores, participants] = await Promise.all([
    listJnjWinners(edition.id),
    listJnjDivisions(edition.id),
    listJnjJudges(edition.id),
    listJnjScores(edition.id),
    listJnjParticipants(edition.id),
  ]);

  // 전체 결과·시상대 점수는 회원 공개 — 비로그인은 흐린 미리보기로만 보여준다.
  const {
    data: { user },
  } = await createClient().auth.getUser();
  const isAuthed = !!user;

  const tabs = divisionTabs(divisions, winners, scores);
  const activeTab = tabs.find((t) => t.code === searchParams.d) ?? tabs[0] ?? null;

  // 지금 보고 있는 부문의 방송. 부문 전용이 없으면 대회 공통, 그것도 없으면 연결 행사 순(0082).
  // 탭이 정해진 뒤라야 물어볼 수 있어 위 Promise.all 에 못 넣는다.
  // 후기(0098) — 대회·부문 스위치가 둘 다 켜져 있을 때만. 부문 없는 대회는 대회 공통('').
  const reviewsOn =
    edition.reviews_enabled !== false && activeTab?.division?.reviews_enabled !== false;
  const [live, reviews] = await Promise.all([
    getLiveForJnjEdition(edition.id, edition.event_product_id, activeTab?.division?.id ?? null),
    reviewsOn ? getJnjReviews(edition.id, activeTab?.code ?? '') : Promise.resolve(null),
  ]);

  return (
    <div className="pb-16">
      <JnjHero dict={dict} />
      <div className="container-band py-10 md:py-14">
        <Link
          href={`/${locale}/jnj?year=${edition.year}`}
          className="mb-8 inline-flex items-center gap-1 text-sm font-medium text-grey-500 transition-colors hover:text-primary"
        >
          <ChevronLeft size={16} />
          {dict.jnj.backToAll}
        </Link>
        <JnjEditionView
          edition={edition}
          winners={winners}
          scores={scores}
          participants={participants}
          locale={locale}
          dict={dict}
          tabs={tabs}
          activeTab={activeTab}
          judges={judges}
          isAuthed={isAuthed}
          live={live}
          reviews={reviews}
          divisionHref={(code) => `/${locale}/jnj/${edition.slug}?d=${code}`}
        />
      </div>
    </div>
  );
}
