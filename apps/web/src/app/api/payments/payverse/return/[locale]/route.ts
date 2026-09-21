// Design Ref: §5 Phase 4 — PayVerse 결제창 복귀 지점(모바일 리다이렉트).
// PayVerse 는 returnUrl 뒤에 '?resultStatus=...&tid=...&orderId=...' 를 그대로 이어붙인다.
// → returnUrl 에는 쿼리를 둘 수 없어 locale 을 경로 세그먼트로 받는다.
//
// 여기서 결과 파라미터를 신뢰하지 않고 거래조회로 확정한 뒤, 완료 페이지로 리다이렉트한다.
import { NextResponse } from 'next/server';
import { siteOrigin } from '@/lib/payments/config';
import { confirmPayverseOrder } from '@/lib/payments/payverse-confirm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: { locale: string };
}

/** 결제창이 GET(리다이렉트)/POST(폼) 어느 쪽으로 돌아와도 같은 처리로 모은다. */
async function handle(req: Request, ctx: Ctx): Promise<Response> {
  const locale = ctx.params.locale === 'ko' ? 'ko' : 'en';
  const url = new URL(req.url);

  // POST 로 오는 경우 본문(폼/JSON)에도 결과가 담긴다 — 쿼리를 우선하고 본문으로 보완.
  let bodyParams: Record<string, string> = {};
  if (req.method === 'POST') {
    try {
      const ct = req.headers.get('content-type') ?? '';
      if (ct.includes('json')) {
        bodyParams = (await req.json()) as Record<string, string>;
      } else {
        bodyParams = Object.fromEntries((await req.formData()) as unknown as Iterable<[string, string]>);
      }
    } catch {
      /* 본문 없으면 쿼리만으로 처리 */
    }
  }
  const pick = (k: string) => url.searchParams.get(k) ?? bodyParams[k] ?? null;

  const orderNo = pick('orderId');
  const tid = pick('tid');
  const resultStatus = pick('resultStatus');
  const resultMessage = pick('resultMessage');

  const base = siteOrigin(url.origin);
  const success = new URL(`${base}/${locale}/checkout/success`);
  if (orderNo) success.searchParams.set('order', orderNo);

  if (!orderNo) {
    success.searchParams.set('fail', '1');
    if (resultMessage) success.searchParams.set('msg', resultMessage);
    return NextResponse.redirect(success, 303);
  }

  try {
    const result = await confirmPayverseOrder({ orderNo, tid });
    if (!result.ok) {
      if (result.reason === 'pending') {
        success.searchParams.set('pending', '1');
      } else if (result.reason === 'card_blocked') {
        success.searchParams.set('fail', '1');
        success.searchParams.set('blocked', result.refunded ? 'card' : 'card_hold');
      } else {
        success.searchParams.set('fail', '1');
        if (resultMessage) success.searchParams.set('msg', resultMessage);
      }
    }
  } catch {
    // 확정 중 오류 — 웹훅이 보강한다. 완료 페이지가 주문 상태를 다시 읽어 판단한다.
    if (resultStatus && resultStatus !== 'SUCCESS') success.searchParams.set('fail', '1');
  }

  return NextResponse.redirect(success, 303);
}

export const GET = (req: Request, ctx: Ctx) => handle(req, ctx);
export const POST = (req: Request, ctx: Ctx) => handle(req, ctx);
