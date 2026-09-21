// 상품 문의 작성/삭제 API. 로그인 세션(RLS) 기반 — author_id 는 세션 사용자로 강제.
// 답변은 여기서 다루지 않는다(오거나이저 포털에서 처리). 질문 등록/삭제만.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { notifyAdminQna, pickI18n, type I18n } from '@123band/shared';

const QNA_SELECT = 'id, product_id, author_id, author_name, question, answer, answered_at, created_at';

/** 질문 등록 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { productId?: string; question?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const productId = (body.productId ?? '').trim();
  const question = (body.question ?? '').trim();
  if (!productId || !question) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  if (question.length > 2000) return NextResponse.json({ error: 'too_long' }, { status: 400 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .maybeSingle();
  const authorName = (profile?.name ?? '').trim() || user.email?.split('@')[0] || 'Anonymous';

  const { data, error } = await supabase
    .from('product_qna')
    .insert({ product_id: productId, author_id: user.id, author_name: authorName, question })
    .select(QNA_SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // 운영자 알림 — 답변이 필요한 글이라 방치되지 않게 알린다. best-effort(실패해도 등록은 유지).
  try {
    const { data: product } = await supabase
      .from('products')
      .select('name_i18n, code')
      .eq('id', productId)
      .maybeSingle();
    await notifyAdminQna({
      productName: (product ? pickI18n(product.name_i18n as I18n, 'ko') : '') || product?.code || '(상품)',
      authorName,
      authorEmail: user.email ?? null,
      question,
    });
  } catch {
    /* 알림 실패는 무시 */
  }

  return NextResponse.json({ ok: true, item: data });
}

/** 본인 질문 삭제 (RLS: 본인 또는 관리자) */
export async function DELETE(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { id?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const id = (body.id ?? '').trim();
  if (!id) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const { error } = await supabase
    .from('product_qna')
    .delete()
    .eq('id', id)
    .eq('author_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
