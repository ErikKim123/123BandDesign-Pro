// Design Ref: §5 Phase 4 — 주문 생성(pending) + 결제확정(pending→paid) 멱등 처리
// 확정은 webhook 과 클라이언트 complete 양쪽에서 호출될 수 있으므로 반드시 멱등이어야 한다.
import 'server-only';
import { cookies } from 'next/headers';
import type { DbClient } from '@123band/shared/supabase/schema';
import {
  createAdminClient,
  notifyAdminOrderPaid,
  pickI18n,
  sendOrderConfirmationEmail,
  toDisplayAmount,
  type Currency,
  type I18n,
  type MailLocale,
} from '@123band/shared';
import { VISITOR_ID_COOKIE } from '@/lib/supabase/cookie';
import { SITE } from '@/lib/seo'; // 구매확인 메일의 주문내역 링크 — canonical 도메인 단일 소스
import type { Provider } from './config';
import { CARD_PAYMENTS_ENABLED } from './methods';
import type { Quote } from './pricing';

// 주문번호 = PayVerse orderId (웹훅/복귀가 order_no 로 주문을 되찾으므로 반드시 동일해야 한다).
// ⚠️ 하이픈·특수문자 금지 + 최대 100자: PG 에 그대로 전달되는 값이라 영문/숫자만 쓴다.
function makeOrderNo(now: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  const ymd = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}`;
  const hms = `${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `ORD${ymd}${hms}${rand}`;
}

export interface PendingOrder {
  orderId: string;
  orderNo: string;
  total: number;
  currency: Currency;
  orderName: string;
}

/**
 * 견적을 바탕으로 주문(pending) + 주문항목을 생성. PG 결제 직전에 호출.
 * db: 로그인 사용자 세션 클라이언트. RLS(orders_buyer_own / order_items_buyer_insert)로
 * 본인 주문만 insert 가능 → service role 불필요(금액은 서버 견적값이라 위조 불가).
 */
export async function createPendingOrder(
  db: DbClient,
  quote: Quote,
  buyerId: string,
  provider: Provider,
  // 송금 주문은 status='awaiting_payment'(입금확인 대기) + payment_method='transfer' 로 생성한다.
  // 미지정 시 카드(PayVerse) 기본값(pending / provider).
  opts?: { status?: string; paymentMethod?: string },
): Promise<PendingOrder> {
  const orderNo = makeOrderNo(new Date());

  // 퍼널 5단계(결제완료) 귀속용 — 결제 '시작' 시점에 남긴다.
  // 결제 성공 화면 방문에만 기대면, 웹훅이 나중에 확정하는 주문(pending → paid)에서
  // 승인 대기 화면을 보고 떠난 구매자가 영영 집계되지 않는다(0060).
  let visitorId: string | null = null;
  try {
    visitorId = cookies().get(VISITOR_ID_COOKIE)?.value ?? null;
  } catch {
    // 쿠키 컨텍스트 밖에서 호출되면 집계만 포기한다 — 주문 생성은 막지 않는다.
  }

  const { data: order, error: oerr } = await db
    .from('orders')
    .insert({
      order_no: orderNo,
      buyer_id: buyerId,
      visitor_id: visitorId,
      status: opts?.status ?? 'pending',
      total_amount: quote.total,
      currency: quote.currency,
      payment_method: opts?.paymentMethod ?? provider,
      coupon_code: quote.couponCode,
      discount_amount: quote.discount,
    })
    .select('id')
    .single();
  if (oerr || !order) throw new Error(`order insert failed: ${oerr?.message ?? 'no row'}`);

  const row = (i: Quote['items'][number]) => ({
    order_id: order.id as string,
    product_id: i.productId,
    seller_id: i.sellerId,
    qty: i.qty,
    unit_price: i.unitPrice,
    line_amount: i.lineAmount,
    currency: quote.currency,
  });
  const base = quote.items.map(row);
  // 구매한 패스(티켓 티어)를 함께 남긴다 — 어드민/파트너 주문상세가 '행사명'만 보이던 문제(0042).
  const hasTicket = quote.items.some((i) => i.ticketKey);
  const rows = quote.items.map((i) => ({
    ...row(i),
    ticket_key: i.ticketKey ?? null,
    ticket_name_i18n: i.ticketName ?? null,
  }));
  let { error: ierr } = await db.from('order_items').insert(hasTicket ? rows : base);
  if (ierr && hasTicket) {
    // 마이그레이션(0042) 미적용 환경 — 티켓 컬럼 없이 재시도. 주문 자체는 막지 않는다.
    console.warn('[order] 패스 정보 저장 실패(마이그레이션 0042 확인 필요):', ierr.message);
    ({ error: ierr } = await db.from('order_items').insert(base));
  }
  if (ierr) throw new Error(`order_items insert failed: ${ierr.message}`);

  // 표시 통화(서브통화) 병기 — 고객이 바트 등으로 보고 송금한 경우. 정산/통계는 canonical 그대로.
  // best-effort: 마이그레이션(0034) 미적용이면 컬럼이 없어 실패하지만, 주문 생성 자체는 유지한다.
  if (quote.displayCurrency && quote.displayTotal != null) {
    const { error: derr } = await db
      .from('orders')
      .update({ display_currency: quote.displayCurrency, display_total: quote.displayTotal })
      .eq('id', order.id);
    if (derr) console.warn('[order] 표시 통화 저장 실패(마이그레이션 0034 확인 필요):', derr.message);
  }

  // 입장권(passes) 즉시 발행 — 티켓 항목의 qty 만큼(멱등). 주문 직후 주문내역에 QR 이 뜬다.
  // 세션 클라이언트로 호출(본인 주문만 발행하도록 RPC 내부 가드). 실패해도 주문 생성은 유지.
  if (quote.items.some((i) => i.qty > 0)) {
    try {
      await db.rpc('mint_passes_for_order', { p_order_id: order.id as string });
    } catch {
      /* 발행 실패는 finalize/조회 시 자기치유 */
    }
  }

  return {
    orderId: order.id as string,
    orderNo,
    total: quote.total,
    currency: quote.currency,
    orderName: quote.orderName,
  };
}

export type FinalizeResult =
  | { ok: true; orderNo: string; already: boolean }
  | { ok: false; reason: 'not_found' | 'bad_status' | 'amount_mismatch' };

interface OrderRow {
  id: string;
  order_no: string;
  status: string;
  total_amount: number;
  currency: string;
  coupon_code: string | null;
}

/**
 * 결제건을 검증하고 주문을 확정(pending→paid)한다. 멱등:
 * - 이미 paid 면 그대로 성공(already=true)
 * - 금액/통화 불일치면 paid 로 올리지 않고 mismatch 반환(수동 점검 대상)
 * - pending→paid 전환에 실제로 성공한 호출만 쿠폰을 차감(중복 차감 방지)
 */
export async function finalizeOrder(params: {
  orderId: string;
  provider: Provider;
  paymentRef: string;
  paidAmount: number;
  paidCurrency: Currency;
}): Promise<FinalizeResult> {
  const { orderId, provider, paymentRef, paidAmount, paidCurrency } = params;
  const admin = createAdminClient();

  const { data: row } = await admin
    .from('orders')
    .select('id, order_no, status, total_amount, currency, coupon_code')
    .eq('id', orderId)
    .maybeSingle();
  const order = row as OrderRow | null;
  if (!order) return { ok: false, reason: 'not_found' };
  if (order.status === 'paid' || order.status === 'shipped' || order.status === 'done') {
    // 이미 확정된 주문 — 발행 누락분 자기치유(멱등). 티켓이 있으면 부족한 패스만 보충.
    await mintPasses(admin, orderId);
    return { ok: true, orderNo: order.order_no, already: true };
  }
  if (order.status !== 'pending') return { ok: false, reason: 'bad_status' };
  if (order.total_amount !== paidAmount || order.currency !== paidCurrency) {
    return { ok: false, reason: 'amount_mismatch' };
  }

  // 멱등 전환: status='pending' 조건이 걸린 UPDATE 라 동시 호출 중 하나만 성공한다.
  const { data: flipped } = await admin
    .from('orders')
    .update({
      status: 'paid',
      payment_method: provider,
      payment_ref: paymentRef,
      paid_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('status', 'pending')
    .select('id, coupon_code')
    .maybeSingle();

  // 쿠폰 차감 + 구매 적립은 DB 트리거(orders_on_paid, 0038)가 처리한다.
  // 결제확정 경로가 여러 개고(카드 complete/webhook, 0원주문, 어드민의 계좌이체 확인)
  // 그중 계좌이체는 여기를 거치지 않으므로, 'paid 로 바뀌는 전이' 한 곳에 모아 1회만 실행한다.

  // 입장권(passes) 발행 — 티켓 order_item 의 qty 만큼 valid 패스 생성(멱등). QR 은 이 패스의 시크릿을 담는다.
  await mintPasses(admin, orderId);

  // 운영자 알림 — 실제로 pending→paid 를 성사시킨 호출만 보낸다(웹훅 재전송으로 중복 발송되지 않게).
  if (flipped) await notifyPaid(admin, orderId, order, provider);

  return { ok: true, orderNo: order.order_no, already: !flipped };
}

/**
 * 결제확정 운영자 메일 — 주문자/상품명을 곁들여 보낸다.
 * 확정 전이가 성사된 1회에만 호출되므로 여기서 추가 조회를 해도 부담이 없다.
 * best-effort: 실패해도 결제 확정은 유지한다.
 */
async function notifyPaid(
  admin: DbClient,
  orderId: string,
  order: OrderRow,
  provider: Provider,
): Promise<void> {
  try {
    const { data } = await admin
      .from('orders')
      .select(
        'payment_method, paid_at, buyer:profiles!buyer_id(name, email, locale), ' +
          'order_items(qty, ticket_name_i18n, product:products!product_id(name_i18n, code, product_type))',
      )
      .eq('id', orderId)
      .maybeSingle();

    type ProductLite = { name_i18n: I18n; code: string | null; product_type?: string | null };
    type BuyerLite = { name: string | null; email: string | null; locale?: string | null };
    const row = (data ?? {}) as {
      payment_method?: string | null;
      paid_at?: string | null;
      buyer?: BuyerLite | BuyerLite[] | null;
      order_items?: Array<{
        qty: number;
        ticket_name_i18n?: I18n | null;
        product?: ProductLite | ProductLite[] | null;
      }> | null;
    };
    // supabase 임베드는 to-one 이어도 배열로 올 수 있어 단일 객체로 정규화
    const one = <T,>(v: T | T[] | null | undefined): T | null =>
      Array.isArray(v) ? v[0] ?? null : v ?? null;

    const buyer = one(row.buyer);
    // 운영자 메일은 한국어 고정, 구매자 메일은 구매자 언어 — 이름을 언어별로 각각 만든다.
    const buyerLocale: MailLocale = row.buyer && one(row.buyer)?.locale === 'ko' ? 'ko' : 'en';
    const nameIn = (
      p: ProductLite | null,
      ticket: I18n | null | undefined,
      loc: MailLocale,
      fallback: string,
    ): string => {
      const base = (p ? pickI18n(p.name_i18n, loc) || p.code || '' : '') || fallback;
      const tier = ticket ? pickI18n(ticket, loc) : '';
      return tier ? `${base} — ${tier}` : base;
    };

    const parsed = (row.order_items ?? []).map((it) => {
      const p = one(it.product);
      return {
        qty: Number(it.qty ?? 0),
        isTicket: p?.product_type === 'ticket',
        adminName: nameIn(p, it.ticket_name_i18n, 'ko', '(상품)'),
        buyerName: nameIn(p, it.ticket_name_i18n, buyerLocale, buyerLocale === 'ko' ? '(상품)' : '(item)'),
      };
    });
    const items = parsed.map((it) => ({ name: it.adminName, qty: it.qty }));

    const amountText = `${order.currency} ${toDisplayAmount(
      order.total_amount,
      order.currency as Currency,
    ).toLocaleString()}`;

    await notifyAdminOrderPaid({
      orderNo: order.order_no,
      amountText,
      customerEmail: buyer?.email ?? null,
      customerName: buyer?.name ?? null,
      method: row.payment_method ?? provider,
      items,
    });

    // 구매확인 메일 — 구매자에게. 운영자 알림과 독립적으로(둘 중 하나가 실패해도 나머지는 간다).
    if (buyer?.email) {
      const sent = await sendOrderConfirmationEmail({
        orderNo: order.order_no,
        locale: buyerLocale,
        buyerEmail: buyer.email,
        buyerName: buyer.name,
        amountText,
        methodLabel: methodLabel(row.payment_method ?? provider, buyerLocale),
        paidAtText: fmtPaidAt(row.paid_at, buyerLocale),
        items: parsed.map((it) => ({ name: it.buyerName, qty: it.qty })),
        hasTicket: parsed.some((it) => it.isTicket),
        ordersUrl: `${SITE}/${buyerLocale}/account/orders`,
      });
      // 보낸 사실만 남긴다 — 오거나이저가 주문 상세에서 '확인서가 갔는지' 알 수 있어야 한다.
      // 실제로 발송에 성공했을 때만 기록한다. 기록 실패는 삼킨다(메일은 이미 나갔다).
      if (sent) {
        await admin
          .from('order_mail_log')
          .insert({
            order_id: orderId,
            kind: 'order_confirmation',
            locale: buyerLocale,
            to_email: buyer.email,
            sent_by: null,
            source: 'auto', // 결제확정 시 코드가 보냄
          })
          .then(
            () => undefined,
            () => undefined,
          );
      }
    }
  } catch {
    /* 알림 실패는 무시 — 결제 확정이 우선이다 */
  }
}

/** 결제수단 코드 → 구매자에게 보여줄 이름. 모르는 코드는 그대로 둔다(빈 줄보다 낫다). */
export function methodLabel(method: string | null | undefined, locale: MailLocale): string | null {
  const m = (method ?? '').trim();
  if (!m) return null;
  const map: Record<string, { ko: string; en: string }> = {
    card: { ko: '카드', en: 'Card' },
    payverse: CARD_PAYMENTS_ENABLED ? { ko: '카드', en: 'Card' } : { ko: '간편결제', en: 'E-wallet' },
    portone: { ko: '카드', en: 'Card' },
    transfer: { ko: '계좌이체/송금', en: 'Bank transfer' },
    kakaopay: { ko: '카카오페이', en: 'KakaoPay' },
    wechat: { ko: '위챗페이', en: 'WeChat Pay' },
  };
  return map[m]?.[locale] ?? m;
}

/** 결제 일시 → KST 표시 문자열. 파싱 실패하면 줄 자체를 생략하도록 null. */
export function fmtPaidAt(iso: string | null | undefined, locale: MailLocale): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const s = new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
  return `${s} (KST)`;
}

/** 티켓 입장권 발행(멱등) — mint_passes_for_order RPC. 발행 실패해도 결제/주문 확정은 유지(best-effort). */
async function mintPasses(admin: DbClient, orderId: string): Promise<void> {
  try {
    await admin.rpc('mint_passes_for_order', { p_order_id: orderId });
  } catch {
    /* 발행 실패는 자기치유(다음 finalize 호출/조회 시 보충) */
  }
}
