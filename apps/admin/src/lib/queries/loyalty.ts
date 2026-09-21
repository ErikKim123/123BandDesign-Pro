// Design Ref: §5 — 대시보드 포인트/스탬프. 요약은 집계 RPC(0063), 활동은 두 원장을 합쳐 최신순으로.
// 서버 컴포넌트 전용.
import { createClient } from '@/lib/supabase/server';

export interface LoyaltyStats {
  /** 아직 쓰이지 않고 남아 있는 포인트 총량 */
  pointOutstanding: number;
  pointHolders: number;
  /** 카드를 모으는 중인 회원 수(카드가 차면 0 으로 돌아가므로 진행 중만 세어진다) */
  stampHolders: number;
  stampCardsDone: number;
  /** 카드 완성으로 지급한 포인트 누계 */
  stampPointsPaid: number;
}

export type LoyaltyKind = 'point' | 'stamp';

export interface LoyaltyActivity {
  id: string;
  kind: LoyaltyKind;
  delta: number;
  balanceAfter: number;
  reason: string;
  memo: string | null;
  createdAt: string;
  member: { name: string | null; email: string | null } | null;
}

interface LedgerRow {
  id: string;
  delta: number;
  balance_after: number;
  reason: string;
  memo: string | null;
  created_at: string;
  user?: { name: string | null; email: string | null } | { name: string | null; email: string | null }[] | null;
}

const LEDGER_COLS =
  'id, delta, balance_after, reason, memo, created_at, user:profiles!user_id(name, email)';

/** supabase 임베드는 to-one 이어도 배열로 올 수 있어 단일 객체로 정규화 */
function one(v: LedgerRow['user']): LoyaltyActivity['member'] {
  return Array.isArray(v) ? v[0] ?? null : v ?? null;
}

export async function getLoyaltyStats(): Promise<LoyaltyStats> {
  const { data } = await createClient().rpc('admin_loyalty_stats');
  const v = (data ?? {}) as Record<string, unknown>;
  return {
    pointOutstanding: Number(v.point_outstanding ?? 0),
    pointHolders: Number(v.point_holders ?? 0),
    stampHolders: Number(v.stamp_holders ?? 0),
    stampCardsDone: Number(v.stamp_cards_done ?? 0),
    stampPointsPaid: Number(v.stamp_points_paid ?? 0),
  };
}

/**
 * 포인트·스탬프 원장을 하나의 타임라인으로 합친다.
 * 두 테이블을 DB 에서 union 하려면 뷰가 필요한데, 대시보드는 최근 몇 건만 보므로
 * 각각 limit 만큼 가져와 합친 뒤 잘라내는 편이 싸다(정렬 기준이 created_at 하나뿐이라 정확하다).
 */
export async function getLoyaltyActivity(limit = 10): Promise<LoyaltyActivity[]> {
  const supabase = createClient();
  const [points, stamps] = await Promise.all([
    supabase.from('point_ledger').select(LEDGER_COLS).order('created_at', { ascending: false }).limit(limit),
    supabase.from('stamp_ledger').select(LEDGER_COLS).order('created_at', { ascending: false }).limit(limit),
  ]);

  const map = (rows: LedgerRow[] | null, kind: LoyaltyKind): LoyaltyActivity[] =>
    (rows ?? []).map((r) => ({
      id: `${kind}:${r.id}`,
      kind,
      delta: Number(r.delta ?? 0),
      balanceAfter: Number(r.balance_after ?? 0),
      reason: r.reason,
      memo: r.memo,
      createdAt: r.created_at,
      member: one(r.user),
    }));

  return [
    ...map(points.data as LedgerRow[] | null, 'point'),
    ...map(stamps.data as LedgerRow[] | null, 'stamp'),
  ]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
    .slice(0, limit);
}
