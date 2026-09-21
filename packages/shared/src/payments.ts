// PayVerse(이롬넷) 서버 모듈 — web(결제 요청·확정)과 admin(환불)이 함께 쓴다.
// ⚠️ 서버 전용. node:crypto 를 쓰므로 클라이언트 번들에 들어가면 안 된다.
//    그래서 index.ts 가 아니라 '@123band/shared/payments' 서브패스로만 노출한다.
//
// sign = SHA-512( '||secretKey||...필드...||' ) hex 128자.
//   결제창 : ||secretKey||mid||orderId||amount||reqDate||
//   취소   : ||secretKey||mid||amount||reqDate||
//   웹훅   : ||secretKey||mid||orderId||requestAmount||approvalDay||  (취소는 cancelDay)
// 해시 방식은 공식 문서에 없다 — 실측으로 확정한 값이니 바꾸지 말 것.
import { createHash } from 'node:crypto';
import { toDisplayAmount } from './prices';
import type { Currency } from './types/index';

// ── 환경/가맹점 ─────────────────────────────────────────────

/** 샌드박스(테스트) / 운영 전환. 값이 'live' 일 때만 운영. */
export type PayverseEnv = 'sandbox' | 'live';

const HOSTS = {
  sandbox: {
    sdk: 'https://ui-snd.payverseglobal.com/js/payments.js',
    api: 'https://pay-snd.payverseglobal.com',
  },
  live: {
    sdk: 'https://ui.payverseglobal.com/js/payments.js',
    api: 'https://pay.payverseglobal.com',
  },
} as const;

/**
 * 가맹점이 붙을 환경. 통화별로 따로 정할 수 있다 — 가맹점(mid)마다 실계약 시점이 다르기 때문이다.
 * KRW 는 운영, USD 는 아직 테스트 같은 상태가 실제로 존재한다.
 *   PAYVERSE_ENV_KRW / PAYVERSE_ENV_USD 가 있으면 그걸, 없으면 공통 PAYVERSE_ENV 를 쓴다.
 * 어느 쪽도 'live' 가 아니면 샌드박스 — 실수로 운영에 붙는 일은 없게 기본값을 안전한 쪽에 둔다.
 */
export function payverseEnv(suffix?: 'KRW' | 'USD'): PayverseEnv {
  const v = (suffix ? process.env[`PAYVERSE_ENV_${suffix}`] : undefined) ?? process.env.PAYVERSE_ENV;
  return v === 'live' ? 'live' : 'sandbox';
}

/** 브라우저가 로드할 결제창 SDK 주소(환경별). */
export const payverseSdkUrl = (env: PayverseEnv = payverseEnv()): string => HOSTS[env].sdk;

/** 서버 REST API 베이스(조회/취소). */
export const payverseApiBase = (env: PayverseEnv = payverseEnv()): string => HOSTS[env].api;

export interface PayverseMerchant {
  mid: string;
  clientKey: string;
  /** 서버 전용 — 위변조 서명(sign) 생성에만 쓰고 브라우저로 절대 내보내지 않는다. */
  secretKey: string;
  currency: Currency;
  /** 이 가맹점이 붙는 환경. 키와 호스트가 어긋나면 결제창이 통째로 거절하므로 함께 들고 다닌다. */
  env: PayverseEnv;
}

/** 통화 → 가맹점 키 접미사. KRW 외(USD)는 해외 가맹점. */
const suffixFor = (currency: Currency): 'KRW' | 'USD' => (currency === 'KRW' ? 'KRW' : 'USD');

function readMerchant(suffix: 'KRW' | 'USD'): PayverseMerchant | null {
  const mid = process.env[`PAYVERSE_MID_${suffix}`] ?? '';
  const clientKey = process.env[`PAYVERSE_CLIENT_KEY_${suffix}`] ?? '';
  const secretKey = process.env[`PAYVERSE_SECRET_KEY_${suffix}`] ?? '';
  if (!mid || !clientKey || !secretKey) return null;
  return { mid, clientKey, secretKey, currency: suffix as Currency, env: payverseEnv(suffix) };
}

/** 결제 통화에 맞는 가맹점 정보. 하나라도 env 가 비면 null(=결제 불가). */
export function payverseMerchant(currency: Currency): PayverseMerchant | null {
  return readMerchant(suffixFor(currency));
}

/** 웹훅은 통화 대신 mid 로 도착한다 → mid 로 가맹점을 되찾는다. */
export function payverseMerchantByMid(mid: string): PayverseMerchant | null {
  for (const suffix of ['KRW', 'USD'] as const) {
    const m = readMerchant(suffix);
    if (m && m.mid === mid) return m;
  }
  return null;
}

// ── 서명/포맷 ───────────────────────────────────────────────

/** '||a||b||c||' 규칙으로 이어붙인 뒤 SHA-512 hex(128자). */
export function payverseSign(parts: (string | number)[]): string {
  const data = `||${parts.join('||')}||`;
  return createHash('sha512').update(data, 'utf8').digest('hex');
}

/** 결제요청 일시 yyyymmddhh24miss (KST 고정 — 국내 PG 기준 시각). */
export function payverseReqDate(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${kst.getUTCFullYear()}${p(kst.getUTCMonth() + 1)}${p(kst.getUTCDate())}` +
    `${p(kst.getUTCHours())}${p(kst.getUTCMinutes())}${p(kst.getUTCSeconds())}`
  );
}

/** yyyymmdd (KST) — orderId 조회 API 의 date 파라미터용. */
export const payverseReqDay = (now: Date = new Date()): string => payverseReqDate(now).slice(0, 8);

/**
 * 최소단위 정수 → PayVerse requestAmount 문자열.
 * PayVerse 는 소수 둘째자리까지의 Decimal 을 받고, 마지막 자리 '0' 은 제거해야 한다.
 *   KRW 10000 → "10000",  USD 1050 → "10.5",  USD 1009 → "10.09"
 */
export function payverseAmount(minor: number, currency: Currency): string {
  const display = toDisplayAmount(minor, currency);
  return String(Number(display.toFixed(2)));
}

/** requestAmount 문자열 → 최소단위 정수(주문 금액 대조용). */
export function payverseAmountToMinor(amount: string | number, currency: Currency): number {
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 10 ** (currency === 'USD' ? 2 : 0));
}

// ── 거래조회 ────────────────────────────────────────────────

/** GET /payment/search/transaction/{tid} 응답 (필요한 필드만). */
export interface PayverseTransaction {
  resultStatus: string; // 조회 자체의 성공 여부 (SUCCESS | FAILED)
  resultMessage: string;
  tid: string;
  orderId: string | null;
  /** 거래 처리 결과 — SUCCESS | PROCESSING | PENDING | DECLINE | FAILED */
  transactionStatus: string | null;
  transactionType: string | null; // 승인/취소 구분
  requestCurrency: string | null;
  requestAmount: string | number | null;
  schemeGroup: string | null;
  schemeCode: string | null;
  approvalNo: string | null;
}

export function payverseAuthHeaders(m: PayverseMerchant): Record<string, string> {
  return { mid: m.mid, clientKey: m.clientKey, 'Content-Type': 'application/json' };
}

/**
 * TID 로 거래 단건 조회. 결제 확정 전 반드시 이걸로 금액/통화/상태를 재확인한다.
 * merchant 를 못 찾거나(=env 미설정) 통신 실패면 null.
 */
export async function getPayverseTransaction(
  currency: Currency,
  tid: string,
): Promise<PayverseTransaction | null> {
  const m = payverseMerchant(currency);
  if (!m) return null;

  const res = await fetch(
    `${payverseApiBase(m.env)}/payment/search/transaction/${encodeURIComponent(tid)}`,
    { headers: payverseAuthHeaders(m), cache: 'no-store' },
  );
  if (!res.ok && res.status !== 400) {
    throw new Error(`PayVerse 거래조회 실패 (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as PayverseTransaction;
}

/**
 * 가맹점 주문번호(order_no)로 조회 — TID 를 놓친 경우(웹훅 유실·복귀 파라미터 누락)의 보조 경로.
 * date 는 거래 요청 일자(yyyymmdd, KST).
 */
export async function getPayverseTransactionByOrderId(
  currency: Currency,
  orderId: string,
  date: string,
): Promise<PayverseTransaction | null> {
  const m = payverseMerchant(currency);
  if (!m) return null;

  const url =
    `${payverseApiBase(m.env)}/payment/search/orderId/${encodeURIComponent(orderId)}` +
    `?date=${encodeURIComponent(date)}`;
  const res = await fetch(url, { headers: payverseAuthHeaders(m), cache: 'no-store' });
  if (!res.ok && res.status !== 400) return null;
  return (await res.json()) as PayverseTransaction;
}

/** 조회 결과가 '승인 완료된 결제'인지. 금액/통화까지 주문과 일치해야 true. */
export function isPaidTransaction(
  tx: PayverseTransaction | null,
  expect: { currency: Currency; totalMinor: number },
): boolean {
  if (!tx || tx.resultStatus !== 'SUCCESS') return false;
  if (tx.transactionStatus !== 'SUCCESS') return false;
  if (tx.requestCurrency !== expect.currency) return false;
  if (tx.requestAmount == null) return false;
  return payverseAmountToMinor(tx.requestAmount, expect.currency) === expect.totalMinor;
}

// ── 취소/환불 ───────────────────────────────────────────────

export interface CancelResult {
  ok: boolean;
  resultStatus?: string;
  resultCode?: string;
  resultMessage?: string;
}

/**
 * 승인 거래 취소/환불. amountMinor 가 승인금액보다 작으면 부분취소로 처리된다.
 * sign 규칙이 결제창과 다르다(orderId 없음) — ||secretKey||mid||amount||reqDate||
 */
export async function cancelPayversePayment(params: {
  currency: Currency;
  tid: string;
  amountMinor: number;
  reason?: string;
  worker?: string;
}): Promise<CancelResult> {
  const m = payverseMerchant(params.currency);
  if (!m) return { ok: false, resultMessage: 'payverse_not_configured' };

  const reqDate = payverseReqDate();
  const amount = payverseAmount(params.amountMinor, params.currency);
  const body = {
    reqDate,
    tid: params.tid,
    currency: params.currency,
    amount,
    ...(params.reason ? { cancelReason: params.reason.slice(0, 255) } : {}),
    ...(params.worker ? { cancelWorker: params.worker.slice(0, 100) } : {}),
    sign: payverseSign([m.secretKey, m.mid, amount, reqDate]),
  };

  const res = await fetch(`${payverseApiBase(m.env)}/payment/cancel`, {
    method: 'POST',
    headers: payverseAuthHeaders(m),
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => ({}))) as CancelResult & { resultStatus?: string };
  return { ...data, ok: res.ok && data.resultStatus === 'SUCCESS' };
}
