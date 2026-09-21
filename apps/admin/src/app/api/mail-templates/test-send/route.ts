// 메일링 관리 — 테스트 발송. 화면에서 렌더한 제목·본문을 그대로 한 사람에게 보낸다.
//
// 저장된 템플릿을 다시 읽지 않고 요청 본문을 쓰는 이유: 운영자는 '지금 화면에 보이는 것'을
// 확인하려는 것이다. 저장을 거쳐야만 테스트할 수 있으면, 잘못된 문구가 이미 실제 발송 경로에
// 올라간 뒤에 확인하게 된다.
//
// 권한: 운영자만(requireAdmin). 임의 주소로 임의 HTML 을 보낼 수 있는 창구라 반드시 잠가야 한다.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_HTML = 200_000;

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: '인증이 필요합니다.', status: 401 as const };
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin') {
    return { ok: false as const, error: '운영자만 사용할 수 있습니다.', status: 403 as const };
  }
  return { ok: true as const, email: user.email ?? '' };
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { to?: string; subject?: string; html?: string; audience?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }

  const to = String(body.to ?? '').trim();
  const subject = String(body.subject ?? '').trim();
  const html = String(body.html ?? '');
  if (!to.includes('@')) return NextResponse.json({ error: '받을 주소가 올바르지 않습니다.' }, { status: 400 });
  if (!subject) return NextResponse.json({ error: '제목이 비어 있습니다.' }, { status: 400 });
  if (!html.trim()) return NextResponse.json({ error: '본문이 비어 있습니다.' }, { status: 400 });
  if (html.length > MAX_HTML) return NextResponse.json({ error: '본문이 너무 깁니다.' }, { status: 413 });

  // 어드민은 Brevo 키가 있어야 메일을 보낼 수 있다. 키가 없으면 이 화면의 테스트 발송뿐 아니라
  // 뉴스레터 발송(brevoBulkSend)도 같이 실패한다 — 운영자가 어디를 고쳐야 하는지까지 알려 준다.
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          '이 서버에 BREVO_API_KEY 가 없어 메일을 보낼 수 없습니다. ' +
          'Vercel > 어드민 프로젝트 > Settings > Environment Variables 에 BREVO_API_KEY 를 추가하고 다시 배포해 주세요. ' +
          '(같은 키가 없으면 뉴스레터 발송도 실패합니다)',
      },
      { status: 503 },
    );
  }

  // 받는 사람에 따라 껍데기가 다르다 — 실제 발송과 같은 래퍼를 씌워야 테스트가 의미 있다.
  const wrapped =
    body.audience === 'user'
      ? `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.65;color:#1a1a1a;max-width:560px;margin:0 auto;padding:8px">${html}</div>`
      : `<div style="font-family:sans-serif;font-size:14px;line-height:1.6">${html}</div>`;

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: {
          name: process.env.BREVO_FROM_NAME || 'JNJ JOIN',
          email: process.env.BREVO_FROM_EMAIL || 'bandnara123@gmail.com',
        },
        to: [{ email: to }],
        // 진짜 알림으로 오인하지 않게 제목에 표시한다.
        subject: `[테스트] ${subject}`,
        htmlContent: wrapped,
        textContent: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return NextResponse.json(
        { error: `Brevo 가 거절했습니다 (${res.status}). ${detail.slice(0, 200)}` },
        { status: 502 },
      );
    }
  } catch (e) {
    return NextResponse.json({ error: `발송 실패: ${(e as Error).message}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true, to });
}
