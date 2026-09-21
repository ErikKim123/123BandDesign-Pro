// Design Ref: §5 Phase 4 — PayVerse 결제 완료 검증(데스크톱 콜백 경로).
// 결제창 콜백이 SUCCESS 를 주더라도 그대로 믿지 않고, 서버가 거래조회 API 로 재확인 후 확정한다.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { confirmPayverseOrder } from '@/lib/payments/payverse-confirm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { orderId?: string; tid?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  if (!body.orderId) return NextResponse.json({ error: 'missing_params' }, { status: 400 });

  try {
    const result = await confirmPayverseOrder({ orderId: body.orderId, tid: body.tid ?? null });
    if (result.ok) return NextResponse.json({ ok: true, orderNo: result.orderNo });
    if (result.reason === 'pending') {
      // 승인 진행 중 — 주문은 pending 유지, 웹훅이 확정한다. 화면은 '확인 중'으로 안내.
      return NextResponse.json({ ok: false, pending: true, orderNo: result.orderNo });
    }
    if (result.reason === 'card_blocked') {
      return NextResponse.json(
        { ok: false, reason: result.reason, refunded: result.refunded },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 409 });
  } catch (e) {
    // 조회 API 장애 등 — 확정은 웹훅이 보강한다. 화면은 '확인 중'으로 안내해 실패로 오인시키지 않는다.
    console.error('[payverse:complete] 확정 실패', e);
    return NextResponse.json({ ok: false, pending: true });
  }
}
