// Design Ref: §5 Phase 3 — 생성된 영어 HTML 을 다른 언어로 번역 (구조 보존).
import { NextResponse } from 'next/server';
import { callClaude } from '@/lib/ai/claude';
import { TRANSLATE_SYSTEM, buildTranslatePrompt } from '@/lib/ai/prompt';
import { requireStaff } from '@/lib/ai/guard';

const ALLOWED = ['ko', 'ja', 'zh-TW', 'en'];

export async function POST(req: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }

  const html = String(body.html ?? '').trim();
  const targetLocale = String(body.targetLocale ?? '');
  if (!html) return NextResponse.json({ error: '번역할 HTML이 없습니다.' }, { status: 400 });
  if (!ALLOWED.includes(targetLocale)) {
    return NextResponse.json({ error: '지원하지 않는 언어입니다.' }, { status: 400 });
  }

  try {
    const translated = await callClaude(
      TRANSLATE_SYSTEM,
      buildTranslatePrompt(html, targetLocale),
      2500,
    );
    return NextResponse.json({ html: translated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '번역 실패' },
      { status: 502 },
    );
  }
}
