// Design Ref: 회원활동 — 일반회원의 아바타 + 전 활동을 한 화면에서 본다.
// 데이터 출처는 마이그레이션 0066 의 뷰 2종(anon 클라이언트 + RLS + is_admin() 가드):
//   admin_member_activity_v : 회원 1행 = 아바타 + 활동 집계 (아바타 갤러리 탭)
//   admin_activity_feed_v   : 활동 1행 = 원장/하트/주문/후기/… 통합 타임라인 (활동 피드 탭)
// 뷰에서 이미 합쳐 내려오므로 화면은 목록 쿼리 하나만 쓴다 — 테이블 10개를 각각 부르지 않는다.
'use client';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

/** 피드에 실리는 활동 종류 — 뷰의 kind 값과 1:1. */
export const ACTIVITY_KINDS = [
  'point',
  'stamp',
  'heart_in',
  'heart_out',
  'order',
  'review',
  'qna',
  'board',
  'achievement',
  'coupon',
  'referral',
  'signup',
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export interface ActivityMemberRow {
  id: string;
  name: string | null;
  email: string | null;
  country: string | null;
  social_code: string | null;
  created_at: string;
  avatar_seed: string | null;
  avatar_traits: unknown;
  /** 회원이 올린 프로필 사진(0105). 있으면 캐릭터 대신 보여 준다. */
  avatar_url: string | null;
  social_blocked_at: string | null;
  /** 편집기에서 항목을 하나라도 직접 고른 회원인지 (아니면 시드 기본 얼굴) */
  avatar_customized: boolean;
  point_balance: number;
  stamp_count: number;
  hearts_received: number;
  hearts_given: number;
  referral_count: number;
  order_count: number;
  review_count: number;
  qna_count: number;
  board_count: number;
  achievement_count: number;
  coupon_count: number;
  point_tx_count: number;
  stamp_tx_count: number;
  last_activity_at: string | null;
}

export interface ActivityFeedRow {
  id: string;
  kind: ActivityKind;
  user_id: string;
  occurred_at: string;
  reason: string | null;
  title: string | null;
  detail: string | null;
  delta: number | null;
  balance_after: number | null;
  amount: number | null;
  currency: string | null;
  rating: number | null;
  ref_id: string | null;
  member_name: string | null;
  member_email: string | null;
  member_code: string | null;
  member_avatar_seed: string | null;
  member_avatar_traits: unknown;
  member_avatar_url: string | null;
  counterpart_id: string | null;
  counterpart_name: string | null;
  counterpart_email: string | null;
  counterpart_code: string | null;
}

/** 회원 카드가 보여주는 '활동 건수' — 잔액이 아니라 남긴 기록의 수. */
export function totalActivity(m: ActivityMemberRow): number {
  return (
    m.point_tx_count +
    m.stamp_tx_count +
    m.hearts_received +
    m.hearts_given +
    m.order_count +
    m.review_count +
    m.qna_count +
    m.board_count +
    m.achievement_count +
    m.coupon_count +
    m.referral_count
  );
}

export type MemberSort = 'recent_activity' | 'joined' | 'point' | 'hearts' | 'orders';

const MEMBER_SORT: Record<MemberSort, { column: string; asc: boolean }> = {
  recent_activity: { column: 'last_activity_at', asc: false },
  joined: { column: 'created_at', asc: false },
  point: { column: 'point_balance', asc: false },
  hearts: { column: 'hearts_received', asc: false },
  orders: { column: 'order_count', asc: false },
};

export interface MemberListParams {
  term: string;
  sort: MemberSort;
  page: number;
  pageSize: number;
  /** 아바타를 직접 꾸민 회원만 (기본 얼굴 회원을 걸러낼 때) */
  customizedOnly?: boolean;
}

export function useActivityMembers(p: MemberListParams) {
  return useQuery({
    queryKey: ['member-activity', 'members', p],
    placeholderData: keepPreviousData, // 페이지를 넘길 때 목록이 빈 화면으로 깜빡이지 않게
    queryFn: async () => {
      const sort = MEMBER_SORT[p.sort];
      let q = createClient()
        .from('admin_member_activity_v')
        .select('*', { count: 'exact' })
        // nullsFirst=false: 활동이 아예 없는 회원이 최신순 맨 앞을 차지하지 않게
        .order(sort.column, { ascending: sort.asc, nullsFirst: false });

      if (p.customizedOnly) q = q.eq('avatar_customized', true);
      const term = p.term.trim();
      if (term) {
        const like = `%${term}%`;
        q = q.or(`name.ilike.${like},email.ilike.${like},social_code.ilike.${like}`);
      }

      const from = (p.page - 1) * p.pageSize;
      const { data, error, count } = await q.range(from, from + p.pageSize - 1);
      if (error) throw error;
      return { rows: (data ?? []) as ActivityMemberRow[], total: count ?? 0 };
    },
  });
}

/** 회원 상세 드로어 — 갤러리 카드와 피드의 회원 줄 양쪽에서 열리므로 id 하나로만 연다. */
export function useActivityMember(id: string | null | undefined) {
  return useQuery({
    queryKey: ['member-activity', 'member', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('admin_member_activity_v')
        .select('*')
        .eq('id', id as string)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ActivityMemberRow | null;
    },
  });
}

export interface FeedParams {
  /** 비어 있으면 전체 종류 */
  kinds: ActivityKind[];
  term: string;
  /** 특정 회원의 타임라인만 (회원 상세 드로어) */
  userId?: string;
  /** 최근 N일. 0 이면 전체 기간 */
  days: number;
  page: number;
  pageSize: number;
}

export function useActivityFeed(p: FeedParams, enabled = true) {
  return useQuery({
    queryKey: ['member-activity', 'feed', p],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = createClient()
        .from('admin_activity_feed_v')
        .select('*', { count: 'exact' })
        .order('occurred_at', { ascending: false });

      if (p.userId) q = q.eq('user_id', p.userId);
      if (p.kinds.length) q = q.in('kind', p.kinds);
      if (p.days > 0) {
        q = q.gte('occurred_at', new Date(Date.now() - p.days * 86_400_000).toISOString());
      }
      const term = p.term.trim();
      if (term) {
        const like = `%${term}%`;
        q = q.or(
          [
            `member_name.ilike.${like}`,
            `member_email.ilike.${like}`,
            `member_code.ilike.${like}`,
            `title.ilike.${like}`,
            `detail.ilike.${like}`,
          ].join(','),
        );
      }

      const from = (p.page - 1) * p.pageSize;
      const { data, error, count } = await q.range(from, from + p.pageSize - 1);
      if (error) throw error;
      return { rows: (data ?? []) as ActivityFeedRow[], total: count ?? 0 };
    },
  });
}

/** 아바타 통계 탭 — 특성 분포는 시드에서 파생되는 값이라 DB 가 못 센다(계산이 TS 쪽에 있다).
 *  그래서 전 회원의 시드/특성만 가볍게 받아 브라우저에서 집계한다. */
export function useAvatarPopulation(limit = 2000) {
  return useQuery({
    queryKey: ['member-activity', 'avatar-population', limit],
    staleTime: 5 * 60_000, // 분포는 자주 바뀌지 않는다
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('admin_member_activity_v')
        .select('id, name, email, avatar_seed, avatar_traits, avatar_customized')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as Pick<
        ActivityMemberRow,
        'id' | 'name' | 'email' | 'avatar_seed' | 'avatar_traits' | 'avatar_customized'
      >[];
    },
  });
}
