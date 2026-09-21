// Design Ref: 라이브 방송 — 고객몰 조회. J&J 대회 화면·행사 상세의 라이브 섹션과 탈리 화면이 쓴다.
// RLS 상 공개로 보이는 건 status in (live, ended, archived) 뿐이다. 예정(scheduled) 방송은
// 관리자에게만 조회되므로, 카운트다운 화면은 '예정을 공개로 볼 수 있을 때'만 뜬다.
import { createClient } from '@/lib/supabase/server';
import { createPublicClient } from '@/lib/supabase/public';
import { productPath, type I18n, type Locale } from '@123band/shared';
import { getLinkedEvent } from '@/lib/queries/jnj';

export type LiveStatus = 'scheduled' | 'live' | 'ended' | 'archived';
export type LiveSource = 'youtube' | 'backup';

export interface LiveBroadcast {
  id: string;
  slug: string;
  event_product_id: string | null;
  /** 연결된 J&J 대회(0071). /jnj 화면의 라이브 버튼이 이 값으로 방송을 찾는다. */
  jnj_edition_id: string | null;
  /** 연결된 J&J 부문(0082). NULL 이면 그 대회 전 부문 공통이다. */
  jnj_division_id: string | null;
  title_i18n: I18n;
  yt_video_id: string | null;
  backup_hls_url: string | null;
  active_source: LiveSource;
  status: LiveStatus;
  scheduled_at: string | null;
  show_chat: boolean;
  notice_i18n: I18n;
  /** 진행 대시보드(0083) — 별도 앱의 화면. 라이브 섹션 안 영상 아래에 끼워 넣는다. */
  dashboard_url: string | null;
  show_dashboard: boolean;
  dashboard_label_i18n: I18n;
  /** 자동 새로고침 주기(초). 0 이면 끔. */
  dashboard_refresh_sec: number;
  started_at: string | null;
  updated_at: string;
}

/** 공개 조회 컬럼 — 운영용(브리지·카메라·토큰)은 애초에 내려받지 않는다. */
const LIVE_COLS =
  'id, slug, event_product_id, jnj_edition_id, jnj_division_id, title_i18n, yt_video_id, backup_hls_url, active_source, status, scheduled_at, show_chat, notice_i18n, dashboard_url, show_dashboard, dashboard_label_i18n, dashboard_refresh_sec, started_at, updated_at';

/**
 * 지금 방송 중인 것 — 헤더 글로벌 배너와 행사 상세의 LIVE 버튼이 쓴다.
 * 모든 페이지의 레이아웃에서 부르는 조회다. 'live' 상태는 RLS 상 공개라 세션이 필요 없고,
 * 세션을 빼야 만료 토큰이 배너를 사라지게 하지 않는다.
 */
export async function getActiveLive(): Promise<LiveBroadcast | null> {
  const { data, error } = await createPublicClient()
    .from('live_broadcasts')
    .select(LIVE_COLS)
    .eq('status', 'live')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data as unknown as LiveBroadcast) ?? null;
}

/** 특정 행사에 붙은 방송 중 라이브 1건 — 행사 상세의 'LIVE 시청' 버튼용. */
export async function getLiveForEvent(productId: string): Promise<LiveBroadcast | null> {
  const { data, error } = await createClient()
    .from('live_broadcasts')
    .select(LIVE_COLS)
    .eq('event_product_id', productId)
    .eq('status', 'live')
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data as unknown as LiveBroadcast) ?? null;
}

/**
 * J&J 화면에 띄울 방송 중 라이브. 찾는 순서가 곧 '누구 것이 더 가까운가' 다:
 *   1) 지금 보고 있는 부문에 직접 붙인 방송 (0082)
 *   2) 부문을 안 고른 방송 = 그 대회 전 부문 공통 (0071)
 *   3) 그 대회가 연결한 행사의 방송 (0069) — 행사 페이지와 같은 방송을 가리키게 된다
 *
 * 부문을 안 보고 있을 때(대회 개요)는 그 대회의 방송이면 어느 부문 것이든 보여준다 —
 * 개요는 '이 대회에서 지금 뭔가 하고 있다'를 알리는 자리다.
 */
export async function getLiveForJnjEdition(
  editionId: string,
  eventProductId: string | null,
  divisionId?: string | null,
): Promise<LiveBroadcast | null> {
  const supabase = createClient();
  const onEdition = supabase
    .from('live_broadcasts')
    .select(LIVE_COLS)
    .eq('jnj_edition_id', editionId)
    .eq('status', 'live');

  if (divisionId) {
    const mine = await onEdition.eq('jnj_division_id', divisionId).limit(1).maybeSingle();
    if (!mine.error && mine.data) return mine.data as unknown as LiveBroadcast;
    // 부문 전용 방송이 없으면 전 부문 공통을 본다. 다른 부문에 붙은 방송은 여기서 걸러진다 —
    // 지금 보는 부문과 상관없는 방송이 모든 탭에 똑같이 뜨던 것이 0082 이전의 모습이다.
    const shared = await supabase
      .from('live_broadcasts')
      .select(LIVE_COLS)
      .eq('jnj_edition_id', editionId)
      .eq('status', 'live')
      .is('jnj_division_id', null)
      .limit(1)
      .maybeSingle();
    if (!shared.error && shared.data) return shared.data as unknown as LiveBroadcast;
  } else {
    const any = await onEdition.limit(1).maybeSingle();
    if (!any.error && any.data) return any.data as unknown as LiveBroadcast;
  }

  if (!eventProductId) return null;
  return getLiveForEvent(eventProductId);
}

/**
 * 지금 방송 중인 대회 id 들 — /jnj 목록 카드의 LIVE 마크용.
 * 카드마다 조회하면 대회 수만큼 왕복이 된다. 한 번에 받아 Set 으로 물어본다.
 * 'live' 는 RLS 상 공개라 세션이 필요 없다(글로벌 배너와 같은 이유).
 */
export async function listLiveJnjEditionIds(): Promise<Set<string>> {
  const { data, error } = await createPublicClient()
    .from('live_broadcasts')
    .select('jnj_edition_id')
    .eq('status', 'live')
    .not('jnj_edition_id', 'is', null);
  if (error) return new Set();
  return new Set(
    (data as { jnj_edition_id: string | null }[]).map((r) => r.jnj_edition_id).filter(Boolean) as string[],
  );
}

/** 탈리 화면 상태 — 토큰이 맞을 때만 값이 온다(SECURITY DEFINER RPC, 0069). */
export interface TallyState {
  broadcast_id: string;
  slug: string;
  status: LiveStatus;
  segment: string | null;
  switch_mode: 'a' | 'b';
  updated_at: string;
  program: { id: string; slot: number; label: string; operator_name: string | null } | null;
}

export async function getTallyState(token: string): Promise<TallyState | null> {
  const { data, error } = await createClient().rpc('live_tally_state', { p_token: token });
  if (error || !data) return null;
  return data as unknown as TallyState;
}

/**
 * 방송을 보러 갈 곳 — 상단 배너가 쓴다.
 *
 * 방송은 이제 페이지가 아니라 섹션에서 튼다(대회 화면·행사 상세). 그래서 배너는 방송이
 * 붙어 있는 화면의 #live 로 보낸다. 붙은 곳이 없으면(대회도 행사도 안 고른 방송) 갈 곳이
 * 없으므로 null — 배너도 뜨지 않는다.
 */
export async function getLiveHref(live: LiveBroadcast, locale: Locale): Promise<string | null> {
  if (live.jnj_edition_id) {
    const { data } = await createPublicClient()
      .from('jnj_editions')
      .select('slug')
      .eq('id', live.jnj_edition_id)
      .maybeSingle();
    const slug = (data as { slug: string } | null)?.slug;
    if (slug) return `/${locale}/jnj/${slug}#live`;
  }
  const event = await getLinkedEvent(live.event_product_id);
  if (event) return `${productPath(locale, event)}#live`;
  return null;
}
