// 뉴스레터 발송 헬퍼 — Brevo Transactional API(messageVersions 로 1인 1메일) 사용.
// 서버 전용(BREVO_API_KEY). 구독자 전체에게 발송 후 newsletters 행을 sent 로 갱신.
import type { SupabaseClient } from '@supabase/supabase-js';
import { tryRenderTemplate } from '@123band/shared';

// 간단한 이메일 본문 래퍼(컨테이너 + 푸터). content_html 은 작성자가 넣은 HTML.
/**
 * 뉴스레터 머리말·꼬리말 — 어드민 '메일링 관리'의 user_newsletter_wrapper 템플릿이 있으면 그걸 쓴다.
 * 본문(contentHtml)은 뉴스레터 화면에서 작성한 HTML 이라 {{{content}}} 로 이스케이프 없이 꽂는다.
 */
export async function wrapNewsletterHtmlAsync(contentHtml: string, subject = ''): Promise<string> {
  const tpl = await tryRenderTemplate('user_newsletter_wrapper', { content: contentHtml, subject }, 'ko');
  if (tpl) {
    return `<div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#1a1a1a">${tpl.html}</div>`;
  }
  return wrapNewsletterHtml(contentHtml);
}

/** 템플릿을 못 쓸 때의 폴백(원래 코드). */
export function wrapNewsletterHtml(contentHtml: string): string {
  return `<div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#1a1a1a">
  <div style="padding:8px 0 16px;border-bottom:1px solid #eee;font-weight:700;letter-spacing:.5px">123Band</div>
  <div style="padding:16px 0">${contentHtml}</div>
  <div style="padding:16px 0;border-top:1px solid #eee;color:#999;font-size:12px">
    이 메일은 123Band 뉴스레터를 구독하신 분께 발송되었습니다.
  </div>
</div>`;
}

// Brevo 로 다수 수신자에게 개별 발송(messageVersions, 1회 최대 1000명 → 청크 분할).
export async function brevoBulkSend(
  emails: string[],
  subject: string,
  html: string,
): Promise<number> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY 가 설정되지 않았습니다.');
  const fromEmail = process.env.BREVO_FROM_EMAIL || 'bandnara123@gmail.com';
  const fromName = process.env.BREVO_FROM_NAME || 'JNJ JOIN';

  let sent = 0;
  for (let i = 0; i < emails.length; i += 1000) {
    const chunk = emails.slice(i, i + 1000);
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        subject,
        htmlContent: html,
        messageVersions: chunk.map((email) => ({ to: [{ email }] })),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Brevo 발송 실패 (${res.status}): ${body.slice(0, 200)}`);
    }
    sent += chunk.length;
  }
  return sent;
}

// 저장된 뉴스레터(id)를 전체 구독자에게 발송하고 sent 로 갱신. 발송 인원 반환.
export async function deliverNewsletter(supabase: SupabaseClient, id: string): Promise<number> {
  const { data: nl, error } = await supabase
    .from('newsletters')
    .select('id, subject, content_html')
    .eq('id', id)
    .single();
  if (error || !nl) throw new Error('뉴스레터를 찾을 수 없습니다.');

  const { data: subs } = await supabase.from('newsletter_subscribers').select('email');
  const emails = (subs ?? [])
    .map((s) => (s as { email: string | null }).email)
    .filter((e): e is string => !!e);
  if (emails.length === 0) throw new Error('구독자가 없습니다.');

  const count = await brevoBulkSend(
    emails,
    nl.subject as string,
    await wrapNewsletterHtmlAsync(nl.content_html as string, nl.subject as string),
  );

  await supabase
    .from('newsletters')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      recipient_count: count,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  return count;
}
