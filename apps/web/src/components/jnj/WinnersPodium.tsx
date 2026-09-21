// Design Ref: J&J 챔피언 — 부문(아마추어·프로·살사) × 역할(커플/리더/팔로워)별 1·2·3위 시상대.
// 어두운 '스테이지' 패널 위에 카드를 올려 라이트 톤 본문과 대비시킨다(브랜드 오렌지·골드 액센트 유지).
// 반응형: 모바일 = 1위 풀폭 + 2·3위 2컬럼 / md 이상 = 2·1·3 배치 + 단상 높이 차이.
import Image from 'next/image';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { pickI18n, type Locale } from '@123band/shared';
import type { Dictionary } from '@/i18n/dictionaries';
import type { DivisionGroup, JnjRole, JnjWinner } from '@/lib/queries/jnj';
import { fmtScore } from './score';
import { CountryFlag, countryName } from './flag';
import { storageImageProps } from '@/lib/image';

const ROMAN = ['I', 'II', 'III'] as const;

// 순위별 톤 — 금/은/동. 어두운 스테이지 위에서 읽히도록 채도를 올렸다.
interface RankTone {
  ring: string;
  badge: string;
  pedestal: string;
  glow: string;
}

const GOLD: RankTone = {
  ring: 'ring-2 ring-[#ffd900]',
  badge: 'bg-[#ffd900] text-ink',
  pedestal: 'from-[#ffd900]/30 to-[#ffd900]/5 border-[#ffd900]/50 text-[#ffd900]',
  glow: 'shadow-[0_0_36px_-6px_rgba(255,217,0,0.55)]',
};
const SILVER: RankTone = {
  ring: 'ring-1 ring-white/35',
  badge: 'bg-grey-200 text-ink',
  pedestal: 'from-white/20 to-white/5 border-white/25 text-white/80',
  glow: '',
};
const BRONZE: RankTone = {
  ring: 'ring-1 ring-primary/50',
  badge: 'bg-primary text-white',
  pedestal: 'from-primary/25 to-primary/5 border-primary/40 text-primary',
  glow: '',
};

function rankTone(rank: number): RankTone {
  if (rank === 1) return GOLD;
  if (rank === 2) return SILVER;
  return BRONZE;
}

function Avatar({ src, alt, size }: { src: string | null; alt: string; size: 'lg' | 'sm' }) {
  const box =
    size === 'lg'
      ? 'aspect-[3/4] w-full'
      : 'aspect-square w-full';
  if (!src) {
    return (
      <div className={`${box} flex items-center justify-center rounded-lg bg-white/10`}>
        <span className="font-display text-2xl font-bold text-white/40">
          {alt.trim().charAt(0).toUpperCase() || '?'}
        </span>
      </div>
    );
  }
  return (
    <div className={`relative ${box} overflow-hidden rounded-lg bg-white/10`}>
      <Image
        {...storageImageProps(src, 512)}
        alt={alt}
        fill
        sizes="(max-width: 768px) 45vw, 240px"
        className="object-cover"
      />
    </div>
  );
}

function Person({
  name,
  country,
  locale,
  caption,
}: {
  name: string;
  country: string | null;
  locale: Locale;
  caption?: string;
}) {
  const region = countryName(country, locale);
  return (
    <div className="min-w-0">
      {caption && <p className="label-caps !text-[10px] text-white/45">{caption}</p>}
      <p className="truncate font-display text-base font-bold text-white md:text-lg">{name || '—'}</p>
      {region && (
        <p className="flex items-center gap-1.5 text-xs text-white/55">
          <CountryFlag cc={country} locale={locale} />
          <span className="truncate">{region}</span>
        </p>
      )}
    </div>
  );
}

/**
 * 최종 점수 — 총점(크게) + 평균(작게). 둘 다 비어 있으면(점수 미입력·0073 미적용) 줄째로 사라진다.
 * 순위는 카드 위 메달이 이미 말해주므로 여기서는 점수만 말한다.
 *
 * 비로그인이면 숫자만 흐리게 — '점수가 있다'는 사실은 남기고 값은 로그인 뒤에 보여준다.
 */
function ScoreLine({
  winner,
  dict,
  locked,
}: {
  winner: JnjWinner;
  dict: Dictionary;
  locked: boolean;
}) {
  const total = fmtScore(winner.total_score);
  const avg = fmtScore(winner.avg_score);
  if (!total && !avg) return null;
  const hide = locked ? 'select-none blur-[5px]' : '';
  return (
    <div className="flex items-baseline gap-2 border-t border-white/10 pt-2">
      {total && (
        <>
          <span className="label-caps !text-[10px] text-white/45">{dict.jnj.totalScore}</span>
          <span
            aria-hidden={locked || undefined}
            className={`font-display text-lg font-bold leading-none text-white ${hide}`}
          >
            {total}
          </span>
        </>
      )}
      {avg && (
        <span
          aria-hidden={locked || undefined}
          className={`ml-auto text-[11px] text-white/50 ${hide}`}
        >
          {dict.jnj.avgShort.replace('{v}', avg)}
        </span>
      )}
    </div>
  );
}

function WinnerCard({
  winner,
  locale,
  dict,
  locked,
}: {
  winner: JnjWinner;
  locale: Locale;
  dict: Dictionary;
  locked: boolean;
}) {
  const tone = rankTone(winner.rank);
  const isCouple = winner.role === 'couple';
  const note = pickI18n(winner.note_i18n, locale);

  return (
    <div
      className={`relative rounded-xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-sm ${tone.ring} ${tone.glow}`}
    >
      {/* 순위 메달 */}
      <span
        className={`absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-pill px-3 py-1 text-[11px] font-bold tracking-wide ${tone.badge}`}
      >
        {dict.jnj.rank.replace('{n}', String(winner.rank))}
      </span>

      <div className="mt-2">
        {isCouple ? (
          <div className="grid grid-cols-2 gap-2">
            <Avatar src={winner.photo_url} alt={winner.name} size="sm" />
            <Avatar src={winner.partner_photo_url} alt={winner.partner_name ?? ''} size="sm" />
          </div>
        ) : (
          <Avatar src={winner.photo_url} alt={winner.name} size="lg" />
        )}
      </div>

      <div className="mt-3 space-y-2">
        {isCouple ? (
          <>
            <Person
              name={winner.name}
              country={winner.country}
              locale={locale}
              caption={dict.jnj.roles.leader}
            />
            <Person
              name={winner.partner_name ?? ''}
              country={winner.partner_country}
              locale={locale}
              caption={dict.jnj.roles.follower}
            />
          </>
        ) : (
          <Person name={winner.name} country={winner.country} locale={locale} />
        )}
        {note && <p className="text-xs leading-relaxed text-white/50">{note}</p>}
        <ScoreLine winner={winner} dict={dict} locked={locked} />
      </div>
    </div>
  );
}

/** 한 역할(커플/리더/팔로워)의 1·2·3위 시상대. */
function Podium({
  winners,
  locale,
  dict,
  heading,
  locked,
}: {
  winners: JnjWinner[];
  locale: Locale;
  dict: Dictionary;
  heading?: string;
  locked: boolean;
}) {
  const byRank = (r: number) => winners.find((w) => w.rank === r);
  // 시상대 배치(2·1·3)와 단상 높이 — md 이상에서만 적용. 모바일은 1위를 위에 크게.
  const slots: { rank: number; order: string; span: string; pedestal: string }[] = [
    { rank: 1, order: 'md:order-2', span: 'col-span-2 md:col-span-1', pedestal: 'md:h-20' },
    { rank: 2, order: 'md:order-1', span: '', pedestal: 'md:h-12' },
    { rank: 3, order: 'md:order-3', span: '', pedestal: 'md:h-8' },
  ];

  return (
    <div>
      {heading && (
        <p className="mb-5 text-center label-caps !text-[11px] !tracking-[2px] text-white/60">
          {heading}
        </p>
      )}
      <div className="grid grid-cols-2 items-end gap-3 md:grid-cols-3 md:gap-5">
        {slots.map((slot) => {
          const w = byRank(slot.rank);
          if (!w) return null;
          const tone = rankTone(slot.rank);
          return (
            <div key={slot.rank} className={`${slot.order} ${slot.span} flex flex-col`}>
              <WinnerCard winner={w} locale={locale} dict={dict} locked={locked} />
              {/* 단상 — PC 에서만. 높이 차이가 순위를 시각적으로 드러낸다. */}
              <div
                aria-hidden
                className={`hidden items-center justify-center rounded-b-lg border-x border-b bg-gradient-to-b font-display text-lg font-bold md:mt-2 md:flex ${slot.pedestal} ${tone.pedestal}`}
              >
                {ROMAN[slot.rank - 1] ?? ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 부문 라벨 — 사전에 있는 값이면 번역, 없으면 원문(대문자). */
function divisionLabel(division: string, dict: Dictionary): string {
  const map = dict.jnj.divisions as Record<string, string | undefined>;
  return map[division] ?? division.toUpperCase();
}

function roleHeading(role: JnjRole, dict: Dictionary): string | undefined {
  if (role === 'leader') return dict.jnj.leaders;
  if (role === 'follower') return dict.jnj.followers;
  return undefined; // 커플 시상은 별도 헤딩 없이 바로 시상대
}

export function WinnersPodium({
  groups,
  locale,
  dict,
  /** 부문 탭으로 이미 부문이 드러날 때는 부문 헤딩을 접는다(같은 이름이 두 번 찍히지 않게). */
  hideDivisionHeading = false,
  isAuthed = false,
  loginHref,
  kind = 'jnj',
}: {
  groups: DivisionGroup[];
  locale: Locale;
  dict: Dictionary;
  hideDivisionHeading?: boolean;
  /** 비로그인이면 카드의 점수를 흐리게 하고 아래에 로그인 안내를 붙인다. */
  isAuthed?: boolean;
  loginHref?: string;
  /** 부문 종류(0110). 리더·팔로워는 J&J 에서만 뜻이 있어 그 밖에서는 머리말을 달지 않는다. */
  kind?: string;
}) {
  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/20 bg-white/[0.03] px-6 py-14 text-center">
        <p className="font-display text-lg text-white/80">{dict.jnj.noWinners}</p>
        <p className="mt-2 text-sm text-white/45">{dict.jnj.noWinnersHint}</p>
      </div>
    );
  }

  // 점수가 하나도 없는 대회에서는 잠금 안내가 가리킬 것이 없다.
  const hasAnyScore = groups.some((g) =>
    g.roles.some((r) => r.winners.some((w) => fmtScore(w.total_score) || fmtScore(w.avg_score))),
  );
  const locked = !isAuthed && hasAnyScore;

  return (
    <div className="space-y-14">
      {groups.map((g) => (
        <section key={g.division}>
          {!hideDivisionHeading && (
            <div className="mb-7 flex items-center gap-4">
              <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-white md:text-2xl">
                {divisionLabel(g.division, dict)}
              </h3>
              <span className="h-px flex-1 bg-gradient-to-r from-primary/70 to-transparent" />
            </div>
          )}
          <div className="space-y-12">
            {g.roles.map((r) => (
              <Podium
                key={r.role}
                winners={r.winners}
                locale={locale}
                dict={dict}
                heading={kind === 'jnj' ? roleHeading(r.role, dict) : undefined}
                locked={locked}
              />
            ))}
          </div>
        </section>
      ))}
      {locked && loginHref && (
        <p className="flex flex-wrap items-center justify-center gap-2 text-sm text-white/60">
          <Lock size={14} className="text-primary" />
          {dict.jnj.scoreLocked}
          <Link
            href={loginHref}
            className="font-semibold text-primary underline underline-offset-4 hover:text-white"
          >
            {dict.auth.login}
          </Link>
        </p>
      )}
    </div>
  );
}
