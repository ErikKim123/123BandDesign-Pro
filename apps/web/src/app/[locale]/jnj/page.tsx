// Design Ref: 상단 네비 'J&J' — 연도/행사별 잭앤질 대회 허브.
// 연도 탭 → (그 해 대회가 둘 이상이면) 행사 칩 → 부문 탭(JLCF Bachata PRO/AMA/Salsa OPEN)
//   → 그 부문의 챔피언 · 심사위원 · FORMAT · GUIDELINES.
// 선택 상태는 쿼리스트링(?year=&e=&d=)이라 서버 렌더 그대로 공유·색인된다.
import type { Metadata } from 'next';
import type { Locale } from '@123band/shared';
import { pickI18n } from '@123band/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { createClient } from '@/lib/supabase/server';
import { buildMetadata } from '@/lib/seo';
import {
  divisionTabs,
  editionYears,
  listEditionEventDates,
  listFinishedEditionIds,
  listJnjDivisions,
  listJnjEditions,
  listJnjJudges,
  listJnjParticipants,
  listJnjScores,
  listJnjWinners,
  listJnjOpenEditionIds,
  sortEditionsForDisplay,
} from '@/lib/queries/jnj';
import { JnjHero } from '@/components/jnj/JnjHero';
import { EditionCards, YearTabs } from '@/components/jnj/JnjSelector';
import { JnjEditionView } from '@/components/jnj/JnjEditionView';
import { getLiveForJnjEdition, listLiveJnjEditionIds } from '@/lib/queries/live';
import { getJnjReviews } from '@/lib/queries/jnj-reviews';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  return buildMetadata({
    locale,
    path: '/jnj',
    title: dict.jnj.title,
    description: dict.jnj.intro,
  });
}

export default async function JnjPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { year?: string; e?: string; d?: string };
}) {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  const editions = await listJnjEditions();
  const [finishedIds, eventDates] = await Promise.all([
    // 카드 배지용 — 결과(시상대·성적)가 올라온 대회 id 집합.
    listFinishedEditionIds(),
    // 카드 정렬용 — held_at 이 빈 대회는 연결 행사의 시작일로 순서를 잡는다.
    listEditionEventDates(editions),
  ]);

  // 카드 마크용 — 지금 참가 신청 / 관객 심사위원을 받고 있는 대회.
  const openIds = await listJnjOpenEditionIds(finishedIds);

  const years = editionYears(editions);
  // 요청 연도가 없거나 유효하지 않으면 최신 연도.
  const requestedYear = Number(searchParams.year);
  const activeYear = years.includes(requestedYear) ? requestedYear : (years[0] ?? 0);
  // 아직 안 치른 대회가 앞(왼쪽), 끝난 대회가 뒤(오른쪽) — 각각 날짜순.
  const yearEditions = sortEditionsForDisplay(
    editions.filter((e) => e.year === activeYear),
    finishedIds,
    eventDates,
  );
  // 요청 슬러그가 그 해에 없으면 그 해의 첫 대회(= 가장 임박한 대회).
  const active = yearEditions.find((e) => e.slug === searchParams.e) ?? yearEditions[0] ?? null;

  const [winners, divisions, judges, scores, participants] = active
    ? await Promise.all([
        listJnjWinners(active.id),
        listJnjDivisions(active.id),
        listJnjJudges(active.id),
        listJnjScores(active.id),
        listJnjParticipants(active.id),
      ])
    : [[], [], [], [], []];

  // 부문 탭 — 요청 코드가 없거나 유효하지 않으면 첫 부문.
  // 전체 결과·시상대 점수는 회원 공개 — 비로그인은 흐린 미리보기로만 보여준다.
  const {
    data: { user },
  } = await createClient().auth.getUser();
  const isAuthed = !!user;

  const tabs = divisionTabs(divisions, winners, scores);
  const activeTab = tabs.find((t) => t.code === searchParams.d) ?? tabs[0] ?? null;

  // 카드의 LIVE 마크(대회 단위)와 아래 본문의 라이브(지금 보는 부문 기준)는 묻는 단위가 다르다.
  // 후기(0098) — 대회·부문 스위치가 둘 다 켜져 있을 때만. 부문 없는 대회는 대회 공통('').
  const reviewsOn =
    !!active && active.reviews_enabled !== false && activeTab?.division?.reviews_enabled !== false;
  const [liveEditionIds, live, reviews] = await Promise.all([
    listLiveJnjEditionIds(),
    active
      ? getLiveForJnjEdition(active.id, active.event_product_id, activeTab?.division?.id ?? null)
      : Promise.resolve(null),
    reviewsOn && active ? getJnjReviews(active.id, activeTab?.code ?? '') : Promise.resolve(null),
  ]);

  return (
    <div className="pb-16">
      <JnjHero dict={dict} />

      <div className="container-band py-10 md:py-14">
        {active ? (
          <>
            <div className="mb-10 space-y-6">
              <YearTabs years={years} active={activeYear} locale={locale} dict={dict} />
              <EditionCards
                editions={yearEditions}
                activeSlug={active.slug}
                locale={locale}
                dict={dict}
                finishedIds={finishedIds}
                signupOpenIds={openIds.signup}
                voteOpenIds={openIds.vote}
                liveIds={liveEditionIds}
              />
            </div>
            <JnjEditionView
              edition={active}
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
              divisionHref={(code) =>
                `/${locale}/jnj?year=${active.year}&e=${active.slug}&d=${code}`
              }
            />
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-grey-300 bg-cream-light px-6 py-20 text-center">
            <p className="font-display text-xl text-ink">{dict.jnj.noEditions}</p>
            <p className="mt-2 text-sm text-grey-500">{dict.jnj.noEditionsHint}</p>
          </div>
        )}
      </div>

      {/* 개별 대회 딥링크 — 크롤러가 에디션 상세를 발견하는 경로 */}
      {editions.length > 0 && (
        <div className="container-band">
          <ul className="sr-only">
            {editions.map((e) => (
              <li key={e.id}>
                <a href={`/${locale}/jnj/${e.slug}`}>{pickI18n(e.title_i18n, locale)}</a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
