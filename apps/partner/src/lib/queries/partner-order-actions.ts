// 주문 이행(발송/완료) 처리 — 오거나이저 권한.
//
// 상태 변경은 RLS UPDATE 가 아니라 SECURITY DEFINER RPC(seller_advance_order, 마이그레이션 0036)를 탄다.
// RLS UPDATE 정책으로는 '어느 컬럼을 바꿨는지'를 제약할 수 없어(금액·구매자까지 열림) 함수로 좁혔다.
// 허용 전이는 paid→shipped, shipped→done 뿐이며, 결제확인·취소·환불·삭제는 운영자 전용이다.
'use client';
import { createClient } from '@/lib/supabase/client';

export type FulfillTo = 'shipped' | 'done';

/** 현재 상태에서 오거나이저가 진행할 수 있는 다음 단계. 없으면 null(운영자 대기). */
export function nextFulfillStep(status: string | null): FulfillTo | null {
  if (status === 'paid') return 'shipped';
  if (status === 'shipped') return 'done';
  return null;
}

/** 단건 전이. 서버(0036)가 소유·전이를 다시 검증하므로 UI 가드는 편의일 뿐이다. */
export async function advanceOrder(orderId: string, to: FulfillTo): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('seller_advance_order', {
    p_order_id: orderId,
    p_to: to,
  });
  if (error) throw new Error(error.message);
}

export interface BulkResult {
  done: number;
  /** 현재 상태에서 해당 전이가 불가능해 시도조차 하지 않은 주문 */
  skipped: string[];
  /** 시도했으나 서버가 거부한 주문 */
  failed: string[];
}

/**
 * 일괄 전이 — 대상 전이가 가능한 주문만 골라 순차 처리한다.
 * 순차인 이유: 건수가 많지 않고, 실패한 건을 주문번호로 되짚어 알려주기 위해서다.
 */
export async function advanceOrders(
  rows: { id: string; status: string | null }[],
  to: FulfillTo,
): Promise<BulkResult> {
  const res: BulkResult = { done: 0, skipped: [], failed: [] };
  for (const r of rows) {
    if (nextFulfillStep(r.status) !== to) {
      res.skipped.push(r.id);
      continue;
    }
    try {
      await advanceOrder(r.id, to);
      res.done += 1;
    } catch {
      res.failed.push(r.id);
    }
  }
  return res;
}
