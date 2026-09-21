// 비밀번호 재설정 메일 발송 — 서버에서 재설정 링크를 만들어 Brevo 로 보낸다.
//
// Supabase 의 resetPasswordForEmail 을 쓰지 않는 이유: 이 운영 환경은 Supabase 메일을 쓰지 않는다
// (가입도 확인메일 없이 service_role 로 즉시 활성 — api/account/signup 참고). 그쪽 SMTP 에 기대면
// "Error sending recovery email" 로 조용히 막힌다. 대신 admin.generateLink 로 토큰만 받아
// 우리 주소(/{locale}/reset-password?token=…)로 감싸고, 메일은 Brevo(sendUserEmail)로 보낸다.
//
// 계정 존재 여부는 응답으로 새지 않는다 — 없는 주소도 항상 ok. (메일만 안 갈 뿐)
import { NextResponse } from 'next/server';
import { sendUserEmail, tryRenderTemplate } from '@123band/shared';
import { createAdminClient } from '@/lib/supabase/admin';
import { webBase } from '@/lib/web-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LOCALES = ['en', 'ko', 'ja', 'zh-TW'];

/** 같은 주소로 연속 요청 차단(서버 인스턴스 메모리 — 최선 노력). 메일 폭탄 방지용. */
const RECENT = new Map<string, number>();
const THROTTLE_MS = 60_000;

const TEXT = {
  ko: {
    subject: '[123Band] 비밀번호 재설정',
    lead: '아래 버튼을 눌러 새 비밀번호를 설정하세요. 이 링크는 1시간 동안만 쓸 수 있습니다.',
    button: '새 비밀번호 설정',
    ignore: '본인이 요청한 것이 아니라면 이 메일을 무시하셔도 됩니다. 비밀번호는 바뀌지 않습니다.',
  },
  en: {
    subject: '[123Band] Reset your password',
    lead: 'Tap the button below to set a new password. This link works for one hour.',
    button: 'Set a new password',
    ignore: "If you didn't request this, you can ignore this email — your password stays the same.",
  },
} as const;

function fallbackHtml(link: string, locale: 'ko' | 'en'): string {
  const t = TEXT[locale];
  return `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;line-height:1.6;color:#1f1f1f">
    <h2 style="margin:0 0 12px">123Band</h2>
    <p style="margin:0 0 16px">${t.lead}</p>
    <p style="margin:0 0 20px">
      <a href="${link}" style="display:inline-block;background:#fa520f;color:#fff;text-decoration:none;padding:12px 22px;border-radius:24px;font-weight:600">${t.button}</a>
    </p>
    <p style="margin:0 0 8px;font-size:13px;color:#6b6b6b">${t.ignore}</p>
    <p style="margin:0;font-size:12px;color:#9a9a9a;word-break:break-all">${link}</p>
  </div>`;
}

export async function POST(req: Request) {
  let body: { email?: string; locale?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const locale = LOCALES.includes(body.locale ?? '') ? (body.locale as string) : 'en';
  const mailLocale: 'ko' | 'en' = locale === 'ko' ? 'ko' : 'en';
  if (!email.includes('@')) return NextResponse.json({ error: 'email required' }, { status: 400 });

  const now = Date.now();
  const last = RECENT.get(email);
  // 이미 보낸 직후면 아무것도 하지 않고 같은 응답을 준다 — 누른 쪽에서는 차이를 알 수 없다.
  if (last && now - last < THROTTLE_MS) return NextResponse.json({ ok: true });
  RECENT.set(email, now);
  // 오래된 항목 정리 — 맵이 무한정 커지지 않게.
  if (RECENT.size > 500) {
    for (const [k, t] of RECENT) if (now - t > THROTTLE_MS) RECENT.delete(k);
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: true, noAdmin: true });

  const base = webBase(req);
  try {
    // 로그인 계정은 울프·JNJ 와 공유한다. 123Band 회원 이메일이 아니면 링크를 만들지 않는다 —
    // generateLink 는 계정의 재설정 토큰을 새로 써서, 울프에서 받은 재설정 링크를 무효로 만든다.
    const { data: member } = await admin.from('profiles').select('id').eq('email', email).maybeSingle();
    if (!member) return NextResponse.json({ ok: true });

    const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email });
    // 없는 주소 · 소셜 전용 계정 등 — 조용히 성공으로 답한다(계정 존재 여부 노출 금지).
    if (error || !data?.properties?.hashed_token) return NextResponse.json({ ok: true });

    // 고객 계정만 이 사이트에서 비밀번호를 바꾼다(운영자·오거나이저는 각자 포털).
    const userId = data.user?.id;
    if (userId) {
      const { data: prof } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
      if (prof && prof.role !== 'customer') return NextResponse.json({ ok: true });
    }

    const link = `${base}/${locale}/reset-password?token=${encodeURIComponent(
      data.properties.hashed_token,
    )}`;
    const rendered = await tryRenderTemplate('password_reset', { link, email }, mailLocale);
    await sendUserEmail(
      email,
      rendered?.subject ?? TEXT[mailLocale].subject,
      rendered?.html ?? fallbackHtml(link, mailLocale),
    );
  } catch {
    // 발송 실패도 사용자에게는 같은 안내 — 재시도하면 된다.
  }
  return NextResponse.json({ ok: true });
}
