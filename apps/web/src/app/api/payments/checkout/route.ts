// Design Ref: §5 Phase 4 — 결제 시작 엔드포인트 (PayVerse 단일).
// 클라이언트(상품id+수량+쿠폰)를 받아 서버에서 금액 재계산 → 주문(pending) 생성 →
// PayVerse 통합결제창(requestUI) 파라미터 + 위변조 서명(sign)을 반환한다.
//   ko/KRW → KRW 가맹점,  en/USD → USD 가맹점. (가맹점은 통화로 결정)
import { NextResponse } from 'next/server';
import type { Currency, Locale } from '@123band/shared';
import { createClient } from '@/lib/supabase/server';
import { payverseMerchant, payverseSdkUrl, siteOrigin } from '@/lib/payments/config';
import { payverseAmount, payverseReqDate, payverseSign } from '@/lib/payments/payverse';
import { quoteCart, type CartLine } from '@/lib/payments/pricing';
import { createPendingOrder, finalizeOrder } from '@/lib/payments/finalize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeLocale(v: unknown): Locale {
  return v === 'ko' ? 'ko' : 'en';
}

export async function POST(req: Request) {
  // 1) 인증 (쿠키 세션)
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // 2) 입력 파싱
  let body: { items?: CartLine[]; couponCode?: string | null; locale?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const locale = normalizeLocale(body.locale);
  const currency: Currency = locale === 'ko' ? 'KRW' : 'USD';

  // 3) 서버 권위 견적 (금액/할인 재계산) — 0원 여부를 먼저 알아야 PG 필요 여부가 결정된다.
  const today = new Date().toISOString().slice(0, 10);
  const quoted = await quoteCart(
    supabase,
    body.items ?? [],
    currency,
    locale,
    body.couponCode ?? null,
    today,
  );
  if (!quoted.ok) {
    return NextResponse.json({ error: 'invalid_cart', reason: quoted.reason }, { status: 400 });
  }
  const quote = quoted.quote;

  const origin = siteOrigin(new URL(req.url).origin);
  const successBase = `${origin}/${locale}/checkout/success`;

  // 3-1) 재고 확인 — 화면에서 막아도 서버가 다시 본다.
  //      화면의 남은 수량은 페이지를 연 시점의 값이라, 그 사이 남이 사 가면 초과 판매가 된다.
  //      확정적인 예약(락)은 아니다. 동시에 마지막 한 장을 결제창까지 가져가는 경우까지 막으려면
  //      주문 단계에서 잠가야 하는데, 그러면 결제창만 열고 닫은 건이 재고를 물고 있게 된다.
  //      여기서는 '이미 팔린 만큼'만 확실히 막는다.
  const stockError = await checkTicketStock(supabase, quote.items);
  if (stockError) {
    return NextResponse.json(
      { error: 'sold_out', ticketKey: stockError.ticketKey, remaining: stockError.remaining },
      { status: 409 },
    );
  }

  // 4) 무료(0원) 주문 → PG 설정과 무관하게 즉시 확정. (무료 티켓/전액 할인)
  if (quote.total === 0) {
    const order = await createPendingOrder(supabase, quote, user.id, 'payverse');
    await finalizeOrder({
      orderId: order.orderId,
      provider: 'payverse',
      paymentRef: 'free',
      paidAmount: 0,
      paidCurrency: currency,
    });
    return NextResponse.json({
      kind: 'free',
      orderNo: order.orderNo,
      redirectUrl: `${successBase}?order=${order.orderNo}`,
    });
  }

  // 5) 유료 주문 → 해당 통화의 PayVerse 가맹점 설정이 필수
  const merchant = payverseMerchant(currency);
  if (!merchant) {
    return NextResponse.json({ error: 'payment_not_configured' }, { status: 503 });
  }

  // 6) 주문 생성 (pending) — 로그인 사용자 세션으로 insert (RLS, service role 불필요)
  const order = await createPendingOrder(supabase, quote, user.id, 'payverse');

  // 7) 결제창 파라미터. orderId = 주문번호(order_no) → 웹훅/복귀 때 주문을 되찾는 열쇠.
  //    reqDate·requestAmount·sign 은 한 세트다(서명 입력값이 바뀌면 결제창이 'Not valid sign' 으로 거절).
  const reqDate = payverseReqDate();
  const requestAmount = payverseAmount(quote.total, currency);
  const sign = payverseSign([
    merchant.secretKey,
    merchant.mid,
    order.orderNo,
    requestAmount,
    reqDate,
  ]);

  return NextResponse.json({
    kind: 'payverse',
    orderId: order.orderId, // 우리 주문 UUID (complete 호출용)
    orderNo: order.orderNo,
    // 결제창 SDK 는 가맹점이 붙는 환경을 따라간다(KRW 운영 / USD 테스트가 공존할 수 있다).
    sdkUrl: payverseSdkUrl(merchant.env),
    params: {
      mid: merchant.mid,
      clientKey: merchant.clientKey, // 브라우저 노출 전제 값. secretKey 는 절대 내려보내지 않는다.
      sign,
      orderId: order.orderNo,
      // customerId 는 String(30) 제한 — UUID(36자)는 하이픈을 뺀 32자도 넘으므로 30자로 자른다.
      customerId: user.id.replace(/-/g, '').slice(0, 30),
      productName: order.orderName.slice(0, 100),
      requestCurrency: currency,
      requestAmount,
      reqDate,
      // 복귀 URL 에는 쿼리를 붙이지 않는다 — PayVerse 가 '?resultStatus=...' 를 그대로 이어붙이기 때문.
      returnUrl: `${origin}/api/payments/payverse/return/${locale}`,
      webhookUrl: `${origin}/api/payments/payverse/webhook`,
      billkeyReq: 'N',
      mallReserved: '',
      // 결제창 언어는 여기서 못 정한다 — 보낼 파라미터 자체가 없다.
      //   SDK(ui.payverseglobal.com/js/payments.js)의 ALLOWED_PARAMS 에 언어 항목이 없고,
      //   결제창 iframe 은 POST /payment/methodList/{mid} 응답의 langCd(기본 언어) +
      //   langCdUse(강제 여부)로 언어를 정한다. 요청값은 보지 않는다.
      //     langCdUse='Y' → langCd 강제
      //     그 외        → navigator.language 우선(ko-KR→한국어), 매핑 실패 시 langCd/en
      //   즉 한국어 브라우저로 /en 에서 결제하면 결제창이 한국어로 뜬다.
      //   설정 위치: 이롬넷 가맹점관리자(merchant.payverseglobal.com) → Payment Setting → Language Settings.
      //   ⚠️ 기본 언어(langCd)만 바꾸면 부족할 수 있다 — langCdUse='Y' 가 아니면 navigator.language 가
      //      여전히 이긴다. 한국어 브라우저로 실제 결제창을 열어 확인할 것.
      //   가맹점이 통화별로 갈리고(payverseMerchant) 우리 로케일이 통화를 정하므로,
      //   MID 별 언어 고정(USD=EN, KRW=KO)이 우리 구조에 그대로 맞아떨어진다.
    },
  });
}

/**
 * 남은 수량을 넘겨 담았는지 확인. 넘겼으면 그 티켓 정보를 돌려준다(없으면 null).
 *
 * 총 수량(units)을 정하지 않은 티켓은 검사하지 않는다 — 지금까지 제한 없이 팔리던 동작 그대로.
 * 0094 미적용 환경에서는 조회가 실패하므로 통과시킨다(결제를 막는 쪽이 더 나쁘다).
 */
async function checkTicketStock(
  supabase: ReturnType<typeof createClient>,
  items: { productId: string; qty: number; ticketKey?: string }[],
): Promise<{ ticketKey: string; remaining: number } | null> {
  const tickets = items.filter((i) => i.ticketKey);
  if (!tickets.length) return null;

  // 같은 상품의 여러 티켓을 한 번에 담을 수 있다 — 상품별로 한 번만 조회한다.
  const byProduct = new Map<string, typeof tickets>();
  for (const it of tickets) {
    const list = byProduct.get(it.productId) ?? [];
    list.push(it);
    byProduct.set(it.productId, list);
  }

  for (const [productId, list] of byProduct) {
    const { data: product } = await supabase
      .from('products')
      .select('event_content')
      .eq('id', productId)
      .maybeSingle();
    const tiers = ((product?.event_content as { tickets?: { key: string; units?: number }[] } | null)
      ?.tickets ?? []);
    if (!tiers.length) continue;

    const { data: soldRaw, error } = await supabase.rpc('ticket_sold_counts', {
      p_product: productId,
    });
    if (error) continue; // 0094 미적용 — 검사 생략
    const sold = (soldRaw ?? {}) as Record<string, number>;

    for (const it of list) {
      const tier = tiers.find((t) => t.key === it.ticketKey);
      if (!tier || typeof tier.units !== 'number' || tier.units <= 0) continue;
      const remaining = Math.max(0, tier.units - (sold[it.ticketKey!] ?? 0));
      if (it.qty > remaining) return { ticketKey: it.ticketKey!, remaining };
    }
  }
  return null;
}
