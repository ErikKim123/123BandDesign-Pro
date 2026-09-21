// 오거나이저 이메일 승인 링크용 서명 토큰 (HMAC). 서버 전용.
// 비밀키: APPROVAL_SECRET 우선, 없으면 SUPABASE_SERVICE_ROLE_KEY 재사용.
import { createHmac, timingSafeEqual } from 'crypto';

function secret(): string {
  return process.env.APPROVAL_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

/** uid 에 대한 승인 토큰. 비밀키 미설정이면 null(링크 미생성). */
export function signApproval(uid: string): string | null {
  const s = secret();
  if (!s || !uid) return null;
  return createHmac('sha256', s).update(`approve:${uid}`).digest('hex');
}

export function verifyApproval(uid: string, token: string): boolean {
  const expected = signApproval(uid);
  if (!expected || !token) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
