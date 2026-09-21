// 구매확인 메일 수동 재발송 — 파트너 포털 주문 목록의 버튼이 호출한다.
//
// 원래 확인서는 결제확정 시 web 앱(finalize.ts)이 자동으로 1회 보낸다. 스팸함에 들어갔거나
// 구매자가 지웠을 때 오거나이저가 현장에서 직접 다시 보낼 수 있게 하는 경로다.
//
// 권한: requireStaff(로그인 + partner/admin) → seller_order_mail_payload RPC(0087) 가
//   '호출자가 이 주문의 판매자인지'와 '결제완료 이후 주문인지'를 DB 안에서 다시 검증한다.
//   RPC 를 쓰는 이유는 여러 판매자가 섞인 주문에서도 원본과 같은 확인서를 보내기 위해서다
//   (파트너 세션의 RLS 로는 자기 항목만 보여 금액·목록이 원본과 달라진다).
import { NextResponse } from 'next/server';
import {
  pickI18n,
  sendOrderConfirmationEmail,
  toDisplayAmount,
  type Currency,
  type I18n,
  type MailLocale,
} from '@123band/shared';
import { requireStaff } from '@/lib/ai/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WEB_URL = (process.env.NEXT_PUBLIC_WEB_URL ?? 'https://123band-web.vercel.app').replace(
  /\/+$/,
  '',
);

interface PayloadItem {
  qty: number;
  name_i18n: I18n | null;
  ticket_name_i18n: I18n | null;
  product_code: string | null;
  is_ticket: boolean;
}

interface Payload {
  order_no: string;
  payment_method: string | null;
  paid_at: string | null;
  total_amount: number;
  currency: string;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_locale: string;
  has_ticket: boolean;
  items: PayloadItem[];
}

/** 결제수단 코드 → 구매자에게 보여줄 이름. 모르는 코드는 그대로 둔다. */
function methodLabel(method: string | null, locale: MailLocale): string | null {
  const m = (method ?? '').trim();
  if (!m) return null;
  const map: Record<string, { ko: string; en: string }> = {
    card: { ko: '카드', en: 'Card' },
    payverse: { ko: '카드', en: 'Card' },
    portone: { ko: '카드', en: 'Card' },
    transfer: { ko: '계좌이체/송금', en: 'Bank transfer' },
    kakaopay: { ko: '카카오페이', en: 'KakaoPay' },
    wechat: { ko: '위챗페이', en: 'WeChat Pay' },
  };
  return map[m]?.[locale] ?? m;
}

function fmtPaidAt(iso: string | null, locale: MailLocale): string | null {
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

export async function POST(req: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { orderId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }
  const orderId = String(body.orderId ?? '').trim();
  if (!orderId) return NextResponse.json({ error: '주문 ID 가 필요합니다.' }, { status: 400 });

  // 소유·상태 검증은 RPC 안에서 한다. 실패 사유는 errcode 로 구분해 사용자 말로 바꾼다.
  const { data, error } = await auth.supabase.rpc('seller_order_mail_payload', {
    p_order_id: orderId,
  });
  if (error) {
    const msg = `${error.message} ${error.code ?? ''}`;
    if (msg.includes('not_seller')) {
      return NextResponse.json({ error: '이 주문의 판매자가 아닙니다.' }, { status: 403 });
    }
    if (msg.includes('not_payable')) {
      return NextResponse.json(
        { error: '결제가 완료된 주문만 확인서를 보낼 수 있습니다.' },
        { status: 409 },
      );
    }
    // 0087 미적용 환경 — 함수 자체가 없다.
    if (error.code === 'PGRST202' || msg.includes('does not exist')) {
      return NextResponse.json(
        { error: '재발송 기능이 아직 서버에 적용되지 않았습니다 (마이그레이션 0087).' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const p = data as Payload | null;
  if (!p) return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });

  const email = (p.buyer_email ?? '').trim();
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: '구매자 이메일이 없습니다.' }, { status: 422 });
  }
  // 탈퇴 회원은 이메일이 익명화(deleted+...@deleted.invalid)돼 보낼 곳이 없다.
  if (email.endsWith('@deleted.invalid')) {
    return NextResponse.json({ error: '탈퇴한 회원이라 메일을 보낼 수 없습니다.' }, { status: 422 });
  }

  const locale: MailLocale = p.buyer_locale === 'ko' ? 'ko' : 'en';
  const items = (p.items ?? []).map((it) => {
    const base = (it.name_i18n ? pickI18n(it.name_i18n, locale) : '') || it.product_code || (locale === 'ko' ? '(상품)' : '(item)');
    const tier = it.ticket_name_i18n ? pickI18n(it.ticket_name_i18n, locale) : '';
    return { name: tier ? `${base} — ${tier}` : base, qty: Number(it.qty) || 1 };
  });

  const sent = await sendOrderConfirmationEmail({
    orderNo: p.order_no,
    locale,
    buyerEmail: email,
    buyerName: p.buyer_name,
    amountText: `${p.currency} ${toDisplayAmount(p.total_amount, p.currency as Currency).toLocaleString()}`,
    methodLabel: methodLabel(p.payment_method, locale),
    paidAtText: fmtPaidAt(p.paid_at, locale),
    items,
    hasTicket: !!p.has_ticket,
    ordersUrl: `${WEB_URL}/${locale}/account/orders`,
    resend: true,
  });

  if (!sent) {
    // BREVO_API_KEY 미설정이거나 Brevo 가 거절 — 성공으로 위장하면 안 된다.
    return NextResponse.json({ error: '메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 502 });
  }

  // 보낸 사실을 남긴다 — 주문 상세에서 '언제 누가 보냈는지'가 보여야 중복 발송을 피할 수 있다.
  // 기록 실패는 삼킨다: 메일은 이미 나갔고, 기록이 없다고 실패로 되돌릴 수는 없다.
  await auth.supabase
    .from('order_mail_log')
    .insert({
      order_id: orderId,
      kind: 'order_confirmation',
      locale,
      to_email: email,
      sent_by: auth.userId, // 누가 눌렀는지
      source: 'manual',
    })
    .then(
      () => undefined,
      () => undefined,
    );

  return NextResponse.json({ ok: true, orderNo: p.order_no, email });
}
