// Design Ref: J&J 연도/행사 선택 — 참고 사이트의 시즌 탭 구조. 링크 기반이라 JS 없이도 동작하고 공유 가능하다.
import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Trophy } from 'lucide-react';
import { pickI18n, type Locale } from '@123band/shared';
import type { Dictionary } from '@/i18n/dictionaries';
import {
  DIVISION_KIND_ORDER,
  type JnjEdition,
  type JnjDivisionTab,
  type DivisionKind,
} from '@/lib/queries/jnj';
import { storageImageProps } from '@/lib/image';

/** 카드 커버 위 모집 마크 한 알 — 바탕색만 쓰는 쪽에서 정한다(참가=오렌지 · 심사위원=먹). */
const BADGE =
  'inline-flex max-w-full items-center gap-1 rounded-pill px-1.5 py-[3px] font-display text-[9px] ' +
  'font-extrabold uppercase leading-[1.15] tracking-tight text-white ' +
  'shadow-[0_2px_8px_-2px_rgba(0,0,0,0.55)] ring-1 ring-white/85 ' +
  'sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[11px] sm:leading-tight ' +
  'sm:shadow-[0_4px_14px_-2px_rgba(0,0,0,0.55)]';

/** 부문 탭 라벨 — 등록된 부문명 → 사전 번역 → 코드(대문자) 순으로 폴백. */
export function divisionTabLabel(tab: JnjDivisionTab, locale: Locale, dict: Dictionary): string {
  const own = tab.division ? pickI18n(tab.division.title_i18n, locale) : '';
  if (own) return own;
  const map = dict.jnj.divisions as Record<string, string | undefined>;
  return map[tab.code] ?? tab.code.toUpperCase();
}

/** 연도 탭 — 큰 숫자 + SEASON 캡션(참고 사이트와 동일한 리듬). */
export function YearTabs({
  years,
  active,
  locale,
  dict,
}: {
  years: number[];
  active: number;
  locale: Locale;
  dict: Dictionary;
}) {
  if (years.length < 2) return null;
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {years.map((y) => {
        const on = y === active;
        return (
          <Link
            key={y}
            href={`/${locale}/jnj?year=${y}`}
            // 같은 페이지 안의 선택이라 맨 위로 되감지 않는다 — 누를 때마다 화면이 튀지 않게.
            scroll={false}
            aria-current={on ? 'page' : undefined}
            className={`rounded-xl border px-6 py-3 text-center transition-colors ${
              on
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-grey-200 text-grey-600 hover:border-grey-300 hover:text-ink'
            }`}
          >
            <span className="block font-display text-xl font-extrabold leading-none">{y}</span>
            <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[2px] opacity-70">
              {dict.jnj.season}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/**
 * 부문 탭 — 이 페이지의 실질적인 상단 메뉴(JLCF Bachata PRO / AMA / Salsa OPEN).
 * 챔피언·심사위원·FORMAT·GUIDELINES 가 전부 이 탭 아래로 들어간다.
 * 링크 기반이라 서버 렌더 그대로 공유·색인되고, 모바일에선 가로 스크롤한다.
 */
/** 종류 이름 — 대회 성격이 서로 다르니 이름만 짧게. 부제는 성격을 한 낱말로 덧붙인다. */
// 화면에 쓰는 이름은 어드민의 코드값(jnj·battle·div)과 다르다 — 관객에게는 대회 성격이 바로 읽히는
// 말이 낫다. div(디비전)는 안무를 짜서 올리는 무대라 'Choreo'(Choreography)로 부른다.
const KIND_LABEL: Record<DivisionKind, { name: string; note: string }> = {
  jnj: { name: 'J&J', note: 'Jack & Jill' },
  battle: { name: 'BATTLE', note: '1 vs 1' },
  div: { name: 'Choreo', note: 'Choreography' },
};

/**
 * 종류 고르개 — J&J · BATTLE · DIV 는 진행 방식이 아예 다른 대회다. 부문 탭과 한 줄에 섞으면
 * 어디까지가 한 대회인지 읽히지 않아, 한 단 위에서 먼저 고르게 한다.
 * 누르면 그 종류의 첫 부문으로 간다(주소는 부문 코드 하나로 유지 — 공유·색인이 그대로다).
 */
export function DivisionKindTabs({
  tabs,
  activeKind,
  hrefFor,
}: {
  tabs: JnjDivisionTab[];
  activeKind: DivisionKind;
  hrefFor: (code: string) => string;
}) {
  const kinds = DIVISION_KIND_ORDER.filter((k) => tabs.some((t) => t.kind === k));
  if (kinds.length < 2) return null;
  return (
    // 부문 탭 줄 맨 앞에 들어가는 스위치 — 크림 트랙 위 먹색 손잡이. 옆의 부문 탭(흰 카드·오렌지 선택)과
    // 재질을 달리해 "먼저 고르는 것"으로 읽힌다. 높이는 부문 탭과 같게(44px) 맞춘다.
    <div className="inline-flex h-11 shrink-0 items-center gap-0.5 rounded-pill bg-cream p-1">
      {kinds.map((k) => {
        const first = tabs.find((t) => t.kind === k);
        if (!first) return null;
        const on = k === activeKind;
        return (
          <Link
            key={k}
            href={hrefFor(first.code)}
            scroll={false}
            aria-current={on ? 'page' : undefined}
            title={KIND_LABEL[k].note}
            className={`flex h-full shrink-0 items-center rounded-pill px-4 font-display text-[14px] font-extrabold uppercase tracking-tight transition-colors ${
              on ? 'bg-ink text-white shadow-[0_6px_16px_-10px_rgba(0,0,0,0.8)]' : 'text-grey-500 hover:text-ink'
            }`}
          >
            {KIND_LABEL[k].name}
          </Link>
        );
      })}
    </div>
  );
}

export function DivisionTabs({
  tabs,
  activeCode,
  hrefFor,
  locale,
  dict,
  lead,
}: {
  tabs: JnjDivisionTab[];
  activeCode: string;
  hrefFor: (code: string) => string;
  locale: Locale;
  dict: Dictionary;
  /** 줄 맨 앞에 붙는 종류 스위치(DivisionKindTabs). 있으면 탭이 하나뿐이어도 줄을 그린다. */
  lead?: ReactNode;
}) {
  if (tabs.length < 2 && !lead) return null;
  return (
    <nav aria-label={dict.jnj.divisionNav}>
      <div
        data-division-tabs
        className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {lead && (
          // 왼쪽에 고정(sticky)해 두는 것도 해 봤지만, 폰에서는 스위치가 줄의 2/3 를 차지해
          // 탭이 그 밑으로 들어가 버렸다. 같이 흐르게 두고, 대신 스와이프하면 선택한 탭이
          // 보이도록 줄을 옮긴다(JnjSwipeTabs).
          <>
            {lead}
            {/* 스위치와 탭 사이 가는 세로 선 — 두 묶음이 한 줄에 있어도 성격이 다름이 보이게. */}
            <span aria-hidden className="mx-1.5 h-6 w-px shrink-0 bg-grey-200" />
          </>
        )}
        {tabs.map((t) => {
          const on = t.code === activeCode;
          const sub = t.division ? pickI18n(t.division.subtitle_i18n, locale) : '';
          return (
            <Link
              key={t.code}
              href={hrefFor(t.code)}
              // 부문만 바꾸는 것이라 보던 위치를 지킨다(맨 위로 되감지 않는다).
              scroll={false}
              // 같은 줄에 종류 스위치도 aria-current 를 쓴다 — 스와이프 뒤 '선택한 탭'을
              // 가운데로 옮기는 쪽(JnjSwipeTabs)이 이 표시로 부문 탭만 고른다.
              data-division-tab
              aria-current={on ? 'page' : undefined}
              className={`flex min-h-11 shrink-0 flex-col justify-center rounded-xl border px-5 py-2 text-center transition-colors ${
                on
                  ? 'border-primary bg-primary text-white shadow-[0_6px_18px_-8px_rgba(250,82,15,0.7)]'
                  : 'border-grey-200 bg-white text-grey-600 hover:border-primary hover:text-primary'
              }`}
            >
              <span className="block font-display text-[15px] font-extrabold uppercase tracking-tight">
                {divisionTabLabel(t, locale, dict)}
              </span>
              {sub && <span className="mt-0.5 block text-[11px] opacity-75">{sub}</span>}
            </Link>
          );
        })}
      </div>
      {/* 탭과 아래 칩 바를 가르는 선. 여백 없이 바로 붙인다 — 사이에 빈 띠가 생기지 않게. */}
      <div className="mt-3 h-px bg-gradient-to-r from-primary/40 to-transparent" />
    </nav>
  );
}

/**
 * 같은 연도에 대회가 둘 이상일 때만 뜨는 행사 선택 — 페스티벌 패스(shop)와 같은 카드 그리드.
 * 칩 한 줄로는 어떤 대회인지 이름만 보였다. 커버 이미지를 같이 보여주면 고르기가 훨씬 쉽다.
 * 정렬은 페이지가 sortEditionsForDisplay 로 잡아 넘긴 순서를 그대로 따른다 —
 * 왼쪽이 앞으로 열릴 대회(임박한 순), 오른쪽이 이미 끝난 대회(최근 순).
 * 모바일·PC 모두 줄바꿈 없는 한 줄이고 옆으로 넘겨서 본다 — 대회가 몇 개로 늘어도
 * 이 띠의 높이가 그대로라, 아래 본문이 밀려 내려가지 않는다.
 */
export function EditionCards({
  editions,
  activeSlug,
  locale,
  dict,
  finishedIds,
  signupOpenIds,
  voteOpenIds,
  liveIds,
}: {
  editions: JnjEdition[];
  activeSlug: string;
  locale: Locale;
  dict: Dictionary;
  /** 결과(시상대·성적)가 등록된 에디션 id — 카드에 '대회 완료' 배지를 붙인다. */
  finishedIds?: Set<string>;
  /** 참가 신청을 받고 있는 에디션 id — 커버 위에 '참가 모집' 마크를 띄운다. */
  signupOpenIds?: Set<string>;
  /** 관객 심사위원을 받고 있는 에디션 id — 커버 위에 '관객 심사위원 모집' 마크를 띄운다. */
  voteOpenIds?: Set<string>;
  /** 지금 방송 중인 에디션 id — 커버 위에 LIVE 마크를 띄운다(0082). */
  liveIds?: Set<string>;
}) {
  if (editions.length < 2) return null;
  return (
    <nav aria-label={dict.jnj.title}>
      {/* 카드가 화면 가장자리까지 흘러가도록 컨테이너 좌우 여백만큼 빼내고 안쪽에 다시 준다 —
          그래야 마지막 카드가 여백에 걸려 잘린 것처럼 보이지 않는다. 스크롤바는 숨기고
          카드 시작점에 물리게(snap) 해서 넘길 때마다 카드가 왼쪽에 딱 맞는다.
          카드는 grow + shrink-0 — 대회가 적어 한 화면에 다 들어가면 폭을 나눠 채우고,
          많아지면 최소 폭을 지키며 옆으로 넘어간다. */}
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 [&::-webkit-scrollbar]:hidden">
        {editions.map((e) => {
          const on = e.slug === activeSlug;
          const title = pickI18n(e.title_i18n, locale);
          const location = pickI18n(e.location_i18n, locale);
          // 결과가 한 줄이라도 있으면 치른 대회, 없으면 아직 기록이 없는 대회.
          const done = finishedIds?.has(e.id) ?? false;
          // 신청 링크가 붙어 있고 아직 안 치른 대회 — 대회가 끝나면 이 집합에서 빠져 마크도 사라진다.
          // 어드민에서 노출 체크를 끄면 둘 다 집합에서 빠진다(상세 화면 섹션과 같은 규칙).
          const signupOpen = signupOpenIds?.has(e.id) ?? false;
          const voteOpen = voteOpenIds?.has(e.id) ?? false;
          const isLive = liveIds?.has(e.id) ?? false;
          return (
            <Link
              key={e.slug}
              href={`/${locale}/jnj?year=${e.year}&e=${e.slug}`}
              scroll={false}
              aria-current={on ? 'page' : undefined}
              className={`product-card w-[45vw] shrink-0 grow snap-start sm:w-52 lg:w-60 ${
                on
                  ? 'border-primary ring-2 ring-primary/30'
                  : 'hover:border-grey-300'
              }`}
            >
              <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-grey-100">
                {e.cover_url ? (
                  <Image
                    {...storageImageProps(e.cover_url, 640)}
                    alt={title || ''}
                    fill
                    sizes="(max-width: 640px) 45vw, (max-width: 1024px) 240px, 320px"
                    className="object-cover"
                  />
                ) : (
                  <Trophy size={40} className="text-grey-300" aria-hidden />
                )}
                {/* 모집 마크 — 커버는 인물 사진이 빽빽한 포스터라 반투명은 글자가 묻힌다.
                    꽉 찬 색 + 흰 테두리 + 그림자로 포스터에서 확실히 떠 보이게 한다.
                    포스터 위쪽은 대회 로고·타이틀이 몰려 있어 마크가 그걸 덮는다. 아래는 대개 날짜 띠라
                    덜 가린다. 그래서 아래에 붙인다. 둘 다 열려 있으면 위아래로 쌓인다.
                    카드 폭을 넘지 않게 줄이 접힌다. */}
                {(isLive || signupOpen || voteOpen) && (
                  <div className="absolute bottom-1 right-1 z-10 flex max-w-[calc(100%-0.5rem)] flex-col items-end gap-0.5 sm:bottom-1.5 sm:right-1.5 sm:max-w-[calc(100%-0.75rem)] sm:gap-1">
                    {/* 방송 중이 맨 위 — 지금 벌어지고 있는 일이라 모집보다 급하다. */}
                    {isLive && (
                      <span className={`${BADGE} bg-danger`}>
                        <span className="live-pulse inline-flex h-1 w-1 shrink-0 rounded-full bg-white sm:h-1.5 sm:w-1.5" aria-hidden />
                        {dict.live.jnjBadge}
                      </span>
                    )}
                    {/* 참가 모집이 먼저 — 이 카드에서 가장 급한 일이다. 깜빡이는 점으로 '지금 받는 중'을 알린다. */}
                    {signupOpen && (
                      <span className={`${BADGE} bg-primary-deep`}>
                        <span className="relative flex h-1 w-1 shrink-0 sm:h-1.5 sm:w-1.5" aria-hidden>
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                          <span className="relative inline-flex h-full w-full rounded-full bg-white" />
                        </span>
                        {dict.jnj.signupBadge}
                      </span>
                    )}
                    {/* 관객 심사위원은 참가 신청 다음이라 어두운 바탕에 정지된 점 — 오렌지 둘이 나란히
                        깜빡이면 서로를 지워 어느 쪽도 '지금 급한 것'으로 안 읽힌다. */}
                    {voteOpen && (
                      <span className={`${BADGE} bg-ink/90`}>
                        <span className="h-1 w-1 shrink-0 rounded-full bg-white sm:h-1.5 sm:w-1.5" aria-hidden />
                        {dict.jnj.voteBadge}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <span className={`label-caps ${on ? 'text-primary' : 'text-grey-400'}`}>
                  {e.year}
                </span>
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-sm font-medium text-black">{title || '—'}</p>
                  {/* 대회 상태 — 결과가 올라온 대회와 아직인 대회를 목록에서 바로 가른다.
                      끝난 대회는 조용한 초록 틴트로 남기고, 앞으로 열릴 대회만 선셋을 꽉 채운다.
                      목록에서 눈이 먼저 가야 하는 쪽은 아직 안 끝난 대회다 — 회색이면 '지난 것'처럼 읽혔다.
                      깜빡이지는 않는다: 커버 위 '참가 모집' 마크가 이미 오렌지로 점멸해서,
                      한 카드에서 오렌지가 둘 다 뛰면 서로를 지운다(위 voteOpen 주석과 같은 이유).
                      모바일에서는 여백을 예전 그대로 둔다 — 45vw 카드에서 칩이 커지면 제목이 밀린다. */}
                  <span
                    className={`shrink-0 rounded-pill px-2 py-0.5 text-[11px] ${
                      done
                        ? 'bg-success/10 font-semibold text-success'
                        : 'bg-gradient-to-r from-primary to-primary-deep font-display font-extrabold uppercase leading-tight tracking-tight text-white shadow-[0_4px_14px_-4px_rgba(250,82,15,0.9)] sm:px-2.5 sm:py-1'
                    }`}
                  >
                    {done ? dict.jnj.statusDone : dict.jnj.statusPending}
                  </span>
                </div>
                {(e.held_at || location) && (
                  <p className="line-clamp-1 pt-0.5 text-xs text-grey-500">
                    {[e.held_at, location].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
