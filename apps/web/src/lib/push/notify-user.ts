// 특정 회원의 모든 기기로 푸시를 보낸다. 서버 전용.
// 남의 구독 행을 읽어야 하므로 service_role 클라이언트를 쓴다(RLS 우회).
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPush, pushConfigured, type PushPayload, type PushSubscriptionRow } from './webpush';

/**
 * @returns 실제로 전송에 성공한 기기 수. 설정 미비/구독 없음이면 0.
 *          호출부의 본 흐름(하트 주기 등)을 막지 않도록 예외를 던지지 않는다.
 */
export async function notifyUser(userId: string, payload: PushPayload): Promise<number> {
  if (!pushConfigured()) return 0;
  const admin = createAdminClient();
  if (!admin) return 0;

  const { data } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId);

  const subs = (data ?? []) as PushSubscriptionRow[];
  if (subs.length === 0) return 0;

  const results = await Promise.all(subs.map((s) => sendPush(s, payload)));

  // 만료된 구독은 지운다 — 안 지우면 매번 실패 요청을 반복하게 된다.
  const gone = subs.filter((_, i) => results[i] === 'gone').map((s) => s.id);
  if (gone.length > 0) {
    await admin.from('push_subscriptions').delete().in('id', gone);
  }

  const ok = subs.filter((_, i) => results[i] === 'ok').map((s) => s.id);
  if (ok.length > 0) {
    await admin
      .from('push_subscriptions')
      .update({ last_used_at: new Date().toISOString(), fail_count: 0 })
      .in('id', ok);
  }

  return ok.length;
}
