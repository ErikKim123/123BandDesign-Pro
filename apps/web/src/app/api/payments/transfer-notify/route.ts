// 송금(계좌이체/카카오페이/Wise) 주문 — 고객이 송금 후 "알림 보내기"를 누르면:
//   1) 서버가 장바구니를 재견적(금액/할인 서버 권위)해 주문을 'awaiting_payment'(입금 확인 대기)로 생성
//      → 마이페이지에 "입금 확인 중"으로 노출(getMyOrders 는 pending 만 숨기므로 자동 표시).
//   2) 운영자(ADMIN_NOTIFY_EMAIL)에게 누가/무엇을/얼마를 송금했는지 메일 발송.
// 실제 결제완료는 운영자가 입금 확인 후 주문관리에서 awaiting_payment→paid('결제확인')로 전이(수동).
import { NextResponse } from 'next/server';
import type { Currency, Locale } from '@123band/shared';
import { notifyAdminTransfer, DISPLAY_CURRENCIES } from '@123band/shared';
import { createClient } from '@/lib/supabase/server';
import { quoteCart, type CartLine } from '@/lib/payments/pricing';
import { createPendingOrder } from '@/lib/payments/finalize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeLocale(v: unknown): Locale {
  return v === 'ko' ? 'ko' : 'en';
}

export async function POST(req: Request) {
  // 로그인 고객만 — 세션에서 본인 신원(이메일/이름)을 서버가 직접 읽는다(위조 방지).
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: {
    method?: string;
    amountText?: string;
    locale?: string;
    couponCode?: string | null;
    displayCurrency?: string;
    items?: Array<CartLine & { name?: string }>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const locale = normalizeLocale(body.locale);
  const currency: Currency = locale === 'ko' ? 'KRW' : 'USD';

  // 알림 메일용 항목(이름/수량) — 클라이언트 표시값.
  const mailItems = Array.isArray(body.items)
    ? body.items
        .map((i) => ({ name: String(i?.name ?? '').slice(0, 200), qty: Number(i?.qty) || 1 }))
        .filter((i) => i.name)
        .slice(0, 50)
    : [];
  const method = String(body.method ?? '').trim().slice(0, 60) || '계좌이체';
  const amountText = String(body.amountText ?? '').trim().slice(0, 40);

  // 주문 생성용 견적 — 서버 권위(금액/할인 재계산). 카트 라인(id/qty/ticketKey)만 사용.
  const lines: CartLine[] = Array.isArray(body.items)
    ? body.items.map((i) => ({ id: i.id, qty: i.qty, ticketKey: i.ticketKey }))
    : [];
  // 고객이 웹에서 본 표시 통화(바트 등) — 결제 통화와 다르면 '표시 전용' 금액을 함께 기록(어드민 병기용).
  const displayCurrency = (DISPLAY_CURRENCIES as readonly string[]).includes(body.displayCurrency ?? '')
    ? (body.displayCurrency as Currency)
    : undefined;
  const today = new Date().toISOString().slice(0, 10);
  const quoted = await quoteCart(
    supabase,
    lines,
    currency,
    locale,
    body.couponCode ?? null,
    today,
    displayCurrency,
  );
  if (!quoted.ok) {
    return NextResponse.json({ error: 'invalid_cart', reason: quoted.reason }, { status: 400 });
  }

  // 주문 생성 — 입금 확인 대기(awaiting_payment) + 결제수단 transfer.
  // (RLS: 본인 주문만 insert. 패스는 mint_passes_for_order 로 즉시 발행 → 주문내역에 표시.)
  const order = await createPendingOrder(supabase, quoted.quote, user.id, 'payverse', {
    status: 'awaiting_payment',
    paymentMethod: 'transfer',
  });

  // 이름/연락처는 가입 시 저장한 메타데이터 사용(신뢰 가능한 서버 값).
  const meta = (user.user_metadata ?? {}) as { name?: string; phone?: string };
  await notifyAdminTransfer({
    method: `${method} · 주문 ${order.orderNo}`,
    customerEmail: user.email ?? '(unknown)',
    customerName: meta.name ?? null,
    customerPhone: meta.phone ?? null,
    amountText: amountText || `${currency} ${order.total}`,
    items: mailItems,
  });

  return NextResponse.json({ ok: true, orderNo: order.orderNo });
}
