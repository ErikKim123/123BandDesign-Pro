// Design Ref: J&J(Jack & Jill) — 연도/행사별 대회 에디션 + 부문별 우승자 조회.
// 상단 네비 'J&J'(/jnj)와 에디션 상세(/jnj/[slug]) 가 공유한다.
import { createClient } from '@/lib/supabase/server';
import { withSlugCols } from '@/lib/queries/columns';
import type { EventContent, I18n } from '@123band/shared';

export type JnjRole = 'leader' | 'follower' | 'couple';

export interface JnjEdition {
  id: string;
  slug: string;
  year: number;
  event_product_id: string | null;
  title_i18n: I18n;
  subtitle_i18n: I18n;
  location_i18n: I18n;
  held_at: string | null;
  cover_url: string | null;
  /** 관련 영상 링크(최대 20개, 0067·0091). 있으면 개요 카드에 '영상 보기' 버튼이 뜨고 모달로 재생된다. */
  video_urls: string[] | null;
  /** 후기 받기 스위치(0098). 미적용 환경에서는 오지 않는다(undefined) — 켠 것으로 본다. */
  reviews_enabled?: boolean;
  format_i18n: I18n;
  guidelines_i18n: I18n;
  sort_order: number;
  /** 등록 시각 — sort_order 가 같을 때 '최근 등록이 앞'으로 가르는 기준. */
  created_at: string | null;
}

/** 대회 안의 부문 — 상단 탭 하나. 0053. */
export interface JnjDivision {
  id: string;
  edition_id: string;
  /** jnj_winners.division 과 매칭되는 코드. */
  code: string;
  /** 부문 종류(0110) — 'jnj' | 'battle' | 'div'. 미적용 환경에서는 오지 않는다(undefined) → J&J 로 본다. */
  kind?: string;
  title_i18n: I18n;
  subtitle_i18n: I18n;
  /** 비어 있으면 에디션 공통 본문으로 폴백한다. */
  format_i18n: I18n;
  guidelines_i18n: I18n;
  /** 이 부문 전용 영상(최대 20개, 0068·0091). 비어 있으면 에디션 공통 영상으로 폴백한다. */
  video_urls: string[] | null;
  /** 이 부문 후기 받기 스위치(0098). 미적용 환경에서는 오지 않는다(undefined) — 켠 것으로 본다. */
  reviews_enabled?: boolean;
  /** 참가 신청 링크(0077). 미적용 환경에서는 아예 오지 않는다(undefined). */
  signup_url?: string | null;
  /** 관객 심사위원 접수 링크(0078, 컬럼명은 vote_url). 미적용 환경에서는 아예 오지 않는다(undefined). */
  vote_url?: string | null;
  /** 참가 신청·관객 심사위원 섹션 노출 스위치(0079). 링크가 있어도 false 면 안 뜬다.
      미적용 환경에서는 아예 오지 않는다(undefined) → 켜진 것으로 본다. */
  signup_visible?: boolean | null;
  vote_visible?: boolean | null;
  sort_order: number;
}

/** 심사위원. division_id 가 null 이면 그 대회 전 부문에 공통으로 노출된다. 0053. */
export interface JnjJudge {
  id: string;
  edition_id: string;
  division_id: string | null;
  name: string;
  title_i18n: I18n;
  country: string | null;
  photo_url: string | null;
  bio_i18n: I18n;
  instagram: string | null;
  sort_order: number;
}

export interface JnjWinner {
  id: string;
  edition_id: string;
  division: string;
  role: JnjRole;
  /** 1~3 은 시상대, 4위 이하는 '전체 결과' 표에만 나온다(0073). */
  rank: number;
  name: string;
  country: string | null;
  photo_url: string | null;
  partner_name: string | null;
  partner_country: string | null;
  partner_photo_url: string | null;
  note_i18n: I18n;
  /** 0073 — 미적용 환경에서는 아예 오지 않는다(undefined). */
  entry_no?: string | null;
  total_score?: number | string | null;
  avg_score?: number | string | null;
}

/** 전 라운드 성적 1줄 (0074). 예선·본선은 O표/통과, 결승은 순위·점수만 채워진다. */
export type JnjRound = 'prelim' | 'semi' | 'final';

/**
 * 결승 채점 상세 (0084) — 총점이 어떻게 나왔는지. 심사위원 한 명이 한 줄이고,
 * scores 는 items 와 같은 순서·같은 길이다(안 매긴 항목은 null).
 *
 * name 은 심사위원 이름이다 — 이 표는 비로그인도 읽는 공개 데이터이므로 '누가 누구에게
 * 몇 점' 이 그대로 공개된다. 채점을 드러내는 것이 이 표의 목적이라 그렇게 둔다.
 * 이름을 싣기 전에 가져온 옛 성적에는 name 이 없다 — 그때는 '심사위원 1·2·3' 으로
 * 되돌아간다. 줄 순서는 어느 쪽이든 심사석 순번이다.
 */
export interface JnjScoreCriteria {
  items: string[];
  judges: { name?: string; scores: (number | null)[] }[];
}

export interface JnjScore {
  id: string;
  division: string;
  round: JnjRound;
  role: 'leader' | 'follower';
  entry_no: string;
  name: string;
  country: string | null;
  /** 참가자 사진(0075). 미적용 환경에서는 아예 오지 않는다(undefined) — 이니셜로 대체된다. */
  photo_url?: string | null;
  /** 예선·본선 — 심사위원 O표 수 / 통과 여부. */
  votes: number | null;
  passed: boolean | null;
  /** 결승 — 순위 / 최종(가중) 총점 / 평균. */
  rank: number | null;
  total_score: number | string | null;
  avg_score: number | string | null;
  /** 결승 채점 상세(0084). 미적용 환경에서는 아예 오지 않는다(undefined) — 펼침이 사라진다. */
  criteria?: JnjScoreCriteria | null;
  sort_order: number;
}

/** 대회에 나온 사람 한 명 (0076). 성적과 무관하게 '누가 나왔나'. */
export interface JnjParticipant {
  id: string;
  division: string;
  role: 'leader' | 'follower';
  entry_no: string;
  name: string;
  country: string | null;
  photo_url: string | null;
  instagram: string | null;
  sort_order: number;
}

const EDITION_COLS =
  'id, slug, year, event_product_id, title_i18n, subtitle_i18n, location_i18n, held_at, cover_url, format_i18n, guidelines_i18n, sort_order, created_at';

const WINNER_COLS =
  'id, edition_id, division, role, rank, name, country, photo_url, partner_name, partner_country, partner_photo_url, note_i18n';
/** 0073 — 점수·참가번호. 미적용 환경이 있어 조건부로만 붙인다. */
const WINNER_SCORE_COLS = 'entry_no, total_score, avg_score';
const SCORE_COLS =
  'id, division, round, role, entry_no, name, country, votes, passed, rank, total_score, avg_score, sort_order';
/** 0075 — 참가자 사진. 미적용 환경이 있어 조건부로만 붙인다. */
const SCORE_PHOTO_COLS = 'photo_url';
/** 0084 — 결승 채점 상세. 0075 와 적용 시점이 달라 따로 물어본다. */
const SCORE_CRITERIA_COLS = 'criteria';
const PARTICIPANT_COLS =
  'id, division, role, entry_no, name, country, photo_url, instagram, sort_order';
const DIVISION_COLS =
  'id, edition_id, code, title_i18n, subtitle_i18n, format_i18n, guidelines_i18n, sort_order';
const JUDGE_COLS =
  'id, edition_id, division_id, name, title_i18n, country, photo_url, bio_i18n, instagram, sort_order';

// 나중에 붙은 컬럼(에디션·부문 video_urls 0067·0068, 우승자 점수 0073) 은 마이그레이션 미적용
// 환경이 있을 수 있어 조건부로만 붙인다 — select 에 없는 컬럼이 하나라도 끼면 PostgREST 가 42703 으로
// 쿼리 전체를 실패시킨다(columns.ts 와 같은 함정).
const optionalColumn = new Map<string, boolean>();

/**
 * probe 컬럼이 있으면 extra 를 select 목록에 덧붙인다. 탐지 결과는 프로세스당 1회만.
 * @param extra 붙일 컬럼 목록(쉼표 구분) · @param probe 존재 여부를 물어볼 대표 컬럼
 */
async function withOptionalCols(
  table: string,
  cols: string,
  extra: string,
  probe: string = extra,
): Promise<string> {
  const key = `${table}:${probe}`;
  let has = optionalColumn.get(key);
  if (has === undefined) {
    const { error } = await createClient().from(table).select(probe).limit(1);
    if (!error) has = true;
    else if ((error as { code?: string }).code === '42703') has = false;
    else return cols; // 일시적 오류 — 캐시하지 않고 이번 요청만 빼고 간다
    optionalColumn.set(key, has);
  }
  return has ? `${cols}, ${extra}` : cols;
}

const editionCols = async () => {
  const cols = await withOptionalCols('jnj_editions', EDITION_COLS, 'video_urls');
  return withOptionalCols('jnj_editions', cols, 'reviews_enabled'); // 0098
};
const divisionCols = async () => {
  // 0068(video_urls) · 0077(signup_url) · 0078(vote_url) · 0079(노출 스위치) 는 적용 시점이
  // 달라 각각 물어본다. 0079 는 두 컬럼이 한 마이그레이션이라 한 번만 물어보면 된다.
  let cols = await withOptionalCols('jnj_divisions', DIVISION_COLS, 'video_urls');
  cols = await withOptionalCols('jnj_divisions', cols, 'signup_url');
  cols = await withOptionalCols('jnj_divisions', cols, 'vote_url');
  cols = await withOptionalCols('jnj_divisions', cols, 'reviews_enabled'); // 0098
  cols = await withOptionalCols('jnj_divisions', cols, 'kind'); // 0110
  return withOptionalCols('jnj_divisions', cols, 'signup_visible, vote_visible', 'signup_visible');
};
const winnerCols = () =>
  withOptionalCols('jnj_winners', WINNER_COLS, WINNER_SCORE_COLS, 'total_score');

/**
 * 노출중인 에디션 전체 — 최신 연도 우선, 같은 연도는 sort_order 순.
 * sort_order 까지 같으면(둘 다 기본값 0 인 흔한 경우) 최근 등록이 앞에 온다.
 */
export async function listJnjEditions(): Promise<JnjEdition[]> {
  const { data, error } = await createClient()
    .from('jnj_editions')
    .select(await editionCols())
    .eq('is_active', true)
    .order('year', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  // 마이그레이션(0052) 미적용 환경에서도 페이지가 죽지 않게 — 빈 목록으로 폴백한다.
  if (error) return [];
  return (data ?? []) as unknown as JnjEdition[];
}

// ── 에디션 표시 순서 ─────────────────────────────────────────

/**
 * 표시용 개최일 문자열에서 시작일을 뽑는다 — held_at 은 '2026.06.23 – 06.26' 같은 자유 텍스트라
 * 그대로는 정렬 키가 못 된다. 연·월·일이 이 순서로 붙어 있으면 어떤 구분자든 읽는다. 못 읽으면 null.
 */
export function parseHeldAt(raw: string | null): number | null {
  const m = (raw ?? '').match(/(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]?\s*(\d{1,2})?/);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3] ?? 1));
  return Number.isNaN(t) ? null : t;
}

/**
 * 에디션 → 연결 행사(티켓 상품)의 시작일(ms). held_at 이 비어 있을 때의 정렬 폴백이다.
 * 실패하면 빈 맵 — 날짜를 못 구한 대회는 넘겨받은 순서(sort_order)를 그대로 지킨다.
 */
export async function listEditionEventDates(
  editions: JnjEdition[],
): Promise<Map<string, number>> {
  const ids = [...new Set(editions.map((e) => e.event_product_id).filter(Boolean))] as string[];
  const out = new Map<string, number>();
  if (ids.length === 0) return out;
  const { data, error } = await createClient()
    .from('products')
    .select('id, event_content')
    .in('id', ids);
  if (error) return out;
  const byProduct = new Map<string, number>();
  for (const p of (data ?? []) as { id: string; event_content: EventContent | null }[]) {
    const t = Date.parse(p.event_content?.startAt ?? '');
    if (!Number.isNaN(t)) byProduct.set(p.id, t);
  }
  for (const e of editions) {
    const t = e.event_product_id ? byProduct.get(e.event_product_id) : undefined;
    if (t != null) out.set(e.id, t);
  }
  return out;
}

/**
 * 카드에 늘어놓는 순서 — 아직 안 치른 대회가 왼쪽(임박한 순), 끝난 대회가 오른쪽(최근 순).
 * '끝남' 판정은 카드 배지와 같은 기준(결과가 한 줄이라도 올라왔는가)을 써서 배지와 자리가
 * 어긋나지 않게 한다. 날짜는 held_at → 연결 행사 시작일 순으로 읽고, 둘 다 없는 대회는
 * 날짜가 있는 대회 뒤에 원래 순서(sort_order)대로 붙는다.
 */
export function sortEditionsForDisplay(
  editions: JnjEdition[],
  finishedIds?: Set<string>,
  eventDates?: Map<string, number>,
): JnjEdition[] {
  const dateOf = (e: JnjEdition) => parseHeldAt(e.held_at) ?? eventDates?.get(e.id) ?? null;
  const doneOf = (e: JnjEdition) => (finishedIds?.has(e.id) ? 1 : 0);
  return [...editions].sort((a, b) => {
    const byDone = doneOf(a) - doneOf(b);
    if (byDone) return byDone;
    const da = dateOf(a);
    const db = dateOf(b);
    if (da == null || db == null) return da == null ? (db == null ? 0 : 1) : -1;
    return doneOf(a) ? db - da : da - db;
  });
}

/** 에디션 1건 (slug). 없으면 null. */
export async function getJnjEdition(slug: string): Promise<JnjEdition | null> {
  const { data, error } = await createClient()
    .from('jnj_editions')
    .select(await editionCols())
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (error) return null;
  return (data as unknown as JnjEdition) ?? null;
}

/** 에디션의 우승자 — 부문/역할/순위 순. */
export async function listJnjWinners(editionId: string): Promise<JnjWinner[]> {
  const { data, error } = await createClient()
    .from('jnj_winners')
    .select(await winnerCols())
    .eq('edition_id', editionId)
    .eq('is_active', true)
    .order('rank', { ascending: true });
  if (error) return [];
  return (data ?? []) as unknown as JnjWinner[];
}

/**
 * 에디션의 전 라운드 성적(예선·본선·결승). '전체 결과' 섹션이 읽는다.
 * 0074 미적용 환경(테이블 없음)이면 빈 배열 → 섹션째로 사라진다.
 */
export async function listJnjScores(editionId: string): Promise<JnjScore[]> {
  const cols = await withOptionalCols('jnj_scores', SCORE_COLS, SCORE_PHOTO_COLS);
  const { data, error } = await createClient()
    .from('jnj_scores')
    .select(await withOptionalCols('jnj_scores', cols, SCORE_CRITERIA_COLS))
    .eq('edition_id', editionId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) return [];
  return (data ?? []) as unknown as JnjScore[];
}

/**
 * 에디션의 참가자 명단. '전체 참여자' 섹션이 읽는다.
 * 0076 미적용 환경(테이블 없음)이면 빈 배열 → 섹션째로 사라진다.
 */
export async function listJnjParticipants(editionId: string): Promise<JnjParticipant[]> {
  const { data, error } = await createClient()
    .from('jnj_participants')
    .select(PARTICIPANT_COLS)
    .eq('edition_id', editionId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) return [];
  return (data ?? []) as unknown as JnjParticipant[];
}

/**
 * 결과가 등록된 에디션 id 집합 — 대회 카드의 '대회 완료 / 대회 대기' 배지에 쓴다.
 * 시상대(jnj_winners)나 성적(jnj_scores)이 한 줄이라도 있으면 '치른 대회'로 본다.
 * 테이블이 없는(마이그레이션 미적용) 환경에서는 그 쪽만 조용히 빠진다.
 */
export async function listFinishedEditionIds(): Promise<Set<string>> {
  const supabase = createClient();
  const [winners, scores] = await Promise.all([
    supabase.from('jnj_winners').select('edition_id').eq('is_active', true),
    supabase.from('jnj_scores').select('edition_id').eq('is_active', true),
  ]);
  const ids = new Set<string>();
  for (const rows of [winners.data, scores.data]) {
    for (const r of (rows ?? []) as { edition_id: string }[]) ids.add(r.edition_id);
  }
  return ids;
}

/** 대회 카드에 띄우는 모집 마크 두 종류의 대상 id. 상세 화면의 섹션이 뜨는 조건과 같게 고른다. */
export interface JnjOpenEditionIds {
  /** 참가 신청을 받는 대회 — '참가 모집' 마크. */
  signup: Set<string>;
  /** 관객 심사위원을 받는 대회 — '관객 심사위원 모집' 마크. */
  vote: Set<string>;
}

/**
 * 모집 중인 에디션 id 집합 — 대회 카드의 마크 두 종류에 쓴다.
 * 부문(0077·0078) 중 하나라도 링크가 붙어 있고 노출 스위치(0079)가 켜져 있으면 모집 중으로 본다.
 * 스위치를 끄면 링크가 남아 있어도 마크가 사라진다 — 상세 화면 섹션과 같은 규칙이라 둘이 어긋나지 않는다.
 *
 * 참가 신청만 '이미 시작한 대회'가 추가로 빠진다: 참가자 명단·성적·시상대가 한 줄이라도 잡혔으면
 * 더 받을 신청이 없다(상세 화면의 신청 섹션이 닫히는 규칙과 같다). 관객 심사위원은 대회가 굴러가는
 * 동안에도 받으므로 시작 여부로 닫지 않는다 — 마감은 운영자가 스위치로 정한다.
 *
 * 마이그레이션 미적용 환경에는 컬럼 자체가 없으므로 그 마크만 조용히 빈 집합.
 * @param finishedIds listFinishedEditionIds() 결과(시상대·성적이 올라온 대회)
 */
export async function listJnjOpenEditionIds(finishedIds: Set<string>): Promise<JnjOpenEditionIds> {
  const empty = { signup: new Set<string>(), vote: new Set<string>() };
  const cols = await divisionCols();
  const hasSignup = cols.includes('signup_url');
  const hasVote = cols.includes('vote_url');
  if (!hasSignup && !hasVote) return empty;
  // 노출 스위치(0079)는 두 컬럼이 한 마이그레이션이라 하나만 확인하면 된다.
  const hasVisible = cols.includes('signup_visible');
  const select = [
    'edition_id',
    ...(hasSignup ? ['signup_url'] : []),
    ...(hasVote ? ['vote_url'] : []),
    ...(hasVisible ? ['signup_visible', 'vote_visible'] : []),
  ].join(', ');

  const supabase = createClient();
  const [divisions, participants] = await Promise.all([
    supabase.from('jnj_divisions').select(select).eq('is_active', true),
    supabase.from('jnj_participants').select('edition_id').eq('is_active', true),
  ]);
  if (divisions.error) return empty;
  // 참가자 명단이 잡혔으면 접수는 이미 끝난 대회다(성적·시상대는 finishedIds 가 들고 있다).
  const started = new Set(finishedIds);
  for (const r of (participants.data ?? []) as { edition_id: string }[]) started.add(r.edition_id);

  // select 문자열을 조건부로 만들면 supabase-js 가 결과 타입을 못 읽는다 — unknown 을 거쳐 캐스팅.
  type Row = {
    edition_id: string;
    signup_url?: string | null;
    vote_url?: string | null;
    signup_visible?: boolean | null;
    vote_visible?: boolean | null;
  };
  const open = { signup: new Set<string>(), vote: new Set<string>() };
  for (const r of (divisions.data ?? []) as unknown as Row[]) {
    if (r.signup_visible !== false && (r.signup_url ?? '').trim() && !started.has(r.edition_id)) {
      open.signup.add(r.edition_id);
    }
    if (r.vote_visible !== false && (r.vote_url ?? '').trim()) open.vote.add(r.edition_id);
  }
  return open;
}

/** 에디션의 부문 — 상단 탭 순서(sort_order). 0053 미적용 환경이면 빈 배열 → 0052 화면으로 폴백. */
export async function listJnjDivisions(editionId: string): Promise<JnjDivision[]> {
  const { data, error } = await createClient()
    .from('jnj_divisions')
    .select(await divisionCols())
    .eq('edition_id', editionId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) return [];
  return (data ?? []) as unknown as JnjDivision[];
}

/** 에디션의 심사위원 전체(부문 공통 + 부문별). 화면에서 부문별로 걸러 쓴다. */
export async function listJnjJudges(editionId: string): Promise<JnjJudge[]> {
  const { data, error } = await createClient()
    .from('jnj_judges')
    .select(JUDGE_COLS)
    .eq('edition_id', editionId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) return [];
  return (data ?? []) as unknown as JnjJudge[];
}

/** 에디션에 연결된 행사(티켓 상품) — 상세로 가는 링크용. 없거나 실패하면 null. */
export interface LinkedEvent {
  id: string;
  slug: string | null;
  product_type: string;
  name_i18n: I18n;
}

export async function getLinkedEvent(productId: string | null): Promise<LinkedEvent | null> {
  if (!productId) return null;
  const { data, error } = await createClient()
    .from('products')
    // slug(0035) 는 미적용 환경이 있을 수 있어 조건부로만 붙인다 — 없는 컬럼이 끼면 쿼리 전체가 42703 으로 죽는다.
    .select(await withSlugCols('id, product_type, name_i18n'))
    .eq('id', productId)
    .in('status', ['active', 'soldout'])
    .maybeSingle();
  if (error) return null;
  return (data as unknown as LinkedEvent) ?? null;
}

// ── 그룹핑 (표시용) ─────────────────────────────────────────
/** 표시 순서가 정해진 부문. 그 외 값은 뒤에 원문 그대로 붙는다. */
export const KNOWN_DIVISIONS = ['amateur', 'pro', 'salsa', 'open'] as const;
/** 시상대 안에서의 역할 순서 — 커플 → 리더 → 팔로워. */
const ROLE_ORDER: JnjRole[] = ['couple', 'leader', 'follower'];

export interface DivisionGroup {
  division: string;
  /** 역할별 시상대. 해당 역할 수상자가 없으면 아예 빠진다. */
  roles: { role: JnjRole; winners: JnjWinner[] }[];
}

/** 우승자 목록 → 부문별 → 역할별 시상대(1·2·3위 정렬). */
export function groupWinners(winners: JnjWinner[]): DivisionGroup[] {
  const byDivision = new Map<string, JnjWinner[]>();
  for (const w of winners) {
    const list = byDivision.get(w.division) ?? [];
    list.push(w);
    byDivision.set(w.division, list);
  }

  const order = (d: string) => {
    const i = (KNOWN_DIVISIONS as readonly string[]).indexOf(d);
    return i === -1 ? KNOWN_DIVISIONS.length : i;
  };

  return [...byDivision.entries()]
    .sort(([a], [b]) => order(a) - order(b) || a.localeCompare(b))
    .map(([division, list]) => ({
      division,
      roles: ROLE_ORDER.map((role) => ({
        role,
        winners: list.filter((w) => w.role === role).sort((a, b) => a.rank - b.rank),
      })).filter((g) => g.winners.length > 0),
    }));
}

// ── 부문 탭 (표시용) ────────────────────────────────────────
/** 상단 부문 탭 1개. division 이 null 이면 우승자 데이터에만 존재하는 코드로 만든 임시 탭. */
export interface JnjDivisionTab {
  code: string;
  division: JnjDivision | null;
  /** 'jnj' | 'battle' | 'div' — 탭 줄에서 이 순서·묶음으로 보여 준다. */
  kind: DivisionKind;
}

export type DivisionKind = 'jnj' | 'battle' | 'div';

/** 탭 줄에 나오는 순서. 대회의 본편인 J&J 가 먼저. */
export const DIVISION_KIND_ORDER: DivisionKind[] = ['jnj', 'battle', 'div'];

const asKind = (v: unknown): DivisionKind =>
  v === 'battle' || v === 'div' ? v : 'jnj';

/**
 * 상단 부문 탭 목록 — 등록된 부문(sort_order) 이 먼저, 그 뒤에 우승자·성적에만 있고
 * 부문으로는 등록되지 않은 코드를 붙인다. 부문을 아직 안 만든 대회에서도 기록이 사라지지 않게.
 */
export function divisionTabs(
  divisions: JnjDivision[],
  winners: JnjWinner[],
  scores: JnjScore[] = [],
): JnjDivisionTab[] {
  const tabs: JnjDivisionTab[] = divisions.map((d) => ({
    code: d.code,
    division: d,
    kind: asKind(d.kind),
  }));
  const known = new Set(tabs.map((t) => t.code));
  const orphans = [
    ...new Set([...winners.map((w) => w.division), ...scores.map((s) => s.division)]),
  ].filter((c) => !known.has(c));
  const order = (d: string) => {
    const i = (KNOWN_DIVISIONS as readonly string[]).indexOf(d);
    return i === -1 ? KNOWN_DIVISIONS.length : i;
  };
  orphans.sort((a, b) => order(a) - order(b) || a.localeCompare(b));
  // 종류별로 묶어 둔다 — 탭 줄의 묶음 표시도, 스와이프로 넘기는 순서도 이 배열을 그대로 따른다.
  // 부문으로 등록되지 않은 코드(기록에만 있는 것)는 J&J 로 본다.
  const all: JnjDivisionTab[] = [
    ...tabs,
    ...orphans.map((code) => ({ code, division: null, kind: 'jnj' as DivisionKind })),
  ];
  return all.sort(
    (a, b) => DIVISION_KIND_ORDER.indexOf(a.kind) - DIVISION_KIND_ORDER.indexOf(b.kind),
  );
}

/** 그 부문에서 보여줄 심사위원 — 전 부문 공통(division_id=null) + 해당 부문 지정. */
export function judgesForDivision(judges: JnjJudge[], divisionId: string | null): JnjJudge[] {
  return judges.filter((j) => j.division_id === null || j.division_id === divisionId);
}

/** 연도 목록(내림차순) — 연도 탭용. */
export function editionYears(editions: JnjEdition[]): number[] {
  return [...new Set(editions.map((e) => e.year))].sort((a, b) => b - a);
}

// ── 전 라운드 성적 (표시용) ─────────────────────────────────
/** 표시 순서 — 결승 → 본선 → 예선 (최종 결과부터 보여준다). */
export const ROUND_ORDER: JnjRound[] = ['final', 'semi', 'prelim'];

export interface RoundGroup {
  round: JnjRound;
  /** 역할별 표. 그 역할 기록이 없으면 아예 빠진다. */
  roles: { role: 'leader' | 'follower'; rows: JnjScore[] }[];
}

/** 한 부문의 성적 → 라운드별 → 역할별 표(가져온 정렬 순서 유지). */
export function groupScores(scores: JnjScore[]): RoundGroup[] {
  return ROUND_ORDER.map((round) => {
    const rows = scores.filter((s) => s.round === round);
    return {
      round,
      roles: (['leader', 'follower'] as const)
        .map((role) => ({
          role,
          rows: rows
            .filter((r) => r.role === role)
            .sort((a, b) => a.sort_order - b.sort_order || a.entry_no.localeCompare(b.entry_no)),
        }))
        .filter((g) => g.rows.length > 0),
    };
  }).filter((g) => g.roles.length > 0);
}
