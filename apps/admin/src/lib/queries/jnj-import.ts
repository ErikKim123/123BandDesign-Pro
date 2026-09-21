// J&J Dash(대회 채점 앱) → 123Band 우승자관리 가져오기.
//
// 두 서비스가 같은 Supabase 프로젝트를 쓰기 때문에 별도 API 없이 테이블을 바로 읽는다.
//   contests      : 대회 마스터. final_status='result' = 결승 결과 확정(= 가져올 수 있는 상태)
//   final_results : 결승 결과. role(leader|follower) 별 final_rank. 동점은 같은 rank 를 허용한다.
//   participants  : 참가자 명단. 결과 행에 사진/이름이 비었을 때의 폴백 + 국가(representative).
// 셋 다 표출 화면용으로 anon SELECT 가 열려 있어 어드민 anon 클라이언트로 그대로 읽힌다.
//
// 쓰기는 123Band 쪽 jnj_winners 로만 한다 — J&J Dash 데이터는 건드리지 않는다.
'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { toCountryCode } from '@/lib/jnj/country';

/**
 * 가져올 대시보드. 셋 다 같은 Supabase 프로젝트를 쓰고 스키마만 다르다(J&J 는 public).
 * BATTLE·DIV 는 대회 아래 '부문(divisions)' 이 또 있어 참가자가 부문별로 나뉜다 — J&J 는 대회=부문이다.
 */
export type DashSource = 'jnj' | 'battle' | 'div';

export const DASH_SOURCES: { value: DashSource; label: string }[] = [
  { value: 'jnj', label: 'J&J Dash' },
  { value: 'battle', label: 'BATTLE Dash' },
  { value: 'div', label: 'DIV Dash' },
];

/**
 * 소스별 클라이언트 — J&J 는 public, BATTLE·DIV 는 각자의 스키마.
 * 기본 클라이언트는 123Band 스키마(band123)를 보므로 J&J 도 public 을 명시해야 한다.
 */
export function dashClient(source: DashSource) {
  const supabase = createClient();
  // 클라이언트 타입에는 band123 스키마만 잡혀 있다. 대시보드 스키마들은 PostgREST 에 노출돼 있어
  // 호출은 되지만 타입이 막으므로 여기서만 캐스팅한다.
  return (supabase as unknown as { schema: (name: string) => typeof supabase }).schema(
    source === 'jnj' ? 'public' : source,
  );
}

/**
 * 가져올 대상 한 벌. J&J 는 대회가 곧 부문이고, BATTLE·DIV 는 대회 아래 부문이 대상이다.
 * 아래 조회들은 이 한 쌍만 받아 각자 알맞은 열(contest_id · division_id)로 거른다.
 */
export interface DashTarget {
  source: DashSource;
  contestId: string | null;
  /** BATTLE·DIV 에서만 쓴다. */
  divisionId?: string | null;
}

/** 이 대상으로 조회할 수 있는가 — BATTLE·DIV 는 부문까지 골라야 한다. */
function targetReady(t: DashTarget): boolean {
  return !!t.contestId && (t.source === 'jnj' || !!t.divisionId);
}

/** 대상에 맞는 필터 한 줄. 결과·심사위원·참가자 테이블이 모두 같은 규칙을 쓴다. */
function byTarget<T extends { eq: (col: string, v: string) => T }>(q: T, t: DashTarget): T {
  return t.source === 'jnj' ? q.eq('contest_id', t.contestId!) : q.eq('division_id', t.divisionId!);
}

/** 대시보드 안의 부문 — BATTLE·DIV 전용. */
export interface DashDivision {
  id: string;
  name: string;
}

/** 선택한 대회의 부문 목록(BATTLE·DIV). J&J 는 부문 개념이 없어 빈 배열. */
export function useDashDivisions(source: DashSource, contestId: string | null) {
  return useQuery({
    queryKey: ['dash', source, 'divisions', contestId],
    enabled: source !== 'jnj' && !!contestId,
    queryFn: async (): Promise<DashDivision[]> => {
      const { data, error } = await dashClient(source)
        .from('divisions')
        .select('id, name, display_order')
        .eq('contest_id', contestId)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return ((data ?? []) as { id: string; name: string }[]).map((d) => ({ id: d.id, name: d.name }));
    },
  });
}

/** 결승 라운드가 이 상태일 때만 가져오기 대상이 된다. */
const RESULT_STATUS = 'result';
/**
 * 시상대(우승자관리)는 1~3위까지만 다룬다.
 * 4위 이하를 포함한 전 라운드 성적표는 별도 화면(J&J 점수관리 · jnj_scores, 0074)이 맡는다.
 */
const PODIUM_RANK = 3;

/**
 * 사진 없는 우승자에 대신 넣는 'NO IMAGE' 플레이스홀더.
 * jnj 버킷의 고정 경로 — 어드민 업로드 경로(`${행ID}/${ts}.png`)는 특정 행에 묶여서
 * 상수로 쓸 수 없다. 프로젝트가 바뀌어도 따라가도록 환경변수로 조립한다.
 */
export const NO_IMAGE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/band123-jnj/_placeholder/no-image.png`;

export interface JnjDashContest {
  id: string;
  name: string;
  periodStart: string | null;
  periodEnd: string | null;
  /** J&J Dash 에서 보관 처리된 대회 — 목록에 남기되 '보관됨'으로 표시한다. */
  archived: boolean;
}

export interface JnjImportEntry {
  /** 체크박스 식별용 — 역할+참가번호. */
  key: string;
  role: 'leader' | 'follower';
  rank: number;
  num: string;
  name: string;
  /** ISO2 로 바뀐 국가. 못 알아본 값은 null 이고 원문은 countryRaw 로 보여준다. */
  country: string | null;
  countryRaw: string;
  photoUrl: string;
  /** 표시용 점수 문자열(총점 · 평균). */
  score: string;
  /** 저장용 점수 — 고객몰 카드·전체 결과 표에 그대로 실린다(0073). */
  totalScore: number | null;
  avgScore: number | null;
}

/** Google Drive 공유 링크는 hotlink 가 막혀 lh3 CDN 으로 바꿔야 고객몰에서 뜬다(J&J Dash 와 같은 규칙). */
function normalizePhotoUrl(raw: string | null | undefined): string {
  const v = (raw ?? '').trim();
  if (!v) return '';
  if (v.includes('drive.google.com')) {
    const m = v.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ?? v.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m) return 'https://lh3.googleusercontent.com/d/' + m[1];
  }
  return /^https?:\/\//i.test(v) ? v : '';
}

/**
 * J&J Dash 표에 찍히는 '최종(가중)' 점수.
 *
 * final_results.total_score 는 심사위원 전원 × 항목 전부의 합계(raw)라 심사위원 수에 따라
 * 자릿수가 달라진다(같은 9점대 연기가 148 이 되기도 372 가 되기도 한다).
 * 대시보드가 보여주는 값은 '항목 평균 × 항목 수' = 심사위원 1인분 점수이고, 고객몰도 이 값을 써야
 * 어드민 화면과 숫자가 같다. 평균이 없으면(옛 데이터) raw 합계를 그대로 쓴다.
 */
function weightedTotal(total: number | null, average: number | null, itemCount: number): number | null {
  if (average != null && itemCount > 0) return Number((average * itemCount).toFixed(2));
  return total;
}

/**
 * 대회의 채점 항목 코드 목록(contests.scoring_items) — 대회마다 다르다.
 * '최종(가중)' 환산의 항목 수이자, 결승 채점 상세(criteria)의 열 순서다.
 * 못 읽으면 빈 배열(= 환산 없이 raw 사용 · 상세 없음).
 */
async function scoringItems(
  supabase: ReturnType<typeof createClient>,
  target: DashTarget,
): Promise<string[]> {
  // 채점 항목이 붙어 있는 곳이 다르다 — J&J 는 대회, BATTLE·DIV 는 부문.
  const { data } =
    target.source === 'jnj'
      ? await dashClient('jnj').from('contests').select('scoring_items').eq('id', target.contestId!).maybeSingle()
      : await dashClient(target.source)
          .from('divisions')
          .select('scoring_items')
          .eq('id', target.divisionId!)
          .maybeSingle();
  const items = (data as { scoring_items?: unknown } | null)?.scoring_items;
  return Array.isArray(items) ? items.filter((v): v is string => typeof v === 'string') : [];
}

// ── 결승 채점 항목 점수 (심사위원 × 항목) ────────────────────────────────────
// 총점만 옮기면 '왜 저 순위인가'가 J&J Dash 안에만 남는다. 결승 채점 화면이 보여주는 표를
// 그대로 성적 한 줄에 붙여 고객몰에서 펼쳐 볼 수 있게 한다(0084).

/**
 * 성적 1줄에 붙는 채점 상세. items 와 scores 는 같은 순서·같은 길이다.
 *
 * 심사위원 이름을 함께 담는다 — 심사 결과를 실명으로 공개하는 것이 이 대회의 방침이다.
 * jnj_scores 는 비로그인도 읽을 수 있으므로(RLS 공개 읽기) '누가 누구에게 몇 점'이 공개
 * API 로도 그대로 나간다는 뜻이다. 심사위원 명단(jnj_judges)은 이미 공개이고, 여기서
 * 더해지는 것은 '어느 자리가 누구인가' 다.
 *
 * 이름이 비어 있으면 화면은 예전처럼 '심사위원 1·2·3' 으로 떨어진다(이름을 싣기 전에
 * 가져온 옛 성적). 어느 쪽이든 순서(심사위원 표시 순번)는 지켜서 같은 자리가 표마다 같은
 * 사람을 가리킨다 — 채점을 아예 건너뛴 심사위원이 있으면 그 줄만 빠진다.
 */
export interface JnjScoreCriteria {
  /** 채점 항목 코드(contests.scoring_items) — 화면 열 순서. */
  items: string[];
  /** 심사위원별 점수 한 줄(표시 순번 순). 안 매긴 항목은 null. */
  judges: { name?: string; scores: (number | null)[] }[];
}

/**
 * 채점 항목 코드 → judge_votes 의 점수 컬럼.
 * J&J Dash 는 항목 이름(scoring_items)과 컬럼 이름이 따로 굳어 있어(fundamentals ↔ basic_score)
 * 표를 세우려면 이 대응표가 필요하다. 여기 없는 코드는 그냥 빈 열이 된다 — 새 항목이 생겨도
 * 가져오기가 깨지지는 않는다.
 */
const CRITERIA_COLUMN: Record<string, string> = {
  fundamentals: 'basic_score',
  basics: 'basic_score',
  connection: 'connectivity_score',
  connectivity: 'connectivity_score',
  musicality: 'musicality_score',
  creativity: 'creativity_score',
  crowd_reaction: 'crowd_reaction_score',
  showmanship: 'showmanship_score',
  techniques: 'techniques_score',
  technique: 'techniques_score',
  audience_impact: 'audience_impact_score',
};

interface JudgeVoteRow {
  judge_id: string;
  participant_num: string;
  [column: string]: unknown;
}

/**
 * 선택한 대회의 결승 채점 상세 — 참가번호 → 심사위원별 항목 점수.
 *
 * judge_votes 에는 대회 id 가 없다(심사위원에 딸려 있다). 그래서 결승 심사위원 id 를 먼저
 * 뽑고 그 id 로만 투표를 읽는다 — 예선·본선 심사위원은 다른 행이라 자연히 걸러진다.
 * 한 항목도 안 매긴 심사위원은 표에서 뺀다(빈 줄만 늘어난다).
 * 못 읽거나 항목이 없으면 빈 맵 — 상세 없이 총점만 들어간다.
 * 이름은 표시 순번과 함께 남긴다(JnjScoreCriteria 주석) — 화면이 실명으로 표를 세운다.
 */
async function finalCriteria(
  supabase: ReturnType<typeof createClient>,
  target: DashTarget,
  items: string[],
): Promise<Map<string, JnjScoreCriteria>> {
  const out = new Map<string, JnjScoreCriteria>();
  if (items.length === 0) return out;

  // BATTLE·DIV 의 심사위원은 라운드로 나뉘지 않는다(judges.round 열 자체가 없다) —
  // 그 부문의 심사위원이 곧 결승 심사위원이다.
  let judgeQuery = byTarget(
    dashClient(target.source).from('judges').select('id, display_order, name'),
    target,
  );
  if (target.source === 'jnj') judgeQuery = judgeQuery.eq('round', 'final');
  const judges = await judgeQuery
    .order('display_order', { ascending: true });
  const panel = (judges.data ?? []) as { id: string; display_order: number; name: string | null }[];
  if (judges.error || panel.length === 0) return out;

  const columns = items.map((it) => CRITERIA_COLUMN[it] ?? null);
  const select = ['judge_id', 'participant_num', ...new Set(columns.filter(Boolean) as string[])];
  const votes = await dashClient(target.source)
    .from('judge_votes')
    .select(select.join(', '))
    .in(
      'judge_id',
      panel.map((j) => j.id),
    );
  if (votes.error) return out;

  const num = (v: unknown) => (v == null || v === '' ? null : Number(v));
  // 표시 순번으로 자리를 먼저 정해 두고 그 자리에 넣는다(투표 행이 오는 순서는 보장되지 않는다).
  const seat = new Map(panel.map((j, i) => [j.id, i]));
  // 자리 → 이름. 이름이 빈 심사위원은 그 줄만 번호로 떨어진다.
  const seatName = panel.map((j) => (j.name ?? '').trim());
  const rows = new Map<string, ((number | null)[] | null)[]>();
  for (const row of (votes.data ?? []) as unknown as JudgeVoteRow[]) {
    const at = seat.get(row.judge_id);
    if (at == null) continue;
    const scores = columns.map((c) => (c ? num(row[c]) : null));
    // 전부 비어 있으면 채점을 안 한 것 — 빈 줄을 만들지 않는다.
    if (scores.every((s) => s == null || Number.isNaN(s))) continue;
    const seats = rows.get(row.participant_num) ?? Array.from({ length: panel.length }, () => null);
    seats[at] = scores.map((s) => (s != null && Number.isFinite(s) ? s : null));
    rows.set(row.participant_num, seats);
  }
  for (const [participantNum, seats] of rows) {
    // 채점을 건너뛴 자리는 빼되, 남는 줄에는 그 자리의 이름이 그대로 따라가야 한다.
    const judges = seats
      .map((scores, at) => ({ scores, name: seatName[at] }))
      .filter((j): j is { scores: (number | null)[]; name: string } => j.scores !== null)
      .map(({ scores, name }) => (name ? { name, scores } : { scores }));
    if (judges.length > 0) out.set(participantNum, { items, judges });
  }
  return out;
}

/**
 * J&J Dash 대회 목록.
 * @param scope 'result' = 결승 결과가 확정된 것만(우승자 가져오기) · 'all' = 진행 중 포함 전부(심사위원 가져오기).
 *              심사위원은 결과와 무관하게 대회를 열 때부터 확정돼 있어서 상태로 걸러 두면 오히려 못 가져온다.
 */
export function useJnjDashContests(
  enabled = true,
  scope: 'result' | 'all' = 'result',
  source: DashSource = 'jnj',
) {
  return useQuery({
    queryKey: ['jnj_dash', 'contests', scope, source],
    enabled,
    queryFn: async (): Promise<JnjDashContest[]> => {
      // 보관(archived) 대회도 남긴다 — 끝난 대회를 보관 처리하는 운영 습관이 있어
      // 상태로 걸러내면 정작 가져와야 할 지난 대회가 목록에서 사라진다. 대신 '보관됨'으로 표시한다.
      let q = dashClient(source)
        .from('contests')
        .select('id, name, period_start, period_end, status');
      // final_status(결승 확정)는 J&J Dash 에만 있는 열이다 — BATTLE·DIV 는 부문마다 상태가 따로다.
      if (scope === 'result' && source === 'jnj') q = q.eq('final_status', RESULT_STATUS);
      const { data, error } = await q
        .order('period_start', { ascending: false })
        .order('id', { ascending: true });
      if (error) throw error;
      const rows = data as {
        id: string;
        name: string;
        period_start: string | null;
        period_end: string | null;
        status: string | null;
      }[];
      return rows.map((c) => ({
        id: c.id,
        name: c.name,
        periodStart: c.period_start,
        periodEnd: c.period_end,
        archived: c.status === 'archived',
      }));
    },
  });
}

interface FinalRow {
  participant_num: string;
  team_name: string | null;
  role: 'leader' | 'follower';
  final_rank: number;
  total_score: number | null;
  average: number | null;
  photo_url: string | null;
}

interface ParticipantRow {
  num: string;
  team_name: string | null;
  representative: string | null;
  /** BATTLE·DIV 전용 — ISO2 국가. J&J Dash 는 representative 에 국가명을 적는다. */
  country?: string | null;
  photo_url: string | null;
}

/** 참가자 조회 열 — BATTLE·DIV 만 country(ISO2) 열을 갖는다. */
function participantCols(source: DashSource): string {
  return source === 'jnj'
    ? 'num, team_name, representative, photo_url'
    : 'num, team_name, representative, country, photo_url';
}

/** 선택한 대회의 결승 1~3위(리더·팔로워 각각). 동점이면 같은 순위가 여러 명 나올 수 있다. */
export function useJnjDashPodium(
  contestId: string | null,
  source: DashSource = 'jnj',
  divisionId: string | null = null,
) {
  const target: DashTarget = { source, contestId, divisionId };
  return useQuery({
    queryKey: ['jnj_dash', 'podium', source, contestId, divisionId],
    enabled: targetReady(target),
    queryFn: async (): Promise<JnjImportEntry[]> => {
      const supabase = createClient();
      const db = dashClient(source);
      const [fin, parts, items] = await Promise.all([
        byTarget(
          db
            .from('final_results')
            .select('participant_num, team_name, role, final_rank, total_score, average, photo_url'),
          target,
        )
          .gte('final_rank', 1)
          .lte('final_rank', PODIUM_RANK)
          .order('role', { ascending: true })
          .order('final_rank', { ascending: true }),
        byTarget(db.from('participants').select(participantCols(source)), target),
        scoringItems(supabase, target),
      ]);
      const itemCount = items.length;
      if (fin.error) throw fin.error;
      // 참가자 명단은 폴백일 뿐이라 못 읽어도 결과만으로 진행한다.
      const byNum = new Map(((parts.data ?? []) as ParticipantRow[]).map((p) => [p.num, p]));

      return (fin.data as FinalRow[]).map((r) => {
        const p = byNum.get(r.participant_num);
        const countryRaw = ((p?.country ?? '') || (p?.representative ?? '')).trim();
        const total = weightedTotal(r.total_score, r.average, itemCount);
        const avg = r.average != null ? Number(Number(r.average).toFixed(2)) : null;
        const score = [
          total != null ? total.toFixed(2) : null,
          avg != null ? 'avg ' + avg.toFixed(2) : null,
        ]
          .filter(Boolean)
          .join(' · ');
        return {
          key: r.role + '-' + r.participant_num,
          role: r.role,
          rank: r.final_rank,
          num: r.participant_num,
          name: (r.team_name ?? '').trim() || (p?.team_name ?? '').trim() || r.participant_num,
          country: toCountryCode(countryRaw),
          countryRaw,
          photoUrl: normalizePhotoUrl(r.photo_url) || normalizePhotoUrl(p?.photo_url),
          score,
          totalScore: total,
          avgScore: avg,
        };
      });
    },
  });
}

export interface JnjTargetDivision {
  id: string;
  /** 부문 종류(0110) — 가져올 대시보드와 같은 종류만 고를 수 있게 거른다. */
  kind: string;
  editionId: string;
  code: string;
  label: string;
}

/** 대회(에디션)별 부문 목록 — 가져올 대상 부문 선택에 쓴다. 값은 jnj_winners.division 과 같은 code. */
export function useJnjTargetDivisions() {
  return useQuery({
    queryKey: ['jnj_divisions', 'targets'],
    queryFn: async (): Promise<JnjTargetDivision[]> => {
      const { data, error } = await createClient()
        .from('jnj_divisions')
        .select('id, edition_id, kind, code, title_i18n, sort_order')
        .order('sort_order', { ascending: true });
      // 0053 미적용 환경 — 부문 행이 없으면 화면이 기본 부문(DIVISION_OPTS)으로 폴백한다.
      if (error) return [];
      const rows = data as {
        id: string;
        edition_id: string;
        kind?: string;
        code: string;
        title_i18n: { en?: string; ko?: string } | null;
      }[];
      return rows.map((d) => ({
        id: d.id,
        editionId: d.edition_id,
        // 0110 미적용 환경에서도 화면이 죽지 않게 — 종류가 없으면 J&J 로 본다.
        kind: d.kind ?? 'jnj',
        code: d.code,
        label: d.title_i18n?.en || d.title_i18n?.ko || d.code,
      }));
    },
  });
}

/** 대상 대회·부문에 이미 등록된 1~3위 개수 — 덮어쓰기 안내에 쓴다. */
export function useExistingWinnerCount(editionId: string, division: string) {
  return useQuery({
    queryKey: ['jnj_winners', 'existing', editionId, division],
    enabled: !!editionId && !!division,
    queryFn: async (): Promise<number> => {
      const { count, error } = await createClient()
        .from('jnj_winners')
        .select('id', { count: 'exact', head: true })
        .eq('edition_id', editionId)
        .eq('division', division)
        .in('role', ['leader', 'follower'])
        .lte('rank', PODIUM_RANK);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export interface ImportWinnersArgs {
  editionId: string;
  division: string;
  entries: JnjImportEntry[];
  /** 같은 대회·부문의 기존 리더/팔로워 1~3위를 지우고 새로 넣는다. */
  replace: boolean;
}

/** 선택한 결과를 jnj_winners 로 넣는다. 리더/팔로워는 각각 별도 시상대로 들어간다. */
export function useImportJnjWinners() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ editionId, division, entries, replace }: ImportWinnersArgs) => {
      const supabase = createClient();
      let removed = 0;
      if (replace) {
        const { data, error } = await supabase
          .from('jnj_winners')
          .delete()
          .eq('edition_id', editionId)
          .eq('division', division)
          .in('role', ['leader', 'follower'])
          .lte('rank', PODIUM_RANK)
          .select('id');
        if (error) throw error;
        removed = (data as { id: string }[] | null)?.length ?? 0;
      }
      const rows = entries.map((e) => ({
        edition_id: editionId,
        division,
        role: e.role,
        rank: e.rank,
        entry_no: e.num,
        total_score: e.totalScore,
        avg_score: e.avgScore,
        name: e.name,
        country: e.country,
        // 사진이 없으면 빈 칸 대신 NO IMAGE 플레이스홀더 — 시상대에 이름만 덜렁 남지 않게 한다.
        // 나중에 실제 사진이 생기면 우승자 폼에서 그대로 갈아 끼우면 된다.
        photo_url: e.photoUrl || NO_IMAGE_URL,
        is_active: true,
      }));
      const { data, error } = await supabase.from('jnj_winners').insert(rows).select('id');
      if (error) throw error;
      return { inserted: (data as { id: string }[] | null)?.length ?? 0, removed };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jnj_winners'] });
    },
  });
}

// ── 심사위원 ────────────────────────────────────────────────────────────────
// J&J Dash 의 judges 는 라운드(예선/본선/결승)마다 한 줄씩 있고, 같은 display_order 의
// 세 줄은 프로필(이름·사진·소속)이 항상 같은 값으로 미러링된다. 그래서 display_order 로 접어
// '사람 한 명 = 한 줄' 로 만든 뒤 가져온다.

/** J&J Dash 는 언어 구분 없이 한 칸에 적는다 — 한글이 섞여 있으면 KO, 아니면 EN 으로 본다. */
function isKorean(v: string): boolean {
  return /[가-힣]/.test(v);
}

export interface JnjJudgeEntry {
  /** 체크박스 식별용 — J&J Dash 의 표시 순번. */
  key: string;
  order: number;
  name: string;
  /** 직함(EN/KO). 헤드 심사위원만 두 언어를 채우고, 그 외에는 소속(alias)을 EN 에 넣는다. */
  titleEn: string;
  titleKo: string;
  /** alias 가 국가명이면 직함 대신 국가로 넣는다(J&J Dash 표출 카드도 alias 를 국가 칸으로 쓴다). */
  country: string | null;
  bio: string;
  photoUrl: string;
  isHead: boolean;
}

interface JudgeRow {
  display_order: number;
  name: string;
  alias: string | null;
  /** BATTLE·DIV 전용 — ISO2 국가. */
  country?: string | null;
  specialty: string | null;
  career: string | null;
  photo_url: string | null;
  /** J&J Dash 전용 — BATTLE·DIV 에는 심사위원장 구분이 없다. */
  is_head?: boolean;
}

/** 선택한 대회의 심사위원 명단(라운드 중복 제거, 표시 순번 오름차순). */
export function useJnjDashJudges(
  contestId: string | null,
  source: DashSource = 'jnj',
  divisionId: string | null = null,
) {
  const target: DashTarget = { source, contestId, divisionId };
  return useQuery({
    queryKey: ['jnj_dash', 'judges', source, contestId, divisionId],
    enabled: targetReady(target),
    queryFn: async (): Promise<JnjJudgeEntry[]> => {
      // is_head(심사위원장)·country 는 대시보드마다 있고 없고가 다르다 — 있는 것만 읽는다.
      const cols =
        source === 'jnj'
          ? 'display_order, name, alias, specialty, career, photo_url, is_head'
          : 'display_order, name, alias, specialty, career, photo_url, country';
      const { data, error } = await byTarget(
        dashClient(source).from('judges').select(cols),
        target,
      ).order('display_order', { ascending: true });
      if (error) throw error;

      const byOrder = new Map<number, JnjJudgeEntry>();
      for (const r of (data ?? []) as JudgeRow[]) {
        if (byOrder.has(r.display_order)) continue; // 라운드별 중복 — 첫 줄만 쓴다.
        const alias = (r.alias ?? '').trim();
        const specialty = (r.specialty ?? '').trim();
        // BATTLE·DIV 는 country(ISO2) 열이 따로 있다. J&J Dash 는 alias 가 'Korea' 처럼
        // 국가명이면 직함이 아니라 국가로 본다.
        const country = (r.country ?? '').trim() || toCountryCode(alias);
        const label = country ? '' : alias || specialty;
        const labelIsKo = isKorean(label);
        const isHead = r.is_head === true;
        byOrder.set(r.display_order, {
          key: String(r.display_order),
          order: r.display_order,
          name: (r.name ?? '').trim(),
          titleEn: isHead ? 'Head Judge' : labelIsKo ? '' : label,
          titleKo: isHead ? '심사위원장' : labelIsKo ? label : '',
          country,
          bio: (r.career ?? '').trim(),
          photoUrl: normalizePhotoUrl(r.photo_url),
          isHead,
        });
      }
      return [...byOrder.values()].sort((a, b) => a.order - b.order);
    },
  });
}

/**
 * 대상 대회·부문에 이미 등록된 심사위원 수.
 * @param divisionId 빈 문자열이면 '전 부문 공통'(division_id IS NULL) 범위를 센다.
 */
export function useExistingJudgeCount(editionId: string, divisionId: string) {
  return useQuery({
    queryKey: ['jnj_judges', 'existing', editionId, divisionId],
    enabled: !!editionId,
    queryFn: async (): Promise<number> => {
      let q = createClient()
        .from('jnj_judges')
        .select('id', { count: 'exact', head: true })
        .eq('edition_id', editionId);
      q = divisionId ? q.eq('division_id', divisionId) : q.is('division_id', null);
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export interface ImportJudgesArgs {
  editionId: string;
  /** 빈 문자열 = 전 부문 공통(division_id NULL). */
  divisionId: string;
  entries: JnjJudgeEntry[];
  /** 같은 대회·부문 범위의 기존 심사위원을 지우고 새로 넣는다. */
  replace: boolean;
}

/** 선택한 심사위원을 jnj_judges 로 넣는다. */
export function useImportJnjJudges() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ editionId, divisionId, entries, replace }: ImportJudgesArgs) => {
      const supabase = createClient();
      let removed = 0;
      if (replace) {
        let del = supabase.from('jnj_judges').delete().eq('edition_id', editionId);
        del = divisionId ? del.eq('division_id', divisionId) : del.is('division_id', null);
        const { data, error } = await del.select('id');
        if (error) throw error;
        removed = (data as { id: string }[] | null)?.length ?? 0;
      }
      // i18n 필드는 아는 언어만 채운다 — 비운 쪽은 화면에서 반대 언어로 폴백된다.
      const i18n = (en: string, ko: string) => {
        const v: Record<string, string> = {};
        if (en) v.en = en;
        if (ko) v.ko = ko;
        return v;
      };
      const rows = entries.map((e) => ({
        edition_id: editionId,
        division_id: divisionId || null,
        name: e.name,
        title_i18n: i18n(e.titleEn, e.titleKo),
        country: e.country,
        photo_url: e.photoUrl || null,
        bio_i18n: isKorean(e.bio) ? i18n('', e.bio) : i18n(e.bio, ''),
        sort_order: e.order,
        is_active: true,
      }));
      const { data, error } = await supabase.from('jnj_judges').insert(rows).select('id');
      if (error) throw error;
      return { inserted: (data as { id: string }[] | null)?.length ?? 0, removed };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jnj_judges'] });
    },
  });
}

// ── 전 라운드 성적표 (J&J 점수관리) ───────────────────────────────────────────
// 라운드마다 점수 체계가 다르다:
//   · 예선(prelim) · 본선(semi) : qualifiers — 심사위원 O표 수(votes) + 통과 여부(passed)
//   · 결승(final)               : final_results — 순위 + 최종(가중) 총점 + 평균
// 셋을 한 모양(JnjScoreEntry)으로 접어 jnj_scores(0074) 한 테이블에 넣는다.

export type JnjRound = 'prelim' | 'semi' | 'final';

/** 라운드 표시 순서 — 화면·정렬 모두 이 순서를 따른다. */
export const ROUND_ORDER: JnjRound[] = ['prelim', 'semi', 'final'];

export interface JnjScoreEntry {
  /** 라운드+역할+참가번호 — 미리보기 체크 식별용. */
  key: string;
  round: JnjRound;
  role: 'leader' | 'follower';
  entryNo: string;
  name: string;
  country: string | null;
  countryRaw: string;
  /** 참가자 사진(J&J Dash). 없으면 빈 문자열. */
  photoUrl: string;
  /** 예선·본선 */
  votes: number | null;
  passed: boolean | null;
  /** 결승 */
  rank: number | null;
  totalScore: number | null;
  avgScore: number | null;
  /** 결승 채점 상세(심사위원 × 항목, 0084). 예선·본선과 채점 기록이 없는 대회는 null. */
  criteria: JnjScoreCriteria | null;
  /** 표 안 정렬(결승=순위, 예선·본선=O표 내림차순). */
  sortOrder: number;
}

interface QualifierRow {
  round: 'prelim' | 'semi';
  participant_num: string;
  team_name: string | null;
  representative: string | null;
  role: 'leader' | 'follower';
  passed: boolean | null;
  votes: number | null;
  photo_url: string | null;
}

/**
 * 선택한 대회의 예선·본선·결승 성적 전체.
 * 라운드가 아직 안 끝난 대회면 그 라운드는 그냥 빠진다(빈 배열).
 */
export function useJnjDashRoundResults(
  contestId: string | null,
  source: DashSource = 'jnj',
  divisionId: string | null = null,
) {
  const target: DashTarget = { source, contestId, divisionId };
  return useQuery({
    queryKey: ['jnj_dash', 'rounds', source, contestId, divisionId],
    enabled: targetReady(target),
    queryFn: async (): Promise<JnjScoreEntry[]> => {
      const supabase = createClient();
      const db = dashClient(source);
      const items = await scoringItems(supabase, target);
      const [qual, fin, parts, criteria] = await Promise.all([
        // 예선·본선(qualifiers)은 J&J Dash 에만 있다 — BATTLE·DIV 는 결승 결과만 남긴다.
        source === 'jnj'
          ? db
              .from('qualifiers')
              .select('round, participant_num, team_name, representative, role, passed, votes, photo_url')
              .eq('contest_id', contestId!)
          : Promise.resolve({ data: [], error: null }),
        byTarget(
          db
            .from('final_results')
            .select('participant_num, team_name, role, final_rank, total_score, average, photo_url'),
          target,
        ),
        byTarget(db.from('participants').select(participantCols(source)), target),
        finalCriteria(supabase, target, items),
      ]);
      const itemCount = items.length;
      // 라운드 하나가 비어 있는(아직 안 치른) 대회도 있으므로 개별 실패는 그 라운드만 건너뛴다.
      const byNum = new Map(((parts.data ?? []) as ParticipantRow[]).map((p) => [p.num, p]));

      const rows: Omit<JnjScoreEntry, 'sortOrder'>[] = [];
      for (const q of (qual.data ?? []) as QualifierRow[]) {
        const p = byNum.get(q.participant_num);
        const countryRaw = (q.representative ?? p?.representative ?? '').trim();
        rows.push({
          key: `${q.round}-${q.role}-${q.participant_num}`,
          round: q.round,
          role: q.role,
          entryNo: q.participant_num,
          name: (q.team_name ?? '').trim() || (p?.team_name ?? '').trim() || q.participant_num,
          country: toCountryCode(countryRaw),
          countryRaw,
          photoUrl: normalizePhotoUrl(q.photo_url) || normalizePhotoUrl(p?.photo_url),
          votes: q.votes,
          passed: q.passed,
          rank: null,
          totalScore: null,
          avgScore: null,
          criteria: null,
        });
      }
      for (const r of (fin.data ?? []) as FinalRow[]) {
        const p = byNum.get(r.participant_num);
        const countryRaw = ((p?.country ?? '') || (p?.representative ?? '')).trim();
        rows.push({
          key: `final-${r.role}-${r.participant_num}`,
          round: 'final',
          role: r.role,
          entryNo: r.participant_num,
          name: (r.team_name ?? '').trim() || (p?.team_name ?? '').trim() || r.participant_num,
          country: toCountryCode(countryRaw),
          countryRaw,
          photoUrl: normalizePhotoUrl(r.photo_url) || normalizePhotoUrl(p?.photo_url),
          votes: null,
          passed: null,
          rank: r.final_rank,
          totalScore: weightedTotal(r.total_score, r.average, itemCount),
          avgScore: r.average != null ? Number(Number(r.average).toFixed(2)) : null,
          criteria: criteria.get(r.participant_num) ?? null,
        });
      }

      // 라운드 → 역할 → (결승=순위 / 예선·본선=O표 내림차순) 으로 정렬하고 그 순서를 sort_order 로 굳힌다.
      rows.sort((a, b) => {
        const byRound = ROUND_ORDER.indexOf(a.round) - ROUND_ORDER.indexOf(b.round);
        if (byRound) return byRound;
        if (a.role !== b.role) return a.role === 'leader' ? -1 : 1;
        if (a.round === 'final') return (a.rank ?? 99) - (b.rank ?? 99);
        return (b.votes ?? -1) - (a.votes ?? -1) || a.entryNo.localeCompare(b.entryNo);
      });
      const seq = new Map<string, number>();
      return rows.map((r) => {
        const k = `${r.round}-${r.role}`;
        const n = (seq.get(k) ?? 0) + 1;
        seq.set(k, n);
        return { ...r, sortOrder: n };
      });
    },
  });
}

/** 대상 대회·부문에 이미 등록된 성적 건수 — 덮어쓰기 안내에 쓴다. */
export function useExistingScoreCount(editionId: string, division: string) {
  return useQuery({
    queryKey: ['jnj_scores', 'existing', editionId, division],
    enabled: !!editionId && !!division,
    queryFn: async (): Promise<number> => {
      const { count, error } = await createClient()
        .from('jnj_scores')
        .select('id', { count: 'exact', head: true })
        .eq('edition_id', editionId)
        .eq('division', division);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export interface ImportScoresArgs {
  editionId: string;
  division: string;
  entries: JnjScoreEntry[];
  /** 같은 대회·부문의 기존 성적을 (가져오는 라운드만) 지우고 새로 넣는다. */
  replace: boolean;
}

/** 선택한 성적을 jnj_scores 로 넣는다. 덮어쓰기는 가져오는 라운드에만 적용된다. */
export function useImportJnjScores() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ editionId, division, entries, replace }: ImportScoresArgs) => {
      const supabase = createClient();
      let removed = 0;
      const rounds = [...new Set(entries.map((e) => e.round))];
      if (replace && rounds.length) {
        const { data, error } = await supabase
          .from('jnj_scores')
          .delete()
          .eq('edition_id', editionId)
          .eq('division', division)
          .in('round', rounds)
          .select('id');
        if (error) throw error;
        removed = (data as { id: string }[] | null)?.length ?? 0;
      }
      const rows = entries.map((e) => ({
        edition_id: editionId,
        division,
        round: e.round,
        role: e.role,
        entry_no: e.entryNo,
        name: e.name,
        country: e.country,
        photo_url: e.photoUrl || null,
        votes: e.votes,
        passed: e.passed,
        rank: e.rank,
        total_score: e.totalScore,
        avg_score: e.avgScore,
        criteria: e.criteria,
        sort_order: e.sortOrder,
        is_active: true,
      }));
      let { data, error } = await supabase.from('jnj_scores').insert(rows).select('id');
      // 0084 미적용 환경 — 채점 상세 칸만 빼고 다시 넣는다. 성적을 통째로 못 넣는 것보다 낫다.
      if (error && /criteria/.test(error.message ?? '')) {
        const plain = rows.map(({ criteria: _criteria, ...rest }) => rest);
        ({ data, error } = await supabase.from('jnj_scores').insert(plain).select('id'));
      }
      if (error) throw error;
      return { inserted: (data as { id: string }[] | null)?.length ?? 0, removed };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jnj_scores'] });
    },
  });
}

// ── 참가자 명단 (J&J 참가자관리) ─────────────────────────────────────────────
// 성적과 무관하게 '누가 나왔나'를 담는다. 예선 탈락자도 남는다.
// 개인정보 주의: participants.meta 에는 연락처·이메일도 들어 있지만 공개 화면에 필요한
// 값(이름·국가·사진·SNS 핸들)만 옮긴다.

export interface JnjParticipantEntry {
  key: string;
  role: 'leader' | 'follower';
  entryNo: string;
  name: string;
  country: string | null;
  countryRaw: string;
  photoUrl: string;
  /** 참가신청서의 SNS 핸들(meta.X). 인스타 주소로 이어진다. */
  instagram: string;
  sortOrder: number;
}

interface ParticipantFullRow extends ParticipantRow {
  role: 'leader' | 'follower' | 'helper_leader' | 'helper_follower';
  meta: Record<string, unknown> | null;
  /** BATTLE·DIV 전용 — ISO2 국가. J&J Dash 에는 없는 열이라 undefined. */
  country?: string | null;
}

/** 참가신청서에서 SNS 핸들을 꺼낸다 — 시트 헤더가 'X'/'SNS'/'인스타' 등으로 제각각이다. */
function snsHandle(meta: Record<string, unknown> | null): string {
  if (!meta) return '';
  for (const key of ['X', 'x', 'SNS', 'sns', 'instagram', 'Instagram', '인스타', '인스타그램']) {
    const v = meta[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

/**
 * 선택한 대회의 참가자 전체(진행 요원 helper_* 제외). 참가번호 순.
 * BATTLE·DIV 는 대회 아래 부문까지 골라야 한 부문의 명단이 나온다.
 */
export function useJnjDashParticipants(
  contestId: string | null,
  source: DashSource = 'jnj',
  divisionId: string | null = null,
) {
  return useQuery({
    queryKey: ['jnj_dash', 'participants', source, contestId, divisionId],
    enabled: !!contestId && (source === 'jnj' || !!divisionId),
    queryFn: async (): Promise<JnjParticipantEntry[]> => {
      // BATTLE·DIV 는 참가자가 대회가 아니라 부문에 매달려 있다(participants.contest_id 가 없다).
      // J&J Dash 는 반대로 부문이 없어 대회로 거른다.
      // 국가를 어디서 읽는지가 대시보드마다 다르다.
      //   J&J Dash : representative 에 국가명을 적는다(전용 열이 없다).
      //   BATTLE·DIV : country(ISO2) 열이 따로 있고, representative 는 대표자 이름이다.
      const cols = `${participantCols(source)}, role, meta`;
      let q = dashClient(source).from('participants').select(cols).in('role', ['leader', 'follower']);
      q = source === 'jnj' ? q.eq('contest_id', contestId) : q.eq('division_id', divisionId);
      const { data, error } = await q.order('num', { ascending: true });
      if (error) throw error;
      return ((data ?? []) as ParticipantFullRow[]).map((p, i) => {
        // BATTLE·DIV 는 country(ISO2)가 원본이고, 없으면 J&J 와 같은 규칙(representative)으로 되돌아간다.
        const countryRaw = ((p.country ?? '') || (p.representative ?? '')).trim();
        return {
          key: `${p.role}-${p.num}`,
          role: p.role as 'leader' | 'follower',
          entryNo: p.num,
          name: (p.team_name ?? '').trim() || p.num,
          country: toCountryCode(countryRaw),
          countryRaw,
          photoUrl: normalizePhotoUrl(p.photo_url),
          instagram: snsHandle(p.meta),
          sortOrder: i + 1,
        };
      });
    },
  });
}

/** 대상 대회·부문에 이미 등록된 참가자 수 — 덮어쓰기 안내에 쓴다. */
export function useExistingParticipantCount(editionId: string, division: string) {
  return useQuery({
    queryKey: ['jnj_participants', 'existing', editionId, division],
    enabled: !!editionId && !!division,
    queryFn: async (): Promise<number> => {
      const { count, error } = await createClient()
        .from('jnj_participants')
        .select('id', { count: 'exact', head: true })
        .eq('edition_id', editionId)
        .eq('division', division);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export interface ImportParticipantsArgs {
  editionId: string;
  division: string;
  entries: JnjParticipantEntry[];
  /** 같은 대회·부문의 기존 명단을 지우고 새로 넣는다. */
  replace: boolean;
}

/** 선택한 참가자를 jnj_participants 로 넣는다. */
export function useImportJnjParticipants() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ editionId, division, entries, replace }: ImportParticipantsArgs) => {
      const supabase = createClient();
      let removed = 0;
      if (replace) {
        const { data, error } = await supabase
          .from('jnj_participants')
          .delete()
          .eq('edition_id', editionId)
          .eq('division', division)
          .select('id');
        if (error) throw error;
        removed = (data as { id: string }[] | null)?.length ?? 0;
      }
      const rows = entries.map((e) => ({
        edition_id: editionId,
        division,
        role: e.role,
        entry_no: e.entryNo,
        name: e.name,
        country: e.country,
        photo_url: e.photoUrl || null,
        instagram: e.instagram || null,
        sort_order: e.sortOrder,
        is_active: true,
      }));
      const { data, error } = await supabase.from('jnj_participants').insert(rows).select('id');
      if (error) throw error;
      return { inserted: (data as { id: string }[] | null)?.length ?? 0, removed };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jnj_participants'] });
    },
  });
}
