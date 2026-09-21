// 구매확인 메일 — 결제확정 시 구매자에게 1회 자동 발송하고, 오거나이저가 수동 재발송할 수도 있다.
//
// QR 을 메일에 넣지 않는 이유(중요):
//   입장 QR 값은 passes.redemption_secret 이고, RLS 로 '현재 소유자와 운영자만' 읽을 수 있다(0026).
//   메일은 전달·캡처·검색이 쉬운 매체라 시크릿을 실으면 그 통제가 통째로 무너진다. 더구나 선물(양도)
//   시 시크릿이 회전되는데(이전 소유자 QR 즉시 무효화) 메일에 박힌 이미지는 회전을 따라가지 못해
//   '메일 속 QR 은 되는데 화면 QR 은 안 된다' 같은 모순이 생긴다.
//   → 메일에는 '어디서 어떻게 QR 을 여는지'만 적고, 실제 QR 은 항상 로그인한 주문내역 화면에서 연다.
import { sendUserEmail } from './notify';
import { tryRenderTemplate } from './mail-template';

export type MailLocale = 'en' | 'ko';

export interface OrderMailItem {
  /** 사람이 읽는 이름. 티켓이면 '행사명 — 패스명'. */
  name: string;
  qty: number;
}

export interface OrderConfirmationInput {
  orderNo: string;
  locale: MailLocale;
  buyerEmail: string;
  buyerName?: string | null;
  /** 통화 기호까지 포함해 완성된 금액 문자열 (예: 'US$215.00') */
  amountText: string;
  /** 결제수단 표시명 (예: '카드', 'Bank transfer') */
  methodLabel?: string | null;
  /** 결제 일시 표시 문자열 (KST). 없으면 줄을 생략한다. */
  paidAtText?: string | null;
  items: OrderMailItem[];
  /** 티켓이 한 건이라도 있으면 QR 입장 안내를 붙인다. */
  hasTicket: boolean;
  /** 주문내역(마이페이지) 절대 URL — QR 을 여는 곳 */
  ordersUrl: string;
  /** 오거나이저가 다시 보낸 메일이면 제목에 표시한다. */
  resend?: boolean;
}

const T = {
  ko: {
    subject: (no: string) => `[123Band] 구매가 완료되었습니다 · ${no}`,
    subjectResend: (no: string) => `[123Band] 구매 확인서 (재발송) · ${no}`,
    hi: (name: string | null) => (name ? `${name}님, 구매해 주셔서 감사합니다.` : '구매해 주셔서 감사합니다.'),
    lead: '아래 내용으로 결제가 완료되었습니다.',
    orderNo: '주문번호',
    paidAt: '결제일시',
    method: '결제수단',
    amount: '결제금액',
    items: '주문 내역',
    ticketTitle: '입장은 QR 코드로 합니다',
    ticketSteps: [
      '행사 당일 <b>주문내역 화면</b>을 열어 QR 코드를 띄웁니다.',
      '입구에서 오거나이저에게 <b>화면을 그대로 보여주세요.</b> 스캔하면 입장 처리됩니다.',
      '티켓을 여러 장 사셨다면 <b>1장당 QR 이 각각</b> 있습니다. 함께 입장하는 분마다 한 장씩 스캔합니다.',
    ],
    ticketWarnTitle: '꼭 알아두세요',
    ticketWarns: [
      '<b>QR 은 이 메일에 담지 않습니다.</b> 캡처본이 돌면 다른 사람이 대신 입장할 수 있어서, 로그인한 본인 화면에서만 열립니다.',
      '티켓을 <b>선물하면 QR 이 새로 바뀝니다.</b> 예전에 찍어둔 화면은 입장되지 않으니, 현장에서는 스크린샷 말고 <b>화면을 새로 열어</b> 보여주세요.',
      '입장이 끝난 QR 은 <b>사용 완료</b>로 표시되고 다시 쓸 수 없습니다.',
    ],
    cta: '주문내역에서 QR 열기',
    ctaPlain: '주문내역 바로가기',
    footerHelp: '문의는 이 메일에 그대로 답장해 주세요.',
    resendNote: '오거나이저가 이 확인서를 다시 보냈습니다. 이미 받으셨다면 무시하셔도 됩니다.',
  },
  en: {
    subject: (no: string) => `[123Band] Your order is confirmed · ${no}`,
    subjectResend: (no: string) => `[123Band] Order confirmation (resent) · ${no}`,
    hi: (name: string | null) => (name ? `${name}, thank you for your purchase.` : 'Thank you for your purchase.'),
    lead: 'Your payment has been completed.',
    orderNo: 'Order number',
    paidAt: 'Paid at',
    method: 'Payment method',
    amount: 'Total paid',
    items: 'Order details',
    ticketTitle: 'You get in with a QR code',
    ticketSteps: [
      'On the event day, open your <b>order history</b> to bring up the QR code.',
      '<b>Show the screen</b> to the organizer at the entrance. Scanning it checks you in.',
      'If you bought several tickets, <b>each ticket has its own QR</b>. One scan per person entering.',
    ],
    ticketWarnTitle: 'Please note',
    ticketWarns: [
      '<b>The QR is not included in this email.</b> A forwarded screenshot would let someone else walk in, so it only opens on your own signed-in screen.',
      'If you <b>gift a ticket, its QR is replaced.</b> An old screenshot will not scan — open the screen fresh at the venue instead.',
      'Once used, a QR is marked <b>used</b> and cannot be scanned again.',
    ],
    cta: 'Open the QR in your orders',
    ctaPlain: 'Go to order history',
    footerHelp: 'Just reply to this email if you need help.',
    resendNote: 'The organizer sent this confirmation again. If you already have it, you can ignore this.',
  },
} as const;

/** HTML 주입 방지 — 상품명/주문번호는 DB 에서 오므로 그대로 넣지 않는다. */
function esc(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function row(label: string, value: string): string {
  return `<tr><td style="padding:6px 12px 6px 0;color:#8a8a8a;white-space:nowrap;vertical-align:top">${esc(label)}</td><td style="padding:6px 0;color:#1a1a1a;font-weight:600">${esc(value)}</td></tr>`;
}

/** 구매확인 메일 본문. 티켓이 없는 주문이면 QR 안내 블록은 통째로 빠진다. */
export function buildOrderConfirmationEmail(input: OrderConfirmationInput): {
  subject: string;
  html: string;
  text: string;
} {
  const t = T[input.locale];
  const subject = input.resend ? t.subjectResend(input.orderNo) : t.subject(input.orderNo);

  const infoRows = [
    row(t.orderNo, input.orderNo),
    ...(input.paidAtText ? [row(t.paidAt, input.paidAtText)] : []),
    ...(input.methodLabel ? [row(t.method, input.methodLabel)] : []),
    row(t.amount, input.amountText),
  ].join('');

  const itemRows = (input.items.length ? input.items : [{ name: '—', qty: 1 }])
    .map(
      (it) =>
        `<tr><td style="padding:8px 0;border-top:1px solid #eee;color:#1a1a1a">${esc(it.name)}</td>` +
        `<td style="padding:8px 0;border-top:1px solid #eee;color:#666;text-align:right;white-space:nowrap">× ${it.qty}</td></tr>`,
    )
    .join('');

  const li = (s: string) => `<li style="margin:6px 0">${s}</li>`;
  const ticketBlock = input.hasTicket
    ? `
      <div style="margin:28px 0 0;padding:18px;border:1px solid #ffd9c7;border-radius:12px;background:#fff8f4">
        <p style="margin:0 0 10px;font-size:16px;font-weight:700;color:#1a1a1a">${esc(t.ticketTitle)}</p>
        <ol style="margin:0;padding-left:20px;color:#3a3a3a">${t.ticketSteps.map(li).join('')}</ol>
        <p style="margin:16px 0 6px;font-size:13px;font-weight:700;color:#1a1a1a">${esc(t.ticketWarnTitle)}</p>
        <ul style="margin:0;padding-left:20px;color:#3a3a3a;font-size:13px">${t.ticketWarns.map(li).join('')}</ul>
        <p style="margin:18px 0 0">
          <a href="${esc(input.ordersUrl)}" style="display:inline-block;background:#ff5a1f;color:#fff;text-decoration:none;padding:12px 22px;border-radius:24px;font-weight:700">${esc(t.cta)}</a>
        </p>
      </div>`
    : `
      <p style="margin:24px 0 0">
        <a href="${esc(input.ordersUrl)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:11px 20px;border-radius:24px;font-weight:600">${esc(t.ctaPlain)}</a>
      </p>`;

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.65;color:#1a1a1a;max-width:560px;margin:0 auto;padding:8px">
  <p style="margin:0 0 4px;font-size:17px;font-weight:700">${esc(t.hi(input.buyerName ?? null))}</p>
  <p style="margin:0 0 20px;color:#5a5a5a">${esc(t.lead)}</p>
  ${input.resend ? `<p style="margin:0 0 18px;padding:10px 12px;border-radius:8px;background:#f4f4f4;color:#5a5a5a;font-size:13px">${esc(t.resendNote)}</p>` : ''}
  <table style="width:100%;border-collapse:collapse;font-size:14px">${infoRows}</table>
  <p style="margin:24px 0 4px;font-size:13px;font-weight:700;color:#8a8a8a;letter-spacing:.06em;text-transform:uppercase">${esc(t.items)}</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px">${itemRows}</table>
  ${ticketBlock}
  <p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #eee;color:#9a9a9a;font-size:12px">${esc(t.footerHelp)}</p>
</div>`;

  // 텍스트 대체본 — HTML 을 막아 둔 클라이언트에서도 핵심 정보와 링크가 남아야 한다.
  const strip = (s: string) => s.replace(/<[^>]+>/g, '');
  const text = [
    strip(t.hi(input.buyerName ?? null)),
    t.lead,
    ...(input.resend ? ['', t.resendNote] : []),
    '',
    `${t.orderNo}: ${input.orderNo}`,
    ...(input.paidAtText ? [`${t.paidAt}: ${input.paidAtText}`] : []),
    ...(input.methodLabel ? [`${t.method}: ${input.methodLabel}`] : []),
    `${t.amount}: ${input.amountText}`,
    '',
    `${t.items}:`,
    ...input.items.map((it) => `  - ${it.name} x ${it.qty}`),
    ...(input.hasTicket
      ? ['', t.ticketTitle, ...t.ticketSteps.map((s, i) => `  ${i + 1}. ${strip(s)}`), '', t.ticketWarnTitle, ...t.ticketWarns.map((s) => `  - ${strip(s)}`)]
      : []),
    '',
    `${input.hasTicket ? t.cta : t.ctaPlain}: ${input.ordersUrl}`,
    '',
    t.footerHelp,
  ].join('\n');

  return { subject, html, text };
}

/**
 * 구매확인 메일 발송. best-effort — 실패해도 예외를 던지지 않는다.
 * 결제 확정 경로에서 불리므로 메일 실패가 주문을 되돌리면 안 된다.
 */
export async function sendOrderConfirmationEmail(input: OrderConfirmationInput): Promise<boolean> {
  if (!input.buyerEmail || !input.buyerEmail.includes('@')) return false;
  // 탈퇴 회원은 이메일이 deleted+...@deleted.invalid 로 익명화된다 — 보낼 곳이 없다.
  if (input.buyerEmail.endsWith('@deleted.invalid')) return false;

  // 어드민 '메일링 관리'의 템플릿이 있으면 그걸로. 없으면 아래 하드코딩 본문(폴백).
  const tpl = await tryRenderTemplate('user_order_confirmation', orderMailVars(input), input.locale);
  if (tpl) {
    return sendUserEmail(input.buyerEmail, tpl.subject, wrapUserHtml(tpl.html), stripHtml(tpl.html));
  }

  const { subject, html, text } = buildOrderConfirmationEmail(input);
  return sendUserEmail(input.buyerEmail, subject, html, text);
}

/** 구매자 메일 공통 껍데기(폰트·폭). 템플릿 본문은 '안쪽'만 담는다. */
export function wrapUserHtml(inner: string): string {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.65;color:#1a1a1a;max-width:560px;margin:0 auto;padding:8px">${inner}</div>`;
}

/** HTML 을 막아 둔 메일 클라이언트용 텍스트 대체본. */
export function stripHtml(html: string): string {
  return html
    .replace(/<li[^>]*>/g, '\n  - ')
    .replace(/<\/(p|div|tr|li|h[1-6])>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 템플릿에 넘길 변수 묶음 — 0088 시드의 variables 정의와 이름이 일치해야 한다. */
export function orderMailVars(input: OrderConfirmationInput): Record<string, unknown> {
  return {
    orderNo: input.orderNo,
    buyerName: input.buyerName ?? '',
    amountText: input.amountText,
    methodLabel: input.methodLabel ?? '',
    paidAtText: input.paidAtText ?? '',
    items: input.items,
    hasTicket: input.hasTicket,
    resend: !!input.resend,
    ordersUrl: input.ordersUrl,
  };
}
