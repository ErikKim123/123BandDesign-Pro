// Design Ref: §5 Phase 4 — 결제 완료/실패 도착지 (PayVerse 복귀 후 최종 화면).
// 결제 성공 판정은 URL 파라미터가 아니라 '주문의 DB 상태'로만 한다.
//   - 확정(paid/shipped/done) → 주문 완료
//   - pending/awaiting_payment → 승인 확인 중(웹훅이 곧 확정)
//   - 그 외/없음 → 실패 안내
// 확정 자체는 /api/payments/payverse/{return,complete,webhook} 이 거래조회로 검증해 수행한다.
import Link from 'next/link';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import type { Locale } from '@123band/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { createClient } from '@/lib/supabase/server';
import { recordPurchase } from '@/lib/funnel';
import { ClearCart } from '@/components/cart/ClearCart';

export const dynamic = 'force-dynamic';

function str(v: string | string[] | undefined): string | null {
  return typeof v === 'string' ? v : null;
}

const PAID = ['paid', 'shipped', 'done'];
const IN_PROGRESS = ['pending', 'awaiting_payment'];

export default async function CheckoutSuccessPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  const orderNo = str(searchParams.order);
  // 결제창이 돌려준 실패 사유(있으면 화면에 그대로 안내)
  // 카드 결제 차단(자동 취소) 은 결제창 메시지 대신 우리 안내를 보여준다.
  const blocked = str(searchParams.blocked);
  const failMsg =
    blocked === 'card'
      ? dict.cart.cardBlocked
      : blocked === 'card_hold'
        ? dict.cart.cardBlockedHold
        : str(searchParams.msg);

  // 주문 상태 조회 — RLS(orders_buyer_own)로 본인 주문만 읽힌다.
  let status: string | null = null;
  let order: { id: string; total_amount: number | null; currency: string | null } | null = null;
  if (orderNo) {
    const supabase = createClient();
    const { data } = await supabase
      .from('orders')
      .select('id, status, total_amount, currency')
      .eq('order_no', orderNo)
      .maybeSingle();
    const row = data as
      | { id: string; status: string; total_amount: number | null; currency: string | null }
      | null;
    status = row?.status ?? null;
    order = row ? { id: row.id, total_amount: row.total_amount, currency: row.currency } : null;
  }

  const paid = status != null && PAID.includes(status);
  const pending = !paid && status != null && IN_PROGRESS.includes(status);

  // 퍼널 5단계 기록 — 확정된 주문만. 중복 호출은 유니크 인덱스가 걸러낸다.
  if (paid && order) await recordPurchase(order);

  // 승인 확인 중 — 실패로 오인하지 않도록 별도 안내. 티켓은 확정 후 주문내역에 나타난다.
  if (pending) {
    return (
      <div className="container-band flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <Clock size={56} className="text-grey-400" />
        <h1 className="section-title">{dict.cart.verifying}</h1>
        <p className="max-w-md text-grey-500">
          {locale === 'ko'
            ? '결제 승인을 확인하고 있습니다. 확인이 끝나면 주문내역에서 티켓을 받아보실 수 있어요.'
            : 'We’re confirming your payment. Your ticket will appear in your orders once it’s approved.'}
        </p>
        {orderNo && (
          <p className="text-grey-500">
            {dict.cart.orderNo}: <span className="font-medium text-black">{orderNo}</span>
          </p>
        )}
        <Link href={`/${locale}/account/orders`} className="btn btn-primary btn-sm">
          {locale === 'ko' ? '주문내역 보기' : 'View my orders'}
        </Link>
      </div>
    );
  }

  // 결제 미완료(취소/실패) — 성공으로 오인 금지. 장바구니는 비우지 않아 재시도 가능.
  if (!paid) {
    return (
      <div className="container-band flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <XCircle size={56} className="text-danger" />
        <h1 className="section-title">{dict.cart.orderFailed}</h1>
        <p className="max-w-md text-grey-500">{failMsg || dict.cart.payFailed}</p>
        <Link href={`/${locale}/cart`} className="btn btn-primary btn-sm">
          {dict.cart.backToCart}
        </Link>
      </div>
    );
  }

  return (
    <div className="container-band flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <ClearCart />
      <CheckCircle2 size={56} className="text-success" />
      <h1 className="section-title">{dict.cart.orderComplete}</h1>
      {orderNo && (
        <p className="text-grey-500">
          {dict.cart.orderNo}: <span className="font-medium text-black">{orderNo}</span>
        </p>
      )}
      <Link href={`/${locale}`} className="btn btn-secondary btn-sm">
        {dict.cart.continue}
      </Link>
    </div>
  );
}
