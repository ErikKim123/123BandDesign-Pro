// Design Ref: J&J 에디션 본문 — 개요 카드 + 부문 탭 + (부문 안의) 챔피언 · 심사위원 · FORMAT · GUIDELINES.
// 부문 탭(JLCF Bachata PRO / AMA / Salsa OPEN)이 이 페이지의 상단 메뉴이고, 네 섹션은 전부 그 아래로 들어간다.
// FORMAT/GUIDELINES 는 부문 본문 우선, 비어 있으면 에디션 공통 본문으로 폴백한다.
// /jnj(허브)와 /jnj/[slug](단독)에서 공유한다. 전부 서버 렌더 = 본문이 그대로 색인된다.
import { Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CalendarDays, MapPin, Lock, PlayCircle } from 'lucide-react';
import { isPlayableVideo, pickI18n, resolveMedia, type Locale } from '@123band/shared';
import type { Dictionary } from '@/i18n/dictionaries';
import type {
  JnjDivisionTab,
  JnjEdition,
  JnjJudge,
  JnjParticipant,
  JnjScore,
  JnjWinner,
} from '@/lib/queries/jnj';
import { groupScores, groupWinners, judgesForDivision } from '@/lib/queries/jnj';
import type { ReviewData } from '@/lib/queries/reviews';
import { ProductReviews } from '@/components/product/ProductReviews';
import { toRichHtml } from '@/lib/rich-text';
import { JnjLiveCta, JnjLiveSection } from '@/components/live/LiveEntry';
import { JnjSignupCta } from './JnjSignupCta';
import { JnjSignupCount, dashContestId } from './JnjSignupCount';
import { JnjVoteCount } from './JnjVoteCount';
import { MediaGallery } from '@/components/product/MediaGallery';
import { JnjOpenTags, type JnjOpenTag } from './JnjOpenTags';
import { WinnersPodium } from './WinnersPodium';
import { JnjResults } from './JnjResults';
import { ParticipantsGrid } from './ParticipantsGrid';
import { JudgesGrid } from './JudgesGrid';
import { DivisionKindTabs, DivisionTabs, divisionTabLabel } from './JnjSelector';
import { JnjSwipeTabs } from './JnjSwipeTabs';
import { JnjStickyMenu } from './JnjStickyMenu';
import { SectionNav } from './SectionNav';
import { storageImageProps } from '@/lib/image';
import type { LiveBroadcast } from '@/lib/queries/live';

/**
 * '영상 보기' — 모달을 띄우지 않고 아래 영상 섹션으로 내려보낸다.
 *
 * 모달은 영상 하나 보려고 페이지를 덮었다가 걷어내는 방식이라, 여러 편을 훑거나 보다가
 * 다른 섹션으로 넘어가려면 매번 닫아야 했다. 섹션으로 두면 다른 섹션과 똑같이 칩 네비로
 * 오갈 수 있고, 주소(#videos)로 공유·북마크도 된다.
 */
function VideoLink({
  count,
  label,
  className,
}: {
  count: number;
  label: string;
  className?: string;
}) {
  return (
    <a href="#videos" className={`btn btn-primary btn-sm shrink-0${className ? ` ${className}` : ''}`}>
      <PlayCircle size={16} />
      {label}
      {count > 1 && (
        <span className="ml-0.5 rounded-pill bg-white/20 px-1.5 text-[11px] font-semibold">
          {count}
        </span>
      )}
    </a>
  );
}

/** 섹션 제목 + 그라데이션 라인 — FORMAT/GUIDELINES/심사위원이 같은 리듬을 쓴다. */
function SectionHeading({ title }: { title: string }) {
  return (
    <div className="mb-5 flex items-center gap-4">
      <h2 className="section-title uppercase">{title}</h2>
      <span className="h-px flex-1 bg-gradient-to-r from-primary/60 to-transparent" />
    </div>
  );
}

/** FORMAT / GUIDELINES 처럼 서식 있는 본문 블록. */
function ProseSection({ id, title, html }: { id: string; title: string; html: string }) {
  return (
    <section id={id} className="scroll-mt-[calc(var(--jnj-menu-h,3.5rem)+5rem)]">
      <SectionHeading title={title} />
      <div
        className="prose-band rounded-xl bg-white p-6 text-grey-800 md:p-8
                   [&_h3]:mb-3 [&_h3]:mt-9 [&_h3]:border-b [&_h3]:border-beige [&_h3]:pb-2 [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-extrabold [&_h3]:uppercase [&_h3]:tracking-tight [&_h3]:text-ink first:[&_h3]:mt-0
                   [&_h4]:mb-1.5 [&_h4]:mt-6 [&_h4]:font-display [&_h4]:text-[15px] [&_h4]:font-bold [&_h4]:text-primary
                   [&_li]:my-1.5 [&_li]:leading-relaxed
                   [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5
                   [&_p]:my-3 [&_p]:leading-relaxed first:[&_p]:mt-0
                   [&_strong]:font-semibold [&_strong]:text-ink
                   [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5
                   [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  );
}

/**
 * 비로그인 상태의 회원 전용 섹션 — 내용을 흐리게 깔아 '무엇이 있는지'만 보여주고 로그인으로 안내한다.
 * 전체 결과(성적표)와 전체 참여자(카드 그리드)가 같이 쓴다.
 *
 * 흐림은 어디까지나 미리보기 장치다(HTML 에는 값이 그대로 들어 있다). 점수·명단 모두 이미 공개된
 * 대회 기록이라 이 정도가 적당하다고 보고, 정말로 감춰야 할 값이 생기면 서버에서 걸러야 한다.
 * 긴 예선표·수십 장짜리 카드까지 다 흐리게 늘어놓으면 페이지만 길어져서, 위쪽 한 화면만 남기고 잘라 낸다.
 */
function LockedSection({
  children,
  loginHref,
  title,
  hint,
  dict,
}: {
  children: React.ReactNode;
  loginHref: string;
  title: string;
  hint: string;
  dict: Dictionary;
}) {
  return (
    <div>
      <div className="relative max-h-96 overflow-hidden">
        <div aria-hidden className="select-none blur-[5px]">
          {/* 흐린 표는 읽을 수 없으니 보조기기·탭 이동 대상에서 빼 둔다. */}
          <div inert>{children}</div>
        </div>
        {/* 잘린 끝을 배경으로 녹인다 — 내용이 뚝 끊긴 것처럼 보이지 않게. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-white"
        />
      </div>
      <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-dashed border-grey-300 bg-cream-light px-6 py-7 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lock size={18} />
        </span>
        <div>
          <p className="font-display text-base font-bold text-ink">{title}</p>
          <p className="mt-1 text-sm text-grey-500">{hint}</p>
        </div>
        <Link href={loginHref} className="btn btn-primary btn-sm">
          {dict.auth.login}
        </Link>
      </div>
    </div>
  );
}

export function JnjEditionView({
  edition,
  winners,
  scores,
  participants,
  locale,
  dict,
  tabs,
  activeTab,
  judges,
  divisionHref,
  isAuthed = false,
  live = null,
  reviews = null,
}: {
  edition: JnjEdition;
  winners: JnjWinner[];
  /** 전 라운드 성적(0074). 비어 있으면 '전체 결과' 섹션이 통째로 빠진다. */
  scores: JnjScore[];
  /** 참가자 명단(0076). 비어 있으면 '전체 참여자' 섹션이 통째로 빠진다. */
  participants: JnjParticipant[];
  locale: Locale;
  dict: Dictionary;
  /** 상단 부문 메뉴. 비어 있으면(부문·우승자 모두 없음) 에디션 공통 본문만 보여준다. */
  tabs: JnjDivisionTab[];
  activeTab: JnjDivisionTab | null;
  judges: JnjJudge[];
  /** 부문 탭 링크 — 허브(?year&e&d)와 상세(?d)가 서로 다른 주소를 쓴다. */
  divisionHref: (code: string) => string;
  /** 로그인 여부 — 전체 결과는 회원에게만 선명하게 보여준다. */
  isAuthed?: boolean;
  /**
   * 지금 보고 있는 부문(없으면 이 대회)의 방송 중 라이브. 페이지가 찾아 넘긴다 —
   * 대회명 아래 버튼 · 섹션 칩 · 섹션 본문 셋이 같은 판단을 쓰게.
   */
  live?: LiveBroadcast | null;
  /**
   * 지금 보고 있는 부문(부문 없는 대회는 대회 공통)의 후기(0098). null 이면 후기를 꺼 둔 것 —
   * 섹션·칩이 통째로 빠진다. 대회·부문 스위치 판단은 페이지가 한다.
   */
  reviews?: ReviewData | null;
}) {
  const title = pickI18n(edition.title_i18n, locale);
  const subtitle = pickI18n(edition.subtitle_i18n, locale);
  const location = pickI18n(edition.location_i18n, locale);

  const division = activeTab?.division ?? null;
  // 부문 본문 우선 → 없으면 에디션 공통 본문.
  const formatHtml =
    (division ? toRichHtml(pickI18n(division.format_i18n, locale)) : '') ||
    toRichHtml(pickI18n(edition.format_i18n, locale));
  const guidelinesHtml =
    (division ? toRichHtml(pickI18n(division.guidelines_i18n, locale)) : '') ||
    toRichHtml(pickI18n(edition.guidelines_i18n, locale));
  // 영상도 같은 폴백 규칙 — 부문 전용 영상이 있으면 그것만, 없으면 대회 공통 영상.
  const divisionVideos = division?.video_urls?.length ? division.video_urls : null;
  const videoUrls = divisionVideos ?? edition.video_urls;

  // 부문이 선택돼 있으면 그 부문 우승자만 — 부문 이름은 탭이 이미 말해준다.
  const shownWinners = activeTab ? winners.filter((w) => w.division === activeTab.code) : winners;
  const groups = groupWinners(shownWinners);
  const shownJudges = activeTab
    ? judgesForDivision(judges, division?.id ?? null)
    : judges.filter((j) => j.division_id === null);

  // 전체 결과(예선·본선·결승) — 선택한 부문 것만. 성적을 아직 안 넣은 대회면 섹션째로 빠진다.
  const shownScores = activeTab ? scores.filter((s) => s.division === activeTab.code) : scores;
  const roundGroups = groupScores(shownScores);
  const showResults = roundGroups.length > 0;

  // 전체 참여자 — 선택한 부문의 명단. 아직 안 넣은 대회면 섹션째로 빠진다.
  const shownParticipants = activeTab
    ? participants.filter((p) => p.division === activeTab.code)
    : participants;
  const showParticipants = shownParticipants.length > 0;

  // 로그인 후 돌아올 곳 — 지금 보고 있는 부문의 그 섹션. AuthForm 은 next 를 로케일 뒤에 붙인다.
  const backPath = (activeTab ? divisionHref(activeTab.code) : `/${locale}/jnj`).replace(
    `/${locale}/`,
    '',
  );
  const loginHref = (hash = '') =>
    `/${locale}/login?next=${encodeURIComponent(hash ? `${backPath}#${hash}` : backPath)}`;

  // 참가 신청 — 부문마다 신청 폼이 다르다(0077). 다른 섹션과 같이 '지금 보고 있는 부문' 것만 보여준다.
  //
  // 이미 시작한 부문에서는 섹션째로 사라진다. '시작' 의 신호는 이 페이지가 이미 들고 있다:
  // 참가자 명단이 잡혔거나(대회 진행), 성적·시상대가 올라왔으면(완료) 더 받을 신청이 없다.
  // 링크를 지우지 않아도 알아서 닫히므로 운영자가 마감 시점에 손댈 일이 없다.
  const divisionStarted =
    shownParticipants.length > 0 || shownScores.length > 0 || shownWinners.length > 0;

  // 노출 스위치(0079)를 끄면 링크가 있어도 안 뜬다 — 주소를 미리 넣어 두고 접수 시작에 맞춰 켜거나,
  // 잠깐 내렸다 다시 올리는 일이 링크를 지웠다 붙이는 일이 되지 않게. 미적용 환경(undefined)은 켠 것으로 본다.
  const signupVisible = division?.signup_visible !== false;
  const signupUrl = divisionStarted || !signupVisible ? '' : (division?.signup_url ?? '').trim();

  // 관객 심사위원 접수 — 참가 신청과 짝을 이루는 두 번째 링크(0078). 이쪽은 대회가 시작돼도
  // 자동으로 닫지 않는다: 심사위원은 대회가 굴러가는 동안에도 받으므로 마감은 운영자가 위 스위치로 정한다.
  const voteUrl = division?.vote_visible === false ? '' : (division?.vote_url ?? '').trim();

  // 회원은 등록 폼을 건너뛴다. 버튼이 Dash 주소가 아니라 우리 경로를 가리키고, 누른 순간
  // 회원 정보로 서명 토큰을 만들어 채점 화면까지 바로 넘긴다(이름·연락처 재입력도, PIN 도 없이).
  // 토큰은 120초짜리라 '누른 순간' 만들어져야 한다 — 페이지에 미리 심어 두면 만료된다.
  // Dash 대회 코드를 뽑을 수 없는 주소(외부 폼 등)는 예전처럼 그대로 연다.
  const voteContestId = voteUrl ? dashContestId(voteUrl) : null;
  const voteHref = voteContestId
    ? `/api/jnj/judge-sso?contest=${encodeURIComponent(voteContestId)}&locale=${locale}` +
      // 눌렀는데 그사이 세션이 끊겼으면 로그인 후 이 자리로 돌려보낸다(loginHref 와 같은 형식).
      `&from=${encodeURIComponent(`${backPath}#vote`)}`
    : voteUrl;

  // 개요 카드의 모집 마크 — 카드 섬네일 마크는 '이 대회가 뭔가 받고 있다'까지만 말해준다.
  // 여기서는 어느 부문이 무엇을 받는지까지 편다: 부문 탭을 하나씩 눌러보지 않아도 알 수 있게.
  // 조건은 아래 섹션이 뜨는 규칙 그대로다 — 링크가 있고, 노출 스위치가 켜져 있고,
  // 참가 신청은 그 부문이 아직 시작 전일 것(관객 심사위원은 대회 중에도 받는다).
  const openTags = tabs.flatMap((tab) => {
    const d = tab.division;
    if (!d) return [];
    const started =
      participants.some((x) => x.division === tab.code) ||
      scores.some((x) => x.division === tab.code) ||
      winners.some((x) => x.division === tab.code);
    const label = divisionTabLabel(tab, locale, dict);
    const out: JnjOpenTag[] = [];
    // 주소에 부문(d)과 섹션 해시를 같이 담는다 — 새로고침·공유해도 같은 자리로 온다.
    const to = (id: string) => `${divisionHref(tab.code)}#${id}`;
    if (d.signup_visible !== false && (d.signup_url ?? '').trim() && !started) {
      out.push({
        key: `${tab.code}-s`,
        code: tab.code,
        href: to('signup'),
        targetId: 'signup',
        label,
        tag: dict.jnj.signupOpenTag,
        vote: false,
      });
    }
    if (d.vote_visible !== false && (d.vote_url ?? '').trim()) {
      out.push({
        key: `${tab.code}-v`,
        code: tab.code,
        href: to('vote'),
        targetId: 'vote',
        label,
        tag: dict.jnj.voteOpenTag,
        vote: true,
      });
    }
    return out;
  });

  // 재생 가능한 주소만 남긴다 — 어드민에 이미지나 잘못된 주소가 들어갔을 때 빈 섹션이 뜨지 않게.
  const playableVideos = (videoUrls ?? [])
    .map((u) => (u ?? '').trim())
    .filter((u) => u && isPlayableVideo(resolveMedia(u).kind))
    // 어드민 상한(20)과 같은 수. 여기서 더 적게 자르면 등록해 둔 영상이 조용히 사라진다.
    .slice(0, 20);

  const divisionName = activeTab ? divisionTabLabel(activeTab, locale, dict) : '';
  // 부문 전용 영상일 때만 모달 제목에 부문명을 덧붙인다(대회 공통 영상은 대회명 그대로).
  const videoTitle = divisionVideos && divisionName ? `${title} · ${divisionName}` : title;

  // 칩 순서 = 아래 섹션 순서. '누가 이겼나 → 그래서 전체 순위는 → 누가 나왔나 → 누가 심사했나' 로
  // 결과 이야기를 먼저 묶고, FORMAT·GUIDELINES(참가자용 규정)는 그 뒤에 둔다.
  const navItems = [
    // 방송 중이면 그게 지금 이 페이지에서 가장 급한 일이다 — 신청보다도 앞에 둔다.
    ...(live ? [{ id: 'live', label: dict.live.jnjBadge }] : []),
    // 신청을 받고 있으면 그게 이 페이지에 온 첫 번째 이유다 — 맨 앞에 둔다.
    ...(signupUrl ? [{ id: 'signup', label: dict.jnj.signup }] : []),
    // 관객 심사위원 접수도 지금 눌러야 하는 일이라 참가 신청 바로 뒤에 둔다.
    ...(voteUrl ? [{ id: 'vote', label: dict.jnj.vote }] : []),
    { id: 'hall-of-fame', label: dict.jnj.hallOfFame },
    // 전체 순위표는 챔피언 바로 다음이다 — 시상대에서 '그래서 나머지는?' 이 바로 이어진다.
    ...(showResults ? [{ id: 'results', label: dict.jnj.results }] : []),
    ...(showParticipants ? [{ id: 'participants', label: dict.jnj.participants }] : []),
    // 심사위원은 챔피언과 같이 항상 자리를 지킨다 — 아직 없으면 '공개 예정' 상태로 보인다.
    { id: 'judges', label: dict.jnj.judges },
    // 영상은 심사위원 바로 뒤, 포맷 앞 — 개요의 '영상 보기' 버튼도 이 칩과 같은 자리로 내려온다.
    ...(playableVideos.length ? [{ id: 'videos', label: dict.jnj.videos }] : []),
    ...(formatHtml ? [{ id: 'format', label: dict.jnj.format }] : []),
    ...(guidelinesHtml ? [{ id: 'guidelines', label: dict.jnj.guidelines }] : []),
    // 후기는 맨 끝 — 가이드라인까지 읽은 뒤 남기고 읽는 자리.
    ...(reviews ? [{ id: 'reviews', label: dict.reviews.title }] : []),
  ];

  // 지금 보고 있는 종류(J&J · BATTLE · DIV)의 부문만 탭 줄에 세운다 — 진행 방식이 다른 대회를
  // 한 줄에 섞으면 어디까지가 한 대회인지 읽히지 않는다. 종류는 한 단 위에서 고른다.
  const activeKind = activeTab?.kind ?? 'jnj';
  const kindTabs = tabs.filter((t) => t.kind === activeKind);

  // 좌우 스와이프로 넘어갈 옆 부문 — 같은 종류 안에서만. 끝 탭에서는 더 넘어가지 않는다.
  const tabIndex = activeTab ? kindTabs.findIndex((t) => t.code === activeTab.code) : -1;
  const swipeHref = (i: number) =>
    tabIndex >= 0 && kindTabs[i] ? divisionHref(kindTabs[i].code) : null;

  return (
    <div>
      {/* ── 에디션 개요 ── */}
      <div className="mb-10 overflow-hidden rounded-2xl border border-beige bg-cream-light">
        <div className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:p-8">
          {edition.cover_url && (
            /* 포스터 섬네일 — 잘라내지 않는다.
               정사각/세로 포스터를 가로 박스에 object-cover 하면 가운데 띠만 남아
               무슨 포스터인지 알 수 없다. object-contain + 상단 정렬로 전체를 담고,
               원본 크게 보기는 클릭(새 탭)으로 안내한다.

               모바일에서는 박스를 포스터 모양(3:4)으로 세운다. 화면 폭 전체에 납작한 박스를
               두고 contain 하면 포스터가 가운데 손톱만큼만 남고 양옆이 전부 여백이 된다 —
               잘라내지 않으려던 배려가 오히려 포스터를 안 보이게 만든다. 폭은 16rem 로 묶어
               가운데 세운다: 포스터가 커지되 개요 카드를 혼자 차지하진 않는다. */
            <div className="mx-auto w-full max-w-[16rem] shrink-0 md:order-last md:mx-0 md:max-w-none md:w-56">
              <a
                href={edition.cover_url}
                target="_blank"
                rel="noopener noreferrer"
                title={dict.jnj.coverZoom}
                className="group relative block aspect-[3/4] w-full cursor-zoom-in overflow-hidden rounded-xl border border-beige bg-white md:aspect-auto md:h-40"
              >
                <Image
                  {...storageImageProps(edition.cover_url, 828)}
                  alt={title}
                  fill
                  sizes="(max-width: 768px) 256px, 224px"
                  className="object-contain object-center p-1.5 transition-transform group-hover:scale-105 md:object-top"
                />
              </a>
              {/* 포스터 바로 아래가 영상 보기 자리 — 폭을 섬네일에 맞춘다.
                  포스터 확대 안내는 링크의 title 툴팁으로만 남긴다(문구 줄 제거). */}
              {playableVideos.length > 0 && (
                <VideoLink
                  count={playableVideos.length}
                  label={dict.jnj.watchVideos}
                  className="mt-2 w-full"
                />
              )}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="label-caps text-primary">{edition.year}</p>
            <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">
              {title}
            </h2>
            {subtitle && <p className="mt-2 leading-relaxed text-grey-600">{subtitle}</p>}
            {/* 개최일·장소 — 둘 다 비면 줄 자체를 없앤다(빈 줄만큼 아래 버튼이 밀려나지 않게). */}
            {(edition.held_at || location) && (
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-grey-600">
                {edition.held_at && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays size={15} className="text-primary" />
                    {edition.held_at}
                  </span>
                )}
                {location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={15} className="text-primary" />
                    {location}
                  </span>
                )}
              </div>
            )}
            {/* 라이브 중 — 방송 중일 때만 대회명 아래에 뜬다. 누르면 아래 라이브 섹션으로 간다. */}
            <JnjLiveCta live={live} locale={locale} dict={dict} className="mt-4" />
            {/* 커버 포스터가 없는 대회에서는 영상 보기가 여기(대회명 아래)로 온다. */}
            {!edition.cover_url && playableVideos.length > 0 && (
              <VideoLink
                count={playableVideos.length}
                label={dict.jnj.watchVideos}
                className="mt-4"
              />
            )}
          </div>
          {/* 부문별 모집 목록 — 지금 무엇을 받고 있는지가 개최일 바로 다음으로 급한 정보다.
              한 부문이 한 줄이고, 그 부문에서 할 수 있는 일(참가 신청·관객 심사)이 오른쪽에 붙는다.
              누르면 그 부문 탭으로 넘어가면서 해당 섹션까지 스크롤된다.
              참가 신청은 브랜드 오렌지, 관객 심사는 먹색 — 섬네일 마크와 색을 맞춰
              카드에서 본 마크가 여기서 어느 부문 것이었는지 바로 이어진다.
              자리는 본문과 포스터 사이 — 대회명 옆 빈 칸이라 본문을 밀어내지 않고, 포스터 옆에 붙어
              '이 대회에서 지금 받는 것' 한 덩어리로 읽힌다. 모바일에서는 본문 아래로 내려간다. */}
          <JnjOpenTags tags={openTags} />
        </div>
        <div className="sunset-stripe" />
      </div>

      {/* ── 부문 탭 (상단 메뉴) — 아래 네 섹션이 전부 이 선택을 따른다 ── */}
      {/* 부문 탭 + 섹션 칩 두 줄은 한 덩어리로 헤더 아래 붙는다 — 스크롤해도 사라지지 않게. */}
      {(tabs.length >= 2 || navItems.length >= 2) && (
        <JnjStickyMenu padTop={tabs.length >= 2}>
          {/* 한 줄: 종류 스위치 · 구분선 · 그 종류의 부문 탭. 아래 섹션 칩까지 두 줄로 끝난다. */}
          <DivisionTabs
            tabs={kindTabs}
            activeCode={activeTab?.code ?? ''}
            hrefFor={divisionHref}
            locale={locale}
            dict={dict}
            lead={<DivisionKindTabs tabs={tabs} activeKind={activeKind} hrefFor={divisionHref} />}
          />
          <SectionNav items={navItems} />
        </JnjStickyMenu>
      )}

      {/* 메뉴 아래 본문만 스와이프로 밀린다 — 메뉴는 제자리를 지킨다. */}
      <JnjSwipeTabs
        prevHref={swipeHref(tabIndex - 1)}
        nextHref={swipeHref(tabIndex + 1)}
        activeCode={activeTab?.code ?? ''}
        activeIndex={tabIndex}
      >

      {/* ── 라이브 — 방송 중일 때만. 칩과 같은 이유로 신청보다 앞에 둔다. ── */}
      {live && (
        <div className="mb-12">
          <JnjLiveSection live={live} locale={locale} dict={dict} />
        </div>
      )}

      {/* ── 참가 신청 — 접수 중인 부문에서만. 이 페이지에서 가장 먼저 눌릴 버튼이라 위에 크게 둔다.
           테두리는 광택이 도는 실버 그라데이션(.gradient-frame) — 페이지에서 이 섹션 하나만
           움직여서, '지금 신청을 받고 있다'는 신호가 스크롤 중에도 눈에 걸린다. ── */}
      {signupUrl && (
        <section id="signup" className="mb-12 scroll-mt-[calc(var(--jnj-menu-h,3.5rem)+5rem)]">
          <div className="gradient-frame">
            <div className="gradient-frame__inner relative overflow-hidden bg-gradient-to-br from-cream-deeper via-cream-light to-white p-6 md:p-8">
              {/* 브랜드 글로우 — 카드 오른쪽 위에서 옅게 퍼진다. */}
              <div
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl"
              />
              <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="label-caps !tracking-[2px] text-primary">
                    {divisionName || dict.jnj.eyebrow}
                  </p>
                  <h2 className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">
                    {dict.jnj.signupTitle}
                  </h2>
                  {/* 좁은 화면에서 마지막 줄에 단어 하나만 남지 않게 — 줄을 고르게 나눈다. */}
                  <p className="mt-2 text-pretty text-sm leading-relaxed text-grey-600">
                    {dict.jnj.signupSub}
                  </p>
                </div>
                {/* 지금 몇 명 신청했는지 + 신청 버튼.
                    모바일: 인원이 버튼 위 오른쪽 끝에 맞춰 선다 — 숫자는 오른쪽에 모여야
                    자릿수가 늘어도 자리가 흔들리지 않는다. 버튼은 가로를 온전히 쓴다.
                    PC: 한 줄로 펴져 버튼 왼쪽에 붙는다.
                    인원은 JNJ Dash 에서 오는 값이라 늦거나 못 가져올 수 있어 Suspense 로 떼어 둔다 —
                    실패하면 인원 보드만 빠지고 버튼은 제때 뜬다. */}
                <div className="flex shrink-0 flex-col items-end gap-4 md:flex-row md:items-center md:gap-7">
                  <Suspense fallback={null}>
                    <JnjSignupCount url={signupUrl} dict={dict} />
                  </Suspense>
                  <JnjSignupCta
                    // 비회원에게는 주소 자체를 안 내려보낸다 — 버튼만 보이고 링크는 로그인 뒤에 생긴다.
                    href={isAuthed ? signupUrl : ''}
                    label={dict.jnj.signup}
                    isAuthed={isAuthed}
                    loginHref={loginHref('signup')}
                    dict={dict}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 관객 심사위원 접수 — 신청 링크가 걸려 있는 부문에서만. 참가 신청과 같은 자리·같은 크기·
           같은 테두리로 두어 '지금 할 수 있는 일' 둘이 한 쌍으로 읽히게 한다.
           둘 다 같은 속도로 도는 프레임이라 서로 어긋나 보이지 않는다. ── */}
      {voteUrl && (
        <section id="vote" className="mb-12 scroll-mt-[calc(var(--jnj-menu-h,3.5rem)+5rem)]">
          <div className="gradient-frame">
            <div className="gradient-frame__inner relative overflow-hidden bg-gradient-to-br from-cream-deeper via-cream-light to-white p-6 md:p-8">
              {/* 브랜드 글로우 — 신청 카드와 같은 자리에서 옅게 퍼진다. */}
              <div
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl"
              />
              <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="label-caps !tracking-[2px] text-primary">
                    {divisionName || dict.jnj.eyebrow}
                  </p>
                  <h2 className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">
                    {dict.jnj.voteTitle}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-grey-600">{dict.jnj.voteSub}</p>
                </div>
                {/* 인원 + 버튼 — 참가 신청과 같은 배치·같은 이유(모바일은 위아래, PC 는 한 줄).
                    인원은 늦거나 못 가져올 수 있어 Suspense 로 떼어 둔다. */}
                <div className="flex shrink-0 flex-col items-end gap-4 md:flex-row md:items-center md:gap-7">
                  <Suspense fallback={null}>
                    <JnjVoteCount url={voteUrl} dict={dict} />
                  </Suspense>
                  <JnjSignupCta
                    // 신청과 같은 규칙 — 비회원에게는 주소를 안 내려보낸다.
                    href={isAuthed ? voteHref : ''}
                    label={dict.jnj.vote}
                    isAuthed={isAuthed}
                    loginHref={loginHref('vote')}
                    loginRequiredText={dict.jnj.voteLoginRequired}
                    dict={dict}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 챔피언 (어두운 스테이지) ── */}
      <section id="hall-of-fame" className="scroll-mt-[calc(var(--jnj-menu-h,3.5rem)+5rem)]">
        <div className="relative overflow-hidden rounded-2xl bg-ink px-5 py-12 md:px-10 md:py-16">
          {/* 무대 조명 — 브랜드 오렌지/골드 라디얼 글로우 */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                'radial-gradient(70% 50% at 50% 0%, rgba(250,82,15,0.35) 0%, rgba(255,217,0,0.10) 45%, transparent 75%)',
            }}
          />
          <div className="relative">
            <div className="mb-12 text-center">
              <p className="label-caps !tracking-[3px] text-primary">
                {divisionName || dict.jnj.eyebrow}
              </p>
              <h2 className="mt-2 font-display text-3xl font-extrabold uppercase tracking-tight text-white md:text-4xl">
                {dict.jnj.hallOfFame}
              </h2>
              <p className="mt-3 text-sm text-white/55">{dict.jnj.hallOfFameSub}</p>
            </div>
            <WinnersPodium
              groups={groups}
              locale={locale}
              dict={dict}
              hideDivisionHeading={Boolean(activeTab)}
              isAuthed={isAuthed}
              loginHref={loginHref('hall-of-fame')}
              kind={activeKind}
            />
          </div>
        </div>
      </section>

      {/* ── 전체 결과 / 참여자 / 심사위원 / FORMAT / GUIDELINES ──
          '누가 이겼나 → 그래서 전체 순위는 → 누가 나왔나 → 누가 심사했나' 로
          결과 이야기를 먼저 묶고, 참가자용 규정을 그 뒤에 둔다.
          ⚠️ 여기 순서는 위 navItems 의 칩 순서와 반드시 같아야 한다 —
             SectionNav 의 스크롤 연동이 배열 순서로 '지금 보는 섹션'을 고른다. */}
      <div className="mt-16 space-y-16">
        {showResults && (
          <section id="results" className="scroll-mt-[calc(var(--jnj-menu-h,3.5rem)+5rem)]">
            <SectionHeading title={dict.jnj.results} />
            <p className="-mt-2 mb-6 text-sm text-grey-500">{dict.jnj.resultsSub}</p>
            {isAuthed ? (
              <JnjResults groups={roundGroups} kind={activeKind} locale={locale} dict={dict} />
            ) : (
              <LockedSection
                loginHref={loginHref('results')}
                title={dict.jnj.resultsLocked}
                hint={dict.jnj.resultsLockedHint}
                dict={dict}
              >
                <JnjResults groups={roundGroups} kind={activeKind} locale={locale} dict={dict} />
              </LockedSection>
            )}
          </section>
        )}
        {showParticipants && (
          <section id="participants" className="scroll-mt-[calc(var(--jnj-menu-h,3.5rem)+5rem)]">
            <SectionHeading title={dict.jnj.participants} />
            <p className="-mt-2 mb-6 text-sm text-grey-500">{dict.jnj.participantsSub}</p>
            {isAuthed ? (
              <ParticipantsGrid
                participants={shownParticipants}
                locale={locale}
                dict={dict}
                kind={activeKind}
              />
            ) : (
              <LockedSection
                loginHref={loginHref('participants')}
                title={dict.jnj.participantsLocked}
                hint={dict.jnj.participantsLockedHint}
                dict={dict}
              >
                <ParticipantsGrid
                participants={shownParticipants}
                locale={locale}
                dict={dict}
                kind={activeKind}
              />
              </LockedSection>
            )}
          </section>
        )}
        <section id="judges" className="scroll-mt-[calc(var(--jnj-menu-h,3.5rem)+5rem)]">
          <SectionHeading title={dict.jnj.judges} />
          <p className="-mt-2 mb-6 text-sm text-grey-500">{dict.jnj.judgesSub}</p>
          <JudgesGrid judges={shownJudges} locale={locale} dict={dict} />
        </section>
        {/* 대회 영상 — 심사위원 뒤·포맷 앞. 개요의 '영상 보기' 가 내려오는 자리. 부문 전용 영상이 있으면 그것만,
            없으면 대회 공통 영상(위 videoUrls 폴백 규칙 그대로). */}
        {playableVideos.length > 0 && (
          <section id="videos" className="scroll-mt-[calc(var(--jnj-menu-h,3.5rem)+5rem)]">
            <SectionHeading title={dict.jnj.videos} />
            <p className="-mt-2 mb-6 text-sm text-grey-500">{dict.jnj.videosSub}</p>
            <MediaGallery
              items={playableVideos}
              replayLabel={dict.event.replay}
              alt={videoTitle}
            />
          </section>
        )}
        {formatHtml && <ProseSection id="format" title={dict.jnj.format} html={formatHtml} />}
        {guidelinesHtml && (
          <ProseSection id="guidelines" title={dict.jnj.guidelines} html={guidelinesHtml} />
        )}
        {/* 후기 — 부문 탭마다 따로 받는다. 키를 부문 코드로 걸어 탭을 옮기면 작성 폼도 새로 뜬다. */}
        {reviews && (
          <section id="reviews" className="scroll-mt-[calc(var(--jnj-menu-h,3.5rem)+5rem)]">
            <SectionHeading title={dict.reviews.title} />
            <p className="-mt-2 mb-6 text-sm text-grey-500">{dict.jnj.reviewsSub}</p>
            <div className="rounded-xl bg-white p-6 md:p-8">
              <ProductReviews
                key={`${edition.id}:${activeTab?.code ?? ''}`}
                locale={locale}
                dict={dict}
                initial={reviews}
                endpoint="/api/jnj/reviews"
                target={{ editionId: edition.id, division: activeTab?.code ?? '' }}
                pointHint={false}
                embedded
                placeholder={dict.jnj.reviewPlaceholder}
              />
            </div>
          </section>
        )}
      </div>
      </JnjSwipeTabs>
    </div>
  );
}
