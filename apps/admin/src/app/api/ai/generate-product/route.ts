// Design Ref: §5 Phase 3 — AI 상품 상세 HTML 생성 (영어 기준). 키는 서버에서만 사용.
import { NextResponse } from 'next/server';
import { callClaude } from '@/lib/ai/claude';
import { PRODUCT_HTML_SYSTEM, buildProductPrompt } from '@/lib/ai/prompt';
import { requireStaff } from '@/lib/ai/guard';

export async function POST(req: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }

  const name = String(body.name ?? '').trim();
  if (!name) return NextResponse.json({ error: '상품명은 필수입니다.' }, { status: 400 });

  const input = {
    name,
    keywords: body.keywords ? String(body.keywords) : undefined,
    features: Array.isArray(body.features) ? body.features.filter(Boolean).map(String) : [],
    imageUrls: Array.isArray(body.imageUrls) ? body.imageUrls.filter(Boolean).map(String) : [],
    category: body.category ? String(body.category) : undefined,
  };

  let html: string;
  try {
    html = await callClaude(PRODUCT_HTML_SYSTEM, buildProductPrompt(input));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI 생성 실패' },
      { status: 502 },
    );
  }

  // 생성 이력 저장 (best-effort — 실패해도 결과는 반환)
  try {
    await auth.supabase.from('ai_product_jobs').insert({
      product_id: body.productId ? String(body.productId) : null,
      input,
      generated_html: html,
      status: 'done',
    });
  } catch {
    /* 이력 저장 실패 무시 */
  }

  return NextResponse.json({ html });
}
