// Wise 결제링크 설정 — 조회/저장. 관리자 전용.
// 값은 공개용 URL 이라 그대로 내려주고 저장한다(is_admin RLS 로 쓰기 보호).
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { readWiseSetting, writeWiseSetting } from '@/lib/settings/wise';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const s = await readWiseSetting(auth.supabase);
    return NextResponse.json(s);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '설정을 불러오지 못했습니다.' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { url?: string; enabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }

  try {
    const s = await writeWiseSetting(auth.supabase, {
      url: String(body.url ?? ''),
      enabled: Boolean(body.enabled),
    });
    return NextResponse.json({ ok: true, ...s });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '저장에 실패했습니다.' },
      { status: 500 },
    );
  }
}
