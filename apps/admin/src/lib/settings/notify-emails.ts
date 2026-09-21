// 운영자 알림 메일 수신자 — app_settings['notify.admin_emails'] 한 곳에서 관리한다.
//
// 지금까지 수신자는 ADMIN_NOTIFY_EMAIL 환경변수였다. 사람이 바뀔 때마다 Vercel 세 곳(web·
// admin·partner)의 값을 고치고 재배포해야 했고, 고쳤는지 확인할 방법도 없었다. 설정 화면에
// 넣으면 운영자가 직접 보고 고친다.
//
// 저장은 app_settings RLS(is_admin) 를 따르므로 관리자 세션 클라이언트로만 쓴다.
// 읽기는 발송하는 쪽(packages/shared/notify.ts)이 서비스 키로 따로 읽는다 —
// 그쪽은 RLS 를 지나갈 수 없는 서버 경로다.
import type { SupabaseClient } from '@supabase/supabase-js';

export const NOTIFY_EMAILS_KEY = 'notify.admin_emails';

/** 칸 수. 늘려도 읽는 쪽은 그대로 동작한다(배열을 그대로 쓴다). */
export const NOTIFY_EMAIL_SLOTS = 5;

/** 저장된 수신자 목록. 없으면 빈 배열 — 그때는 발송 쪽이 환경변수로 폴백한다. */
export async function readNotifyEmails(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', NOTIFY_EMAILS_KEY)
    .maybeSingle();
  if (error) throw new Error(`설정을 불러오지 못했습니다: ${error.message}`);
  const v = (data?.value ?? {}) as { emails?: unknown };
  return Array.isArray(v.emails) ? v.emails.filter((e): e is string => typeof e === 'string') : [];
}

/** 빈 칸·중복·공백을 걷어내고 저장한다. 전부 비우면 '설정 안 함'(환경변수로 폴백). */
export async function writeNotifyEmails(
  supabase: SupabaseClient,
  input: string[],
): Promise<string[]> {
  const seen = new Set<string>();
  for (const raw of input) {
    const email = String(raw ?? '').trim().toLowerCase();
    // 형식은 느슨하게만 본다 — 여기서 엄격히 막아 봐야 오타는 못 걸러낸다.
    if (email.includes('@')) seen.add(email);
  }
  const emails = [...seen].slice(0, NOTIFY_EMAIL_SLOTS);
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: NOTIFY_EMAILS_KEY, value: { emails }, updated_at: new Date().toISOString() });
  if (error) throw new Error(`설정을 저장하지 못했습니다: ${error.message}`);
  return emails;
}
