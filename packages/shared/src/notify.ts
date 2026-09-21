// 신규 가입(일반/오거나이저/관리자) 시 운영자에게 알림 메일 발송.
// Brevo(Sendinblue) Transactional Email REST API 를 fetch 로 직접 호출 → SDK 의존성 없음.
// 서버 전용으로만 호출할 것(BREVO_API_KEY 는 NEXT_PUBLIC 아님).
// 주의: Supabase 자체 인증메일과 무관 — 운영자 알림은 전적으로 Brevo 로 보낸다.
//
// 필요 env:
//   BREVO_API_KEY      — Brevo API 키 (없으면 조용히 패스 → 가입은 정상 진행)
//   BREVO_FROM_EMAIL   — 발신 주소 (Brevo Senders 에서 검증 완료된 주소, 기본 bandnara123@gmail.com)
//   BREVO_FROM_NAME    — 발신자 이름 (기본 'JNJ JOIN')
//   ADMIN_NOTIFY_EMAIL — 수신자 (기본 bandnara123@gmail.com)
//                        쉼표(,)로 여러 명 지정 가능 — 예: a@x.com, b@y.com

import { DB_SCHEMA } from './supabase/schema';
import { tryRenderTemplate, type MailVars } from './mail-template';

export type SignupKind = 'customer' | 'partner' | 'admin';

const DEFAULT_ADMIN_EMAIL = 'bandnara123@gmail.com';

// 어드민 설정(app_settings['notify.admin_emails'])에 저장된 수신자.
//
// 예전에는 ADMIN_NOTIFY_EMAIL 환경변수뿐이었다. 사람이 바뀔 때마다 Vercel 세 곳을 고치고
// 재배포해야 해서, 설정 화면에서 고칠 수 있게 DB 로 옮겼다. 환경변수는 그대로 폴백으로 남긴다 —
// 설정이 비었거나 DB 를 못 읽어도 메일은 나가야 한다.
//
// app_settings 는 is_admin RLS 라 서비스 키로 읽는다. 키가 없는 앱에서는 조용히 건너뛴다.
let settingsCache: { at: number; emails: string[] } | null = null;
const SETTINGS_CACHE_MS = 60_000;

async function settingsRecipients(): Promise<string[]> {
  if (settingsCache && Date.now() - settingsCache.at < SETTINGS_CACHE_MS) return settingsCache.emails;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];

  let emails: string[] = [];
  try {
    const res = await fetch(
      `${url}/rest/v1/app_settings?key=eq.notify.admin_emails&select=value&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}`, 'Accept-Profile': DB_SCHEMA }, cache: 'no-store' },
    );
    if (res.ok) {
      const rows = (await res.json()) as Array<{ value?: { emails?: unknown } }>;
      const v = rows?.[0]?.value?.emails;
      if (Array.isArray(v)) emails = v.filter((e): e is string => typeof e === 'string');
    }
  } catch {
    emails = [];
  }
  settingsCache = { at: Date.now(), emails };
  return emails;
}

/**
 * 운영자 알림 수신자. 설정 → 환경변수 → 기본 주소 순으로 찾는다.
 * 어느 단계에서도 못 찾으면 기본 주소로 — 알림이 유실되는 쪽이 제일 나쁘다.
 */
async function adminRecipients(): Promise<Array<{ email: string }>> {
  const seen = new Set<string>();
  for (const email of await settingsRecipients()) {
    if (email.includes('@')) seen.add(email.trim().toLowerCase());
  }
  if (seen.size === 0) {
    // ADMIN_NOTIFY_EMAIL 은 쉼표/세미콜론/줄바꿈으로 여러 명을 적을 수 있다.
    for (const raw of (process.env.ADMIN_NOTIFY_EMAIL || '').split(/[,;\n]/)) {
      const email = raw.trim();
      if (email.includes('@')) seen.add(email.toLowerCase());
    }
  }
  if (seen.size === 0) seen.add(DEFAULT_ADMIN_EMAIL);
  return [...seen].map((email) => ({ email }));
}

const KIND_LABEL: Record<SignupKind, string> = {
  customer: '일반',
  partner: '오거나이저',
  admin: '관리자',
};

// 운영자에게 메일 발송 (Brevo). 키 없으면 조용히 패스 → 호출부 흐름을 막지 않는다.
// buttonHtml 이 있으면 본문 하단에 CTA 버튼(예: 승인하기)을 붙인다.
async function sendAdminEmail(subject: string, rows: string[], buttonHtml = ''): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return;
  const to = await adminRecipients();
  const fromEmail = process.env.BREVO_FROM_EMAIL || DEFAULT_ADMIN_EMAIL;
  const fromName = process.env.BREVO_FROM_NAME || 'JNJ JOIN';
  const html = wrapAdminHtml(
    rows.map((r) => `<p style="margin:4px 0">${r}</p>`).join('') + buttonHtml,
  );
  try {
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to,
        subject,
        htmlContent: html,
        textContent: rows.join('\n'),
      }),
    });
  } catch {
    // 알림 실패는 무시
  }
}

/** 운영자 메일 공통 껍데기(폰트·행간). 템플릿 본문은 '안쪽'만 담고 이 래퍼를 공유한다. */
function wrapAdminHtml(inner: string): string {
  return `<div style="font-family:sans-serif;font-size:14px;line-height:1.6">${inner}</div>`;
}

/** 제목·본문이 이미 완성된 운영자 메일을 그대로 보낸다(템플릿 경로). */
async function sendAdminRaw(subject: string, innerHtml: string): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return;
  try {
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: {
          name: process.env.BREVO_FROM_NAME || 'JNJ JOIN',
          email: process.env.BREVO_FROM_EMAIL || DEFAULT_ADMIN_EMAIL,
        },
        to: await adminRecipients(),
        subject,
        htmlContent: wrapAdminHtml(innerHtml),
        textContent: innerHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      }),
    });
  } catch {
    // 알림 실패는 무시
  }
}

/**
 * 운영자 메일 — 어드민 '메일링 관리'의 템플릿이 있으면 그걸로, 없으면 기존 하드코딩 본문으로.
 *
 * 폴백을 남긴 이유는 mail-template.ts 머리말에 적어 뒀다: 템플릿 조회 실패나 비활성이
 * '메일이 안 나감'으로 이어지면 안 된다. 관리 화면은 문구를 바꾸는 곳이지 발송을 끊는 곳이 아니다.
 */
async function sendAdminTemplated(
  key: string,
  vars: MailVars,
  fallback: { subject: string; rows: string[]; button?: string },
): Promise<void> {
  const rendered = await tryRenderTemplate(key, vars, 'ko');
  if (rendered) {
    await sendAdminRaw(rendered.subject, rendered.html);
    return;
  }
  await sendAdminEmail(fallback.subject, fallback.rows, fallback.button ?? '');
}

// 회원에게 직접 보내는 메일(운영자 알림이 아님). 하트 요약 등 본인 활동 알림용.
// 실패해도 예외를 던지지 않는다 — 호출부(cron)가 나머지 수신자 처리를 계속해야 한다.
export async function sendUserEmail(
  to: string,
  subject: string,
  html: string,
  text?: string,
): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey || !to.includes('@')) return false;
  const fromEmail = process.env.BREVO_FROM_EMAIL || DEFAULT_ADMIN_EMAIL;
  const fromName = process.env.BREVO_FROM_NAME || 'JNJ JOIN';
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text ?? html.replace(/<[^>]+>/g, ''),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function notifyAdminSignup(
  kind: SignupKind,
  info: { email: string; name?: string | null; company?: string | null; approveUrl?: string | null },
): Promise<void> {
  const label = KIND_LABEL[kind];
  // 오거나이저 가입 + 승인 링크가 있으면 메일에서 바로 승인할 수 있는 버튼 첨부
  const button =
    kind === 'partner' && info.approveUrl
      ? `<p style="margin:16px 0 4px"><a href="${info.approveUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:24px;font-weight:600">오거나이저 승인하기</a></p>
         <p style="margin:4px 0;color:#888;font-size:12px">버튼을 누르면 해당 오거나이저가 즉시 활성(승인) 처리됩니다.</p>`
      : '';
  await sendAdminTemplated(
    'admin_signup',
    {
      kindLabel: label,
      email: info.email,
      name: info.name ?? '',
      company: info.company ?? '',
      approveUrl: (kind === 'partner' && info.approveUrl) || '',
    },
    {
      subject: `[123Band] 신규 ${label} 가입: ${info.email}`,
      rows: [
        `신규 ${label} 회원이 가입했습니다.`,
        `이메일: ${info.email}`,
        ...(info.name ? [`이름: ${info.name}`] : []),
        ...(info.company ? [`회사: ${info.company}`] : []),
      ],
      button,
    },
  );
}

// 고객이 "송금 완료"를 알렸을 때 운영자 알림 — 누가/무엇을/얼마를 송금했는지.
// 계좌이체·카카오페이·Wise 등 수동 확인 결제에서 고객이 버튼을 누르면 호출된다.
export async function notifyAdminTransfer(info: {
  method: string; // 표시용 결제수단 라벨 (예: '계좌이체/카카오페이', 'Wise')
  customerEmail: string;
  customerName?: string | null;
  customerPhone?: string | null;
  amountText: string; // 표시용 금액(통화 포맷 완료)
  items: Array<{ name: string; qty: number }>;
}): Promise<void> {
  const itemRows = info.items.length
    ? info.items.map((it) => `&nbsp;&nbsp;· ${it.name} × ${it.qty}`)
    : ['&nbsp;&nbsp;· (상품 정보 없음)'];
  const who = info.customerName || info.customerEmail;
  await sendAdminTemplated(
    'admin_transfer',
    {
      method: info.method,
      customerName: info.customerName || '(미입력)',
      customerEmail: info.customerEmail,
      customerPhone: info.customerPhone ?? '',
      amountText: info.amountText,
      items: info.items,
      who,
    },
    {
      subject: `[123Band] 송금 완료 알림: ${who} (${info.amountText})`,
      rows: [
        `고객이 <b>${info.method}</b> 송금을 완료했다고 알렸습니다. 입금 확인 후 주문(티켓)을 발급해 주세요.`,
        `이름: ${info.customerName || '(미입력)'}`,
        `이메일: ${info.customerEmail}`,
        ...(info.customerPhone ? [`연락처: ${info.customerPhone}`] : []),
        `결제수단: ${info.method}`,
        `금액: ${info.amountText}`,
        `주문 내역:`,
        ...itemRows,
      ],
    },
  );
}

// 범용 운영자 경고 메일 — cron 헬스체크 등에서 임의 제목/본문으로 알릴 때.
export async function notifyAdminAlert(subject: string, lines: string[]): Promise<void> {
  await sendAdminTemplated(
    'admin_alert',
    { alertSubject: subject, lines },
    { subject: `[123Band] ${subject}`, rows: lines },
  );
}

// ── 고객 액션 알림 ───────────────────────────────────────────────────────────
// 아래 4종은 "고객이 무언가 했다"를 운영자에게 즉시 알린다. 전부 best-effort —
// 실패해도 예외를 던지지 않으므로 주문/후기/문의 처리 흐름을 막지 않는다.

/** 어드민 해당 화면으로 바로 가는 링크. ADMIN_BASE_URL 이 없으면 링크를 붙이지 않는다. */
/** 어드민 절대 URL — 템플릿은 버튼 HTML 이 아니라 URL 만 받아 자기 마크업을 쓴다. */
function adminUrl(path: string): string {
  const base = (process.env.ADMIN_BASE_URL || '').replace(/\/+$/, '');
  return base ? `${base}${path}` : '';
}

function adminLink(path: string, label: string): string {
  const base = (process.env.ADMIN_BASE_URL || '').replace(/\/+$/, '');
  if (!base) return '';
  return `<p style="margin:16px 0 4px"><a href="${base}${path}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:24px;font-weight:600">${label}</a></p>`;
}

/** 카드(PG) 결제가 확정된 주문. 계좌이체는 별도로 notifyAdminTransfer 가 알린다. */
export async function notifyAdminOrderPaid(info: {
  orderNo: string;
  amountText: string;
  customerEmail?: string | null;
  customerName?: string | null;
  method?: string | null;
  items: Array<{ name: string; qty: number }>;
}): Promise<void> {
  const who = info.customerName || info.customerEmail || '(비회원)';
  const itemRows = info.items.length
    ? info.items.map((it) => `&nbsp;&nbsp;· ${it.name} × ${it.qty}`)
    : ['&nbsp;&nbsp;· (상품 정보 없음)'];
  await sendAdminTemplated(
    'admin_order_paid',
    {
      orderNo: info.orderNo,
      amountText: info.amountText,
      customerName: who,
      customerEmail: info.customerEmail ?? '',
      method: info.method ?? '',
      items: info.items,
      adminUrl: adminUrl('/orders'),
    },
    {
      subject: `[123Band] 결제완료: ${info.orderNo} (${info.amountText})`,
      rows: [
        `카드 결제가 확정되었습니다. 배송·티켓 처리를 진행해 주세요.`,
        `주문번호: ${info.orderNo}`,
        `주문자: ${who}`,
        ...(info.customerEmail ? [`이메일: ${info.customerEmail}`] : []),
        ...(info.method ? [`결제수단: ${info.method}`] : []),
        `금액: ${info.amountText}`,
        `주문 내역:`,
        ...itemRows,
      ],
      button: adminLink('/orders', '주문 확인하기'),
    },
  );
}

/** 상품문의(QnA) 작성 — 답변이 필요한 글이라 방치되지 않게 알린다. */
export async function notifyAdminQna(info: {
  productName: string;
  authorName: string;
  authorEmail?: string | null;
  question: string;
}): Promise<void> {
  await sendAdminTemplated(
    'admin_qna',
    {
      productName: info.productName,
      authorName: info.authorName,
      authorEmail: info.authorEmail ?? '',
      question: info.question.slice(0, 1000),
      adminUrl: adminUrl('/product-qna'),
    },
    {
      subject: `[123Band] 상품문의: ${info.productName}`,
      rows: [
        `고객이 상품문의를 남겼습니다. 답변해 주세요.`,
        `상품: ${info.productName}`,
        `작성자: ${info.authorName}${info.authorEmail ? ` (${info.authorEmail})` : ''}`,
        `내용:`,
        `&nbsp;&nbsp;${escapeHtml(info.question).slice(0, 1000)}`,
      ],
      button: adminLink('/product-qna', '문의 답변하기'),
    },
  );
}

/** 상품후기 작성 — 별점이 낮으면 제목에 표시해 눈에 띄게 한다. */
export async function notifyAdminReview(info: {
  productName: string;
  authorName: string;
  authorEmail?: string | null;
  rating: number;
  content: string;
  updated?: boolean;
}): Promise<void> {
  const stars = '★'.repeat(Math.max(0, info.rating)) + '☆'.repeat(Math.max(0, 5 - info.rating));
  // 3점 이하는 확인이 필요한 후기 — 제목만 보고도 걸러지게 표시한다.
  const flag = info.rating <= 3 ? ' ⚠️' : '';
  await sendAdminTemplated(
    'admin_review',
    {
      productName: info.productName,
      rating: info.rating,
      stars,
      lowRating: info.rating <= 3,
      actionLabel: info.updated ? '수정' : '작성',
      authorName: info.authorName,
      authorEmail: info.authorEmail ?? '',
      content: info.content.slice(0, 1000),
      adminUrl: adminUrl('/product-reviews'),
    },
    {
      subject: `[123Band] 상품후기 ${info.rating}점${flag}: ${info.productName}`,
      rows: [
        `고객이 상품후기를 ${info.updated ? '수정' : '작성'}했습니다.`,
        `상품: ${info.productName}`,
        `별점: ${stars} (${info.rating}/5)`,
        `작성자: ${info.authorName}${info.authorEmail ? ` (${info.authorEmail})` : ''}`,
        `내용:`,
        `&nbsp;&nbsp;${escapeHtml(info.content).slice(0, 1000)}`,
      ],
      button: adminLink('/product-reviews', '후기 확인하기'),
    },
  );
}

/** 쿠폰이 회원에게 발급됨 — 스탬프 카드 완성 또는 포인트 교환. 비용이 나가는 이벤트다. */
export async function notifyAdminCouponIssued(info: {
  source: 'stamp_reward' | 'point_exchange' | string;
  code: string;
  couponName: string;
  discountText: string;
  expiresAt?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  /** 포인트 교환이면 차감된 포인트 */
  pointCost?: number | null;
}): Promise<void> {
  const label = info.source === 'stamp_reward' ? '스탬프 카드 완성' : '포인트 교환';
  const who = info.customerName || info.customerEmail || '(알 수 없음)';
  await sendAdminTemplated(
    'admin_coupon_issued',
    {
      sourceLabel: label,
      customerName: who,
      customerEmail: info.customerEmail ?? '',
      couponName: info.couponName,
      discountText: info.discountText,
      code: info.code,
      pointCost: info.pointCost ? info.pointCost.toLocaleString() : '',
      expiresAt: info.expiresAt ?? '',
    },
    {
      subject: `[123Band] 쿠폰 발급 — ${label}: ${who}`,
      rows: [
        `${label}으로 쿠폰이 발급되었습니다.`,
        `회원: ${who}`,
        ...(info.customerEmail ? [`이메일: ${info.customerEmail}`] : []),
        `쿠폰: ${info.couponName} (${info.discountText})`,
        `발급코드: ${info.code}`,
        ...(info.pointCost ? [`차감 포인트: ${info.pointCost.toLocaleString()} P`] : []),
        ...(info.expiresAt ? [`사용기한: ${info.expiresAt}`] : []),
      ],
    },
  );
}

/** 스탬프 카드 완성 — 포인트 보상이 나갔다. 쿠폰과 마찬가지로 비용이 나가는 이벤트다. */
export async function notifyAdminStampReward(info: {
  points: number;
  balanceAfter?: number | null;
  customerEmail?: string | null;
  customerName?: string | null;
}): Promise<void> {
  const who = info.customerName || info.customerEmail || '(알 수 없음)';
  await sendAdminTemplated(
    'admin_stamp_reward',
    {
      customerName: who,
      customerEmail: info.customerEmail ?? '',
      points: info.points.toLocaleString(),
      balanceAfter: info.balanceAfter != null ? info.balanceAfter.toLocaleString() : '',
      adminUrl: adminUrl('/stamps'),
    },
    {
      subject: `[123Band] 스탬프 카드 완성 — ${who}`,
      rows: [
        `스탬프 카드가 완성되어 포인트가 지급되었습니다.`,
        `회원: ${who}`,
        ...(info.customerEmail ? [`이메일: ${info.customerEmail}`] : []),
        `지급 포인트: ${info.points.toLocaleString()} P`,
        ...(info.balanceAfter != null
          ? [`지급 후 잔액: ${info.balanceAfter.toLocaleString()} P`]
          : []),
      ],
      button: adminLink('/stamps', '스탬프 확인하기'),
    },
  );
}

/** 메일 본문에 고객이 쓴 글을 그대로 넣으므로 태그를 무력화한다. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 회원이 오거나이저 신청을 냈을 때 운영자 알림.
 *
 * 신청은 사람이 심사해야 끝난다 — 아무도 모르는 채로 '심사 중'에 며칠 머물면 그 사람은
 * 행사를 못 연다. 그래서 신청서 내용과 함께 심사 화면 링크를 같이 보낸다.
 */
export async function notifyAdminOrganizerApply(info: {
  email: string;
  name?: string | null;
  company: string;
  country?: string | null;
  contact?: string | null;
  bizNo?: string | null;
  intro?: string | null;
}): Promise<void> {
  const who = info.name ? `${info.name} (${info.email})` : info.email;
  await sendAdminTemplated(
    'admin_organizer_apply',
    {
      company: info.company,
      applicant: who,
      email: info.email,
      name: info.name ?? '',
      country: info.country ?? '',
      contact: info.contact ?? '',
      bizNo: info.bizNo ?? '',
      intro: info.intro ?? '',
      adminUrl: adminUrl('/organizer-contracts'),
    },
    {
      subject: `[123Band] 오거나이저 신청: ${info.company}`,
      rows: [
        `회원이 오거나이저 신청을 냈습니다. 약관 동의까지 마친 상태이니 심사해 주세요.`,
        `회사/단체: ${escapeHtml(info.company)}`,
        `신청자: ${escapeHtml(who)}`,
        ...(info.country ? [`국가: ${escapeHtml(info.country)}`] : []),
        ...(info.contact ? [`연락처: ${escapeHtml(info.contact)}`] : []),
        ...(info.bizNo ? [`사업자번호: ${escapeHtml(info.bizNo)}`] : []),
        ...(info.intro ? [`소개:`, `&nbsp;&nbsp;${escapeHtml(info.intro).slice(0, 1000)}`] : []),
      ],
      button: adminLink('/organizer-contracts', '신청 심사하기'),
    },
  );
}

// 오거나이저가 상품/행사패스 승인을 요청(draft→pending)할 때 운영자 알림.
export async function notifyAdminApproval(info: {
  kind: 'product' | 'eventPass';
  name: string;
  partner?: string | null;
}): Promise<void> {
  const label = info.kind === 'eventPass' ? '행사패스' : '상품';
  await sendAdminTemplated(
    'admin_approval',
    { kindLabel: label, name: info.name, partner: info.partner ?? '' },
    {
      subject: `[123Band] ${label} 승인요청: ${info.name}`,
      rows: [
        `오거나이저가 ${label} 승인을 요청했습니다.`,
        `${label}명: ${info.name}`,
        ...(info.partner ? [`오거나이저: ${info.partner}`] : []),
        `어드민에서 검토 후 승인/반려하세요.`,
      ],
    },
  );
}
