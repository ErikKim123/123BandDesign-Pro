// 상품 후기 작성/삭제 API. 로그인 세션(RLS) 기반 — author_id 는 서버에서 세션 사용자로 강제.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { notifyAdminReview, pickI18n, type I18n } from '@123band/shared';

const REVIEW_SELECT = 'id, product_id, author_id, author_name, rating, content, created_at';

/** 후기 등록/수정 (사용자당 상품 1개 → upsert 로 재작성 시 수정) */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { productId?: string; rating?: number; content?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const productId = (body.productId ?? '').trim();
  const rating = Math.round(Number(body.rating));
  const content = (body.content ?? '').trim();
  if (!productId || !(rating >= 1 && rating <= 5) || !content) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }
  if (content.length > 2000) return NextResponse.json({ error: 'too_long' }, { status: 400 });

  // 표시 이름: 프로필 name → 이메일 앞부분
  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .maybeSingle();
  const authorName =
    (profile?.name ?? '').trim() || user.email?.split('@')[0] || 'Anonymous';

  const { data, error } = await supabase
    .from('product_reviews')
    .upsert(
      {
        product_id: productId,
        author_id: user.id,
        author_name: authorName,
        rating,
        content,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'product_id,author_id' },
    )
    .select(REVIEW_SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // 운영자 알림 — 낮은 별점을 빨리 발견하기 위한 것. best-effort(실패해도 등록은 유지).
  try {
    const { data: product } = await supabase
      .from('products')
      .select('name_i18n, code')
      .eq('id', productId)
      .maybeSingle();
    // upsert 라 재작성이면 created_at 이 과거다 — 신규/수정을 그것으로 가른다.
    const createdAt = new Date(String(data?.created_at ?? '')).getTime();
    const updated = Number.isFinite(createdAt) && Date.now() - createdAt > 10_000;
    await notifyAdminReview({
      productName:
        (product ? pickI18n(product.name_i18n as I18n, 'ko') : '') || product?.code || '(상품)',
      authorName,
      authorEmail: user.email ?? null,
      rating,
      content,
      updated,
    });
  } catch {
    /* 알림 실패는 무시 */
  }

  return NextResponse.json({ ok: true, review: data });
}

/** 본인 후기 삭제 (RLS: 본인 또는 관리자) */
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
    .from('product_reviews')
    .delete()
    .eq('id', id)
    .eq('author_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
