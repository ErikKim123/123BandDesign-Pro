// 123Band ↔ J&J Dash 관객 심사 SSO 토큰.
//
// 왜 필요한가: 관객 심사위원은 Dash 에서 이름·전화·이메일·PIN 을 직접 등록해야 채점할 수 있다.
// 123Band 회원은 그 정보를 우리가 이미 갖고 있으므로, 서명한 토큰 하나로 넘겨 등록·로그인을 건너뛴다.
//
// 왜 PIN 을 URL 에 싣지 않는가: 링크가 새면 그 사람 이름으로 채점할 수 있게 된다.
// 대신 '누구인지'만 서명해 보내고, 계정 생성·PIN 발급은 Dash 가 자기 쪽에서 한다.
//
// 이 파일은 Dash 저장소에도 같은 내용으로 있어야 한다 — 양쪽이 같은 규칙으로 만들고 검증한다.
import { createHmac, timingSafeEqual } from 'node:crypto';

/** 토큰이 살아 있는 시간. 클릭 직후 한 번 쓰이고 버려지는 값이라 짧게 잡는다. */
export const JNJ_SSO_TTL_SEC = 120;

export interface JnjSsoPayload {
  /** 계정을 찾는 열쇠. Dash 의 audience_judges.email_key 와 맞춘다. */
  email: string;
  /** 전체 이름 그대로. first/last 분리는 Dash 쪽 규칙(splitFullName)에 맡긴다 —
   *  같은 규칙을 두 곳에 두면 언젠가 갈라진다. */
  name: string;
  phone: string;
  /** 국가 표기(Dash 의 representative) */
  country: string;
  photoUrl: string;
  /** 어느 대회로 들어가는지 — 토큰을 다른 대회에 돌려쓰지 못하게 서명에 포함한다. */
  contestId: string;
  /** 발급 시각(초). 만료 판정용. */
  iat: number;
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function sign(body: string, secret: string): string {
  return base64url(createHmac('sha256', secret).update(body).digest());
}

/** 토큰 발급 — `{payload}.{서명}` */
export function createJnjSsoToken(payload: JnjSsoPayload, secret: string): string {
  const body = base64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  return `${body}.${sign(body, secret)}`;
}

export type JnjSsoResult =
  | { ok: true; payload: JnjSsoPayload }
  | { ok: false; reason: 'MALFORMED' | 'BAD_SIGNATURE' | 'EXPIRED' | 'CONTEST_MISMATCH' };

/**
 * 토큰 검증. 서명·만료·대회 일치까지 본다.
 * 서명 비교는 timingSafeEqual — 길이가 다르면 그 자체로 불일치다.
 */
export function verifyJnjSsoToken(
  token: string,
  secret: string,
  contestId: string,
  nowSec = Math.floor(Date.now() / 1000),
): JnjSsoResult {
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return { ok: false, reason: 'MALFORMED' };
  const body = token.slice(0, dot);
  const given = token.slice(dot + 1);

  const expected = sign(body, secret);
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'BAD_SIGNATURE' };

  let payload: JnjSsoPayload;
  try {
    payload = JSON.parse(fromBase64url(body).toString('utf8')) as JnjSsoPayload;
  } catch {
    return { ok: false, reason: 'MALFORMED' };
  }
  if (!payload?.email || typeof payload.iat !== 'number') return { ok: false, reason: 'MALFORMED' };
  // 시계가 조금 앞서 있을 수 있어 미래 쪽으로 30초 여유를 준다.
  if (payload.iat > nowSec + 30 || nowSec - payload.iat > JNJ_SSO_TTL_SEC) {
    return { ok: false, reason: 'EXPIRED' };
  }
  if (payload.contestId !== contestId) return { ok: false, reason: 'CONTEST_MISMATCH' };
  return { ok: true, payload };
}
