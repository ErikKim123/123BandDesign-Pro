// 라이브 진입 동선 — 방송 중일 때만 나타나는 두 개의 입구.
//   · LiveGlobalBanner : 사이트 어디서든 보이는 1줄 배너 (헤더 위)
//   · EventLiveCta     : 그 행사 상세 페이지 상단의 'LIVE 시청' 버튼
// 둘 다 서버 컴포넌트다 — 방송이 없으면 아무것도 렌더하지 않는다(빈 자리도 남기지 않는다).
import Link from 'next/link';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import { pickI18n, type Locale } from '@123band/shared';
import type { Dictionary } from '@/i18n/dictionaries';
import { getLiveForEvent, type LiveBroadcast } from '@/lib/queries/live';
import { LiveBadge } from './LiveBadge';
import { JnjLiveEmbed } from './JnjLiveEmbed';

// 조회는 레이아웃이 다른 레이아웃 조회들과 함께 병렬로 한다(Promise.all) — 여기서 await 하면
// 레이아웃 본문이 끝난 뒤에야 왕복이 시작돼 헤더가 그만큼 늦게 뜬다. 여기선 그리기만.
export function LiveGlobalBanner({
  live,
  href,
  locale,
  dict,
}: {
  live: LiveBroadcast | null;
  /**
   * 방송이 붙어 있는 화면의 #live. 방송은 이제 페이지가 아니라 섹션에서 트니,
   * 배너도 그 섹션으로 보낸다. 붙은 곳이 없으면(대회도 행사도 안 고른 방송) null 이고,
   * 그때는 배너를 띄우지 않는다 — 눌러도 갈 데가 없는 배너는 없느니만 못하다.
   */
  href: string | null;
  locale: Locale;
  dict: Dictionary;
}) {
  if (!live || !href) return null;
  const title = pickI18n(live.title_i18n, locale);

  return (
    <Link
      href={href}
      className="flex items-center justify-center gap-2 bg-ink px-4 py-2 text-center text-sm text-white transition-colors hover:bg-grey-800"
    >
      <span className="live-pulse inline-flex h-1.5 w-1.5 shrink-0 rounded-pill bg-danger" aria-hidden />
      <span className="font-medium">{dict.live.liveNow}</span>
      <span className="truncate text-white/70">{title}</span>
      <ArrowUpRight size={14} className="shrink-0" />
    </Link>
  );
}

/**
 * 행사 상세의 라이브 — 대회 화면과 같이 그 자리에서 튼다.
 * 예전에는 시청 페이지로 보내는 버튼이었다. 방송을 보려고 행사 정보를 떠나야
 * 했고, 돌아오려면 뒤로 가야 했다. 볼 것을 가지러 가는 대신 여기로 가져온다.
 */
export async function EventLiveCta({
  productId,
  locale,
  dict,
}: {
  productId: string;
  locale: Locale;
  dict: Dictionary;
}) {
  const live = await getLiveForEvent(productId);
  if (!live) return null;

  return (
    <div className="container-band pt-6">
      <section id="live" className="scroll-mt-24">
        <JnjLiveEmbed initial={live} locale={locale} dict={dict} />
      </section>
    </div>
  );
}

/**
 * J&J 화면의 라이브 입구 — 대회명 바로 아래.
 *
 * 방송을 여기서 찾지 않고 받아 쓰는 이유: 같은 방송을 섹션 칩·섹션 본문도 알아야 한다.
 * 각자 찾으면 같은 질의를 세 번 하고, 셋의 판단이 어긋날 수도 있다(찾는 사이에 방송이 끝나면
 * 칩은 있는데 섹션이 없는 화면이 된다). 페이지가 한 번 찾아 셋에게 나눠 준다.
 */
export function JnjLiveCta({
  live,
  locale,
  dict,
  className = '',
}: {
  live: LiveBroadcast | null;
  locale: Locale;
  dict: Dictionary;
  className?: string;
}) {
  if (!live) return null;

  return (
    // 스타일은 globals.css 의 .live-cta — 흐르는 선셋 그라디언트 + 광택 + 레이더 링을
    // 한 덩어리로 묶은 전용 스킨이다. 다른 CTA(.btn-primary)와 섞이면 둘 다 흐려진다.
    <Link href={`#live`} className={`live-cta ${className}`} scroll>
      <span className="live-cta__sheen" aria-hidden />
      <span className="live-cta__dot" aria-hidden />
      {dict.live.jnjNow}
      <ChevronDown size={14} strokeWidth={2.5} className="live-cta__chevron" aria-hidden />
    </Link>
  );
}

/**
 * 라이브 섹션 — 시청 페이지로 보내지 않고 그 자리에서 방송을 튼다.
 * 껍데기(자리·앵커)만 서버가 그리고, 알맹이는 JnjLiveEmbed 가 방송 상태를 따라가며 그린다.
 */
export function JnjLiveSection({
  live,
  locale,
  dict,
}: {
  live: LiveBroadcast | null;
  locale: Locale;
  dict: Dictionary;
}) {
  if (!live) return null;

  return (
    <section id="live" className="scroll-mt-[calc(var(--jnj-menu-h,3.5rem)+5rem)]">
      <JnjLiveEmbed initial={live} locale={locale} dict={dict} />
    </section>
  );
}
