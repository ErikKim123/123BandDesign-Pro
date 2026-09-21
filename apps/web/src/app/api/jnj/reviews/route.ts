// J&J 대회 후기 작성/삭제 API. 로그인 세션(RLS) 기반 — author_id 는 서버에서 세션 사용자로 강제.
// 대회·부문의 후기 스위치(reviews_enabled)가 꺼져 있으면 작성을 막는다.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const REVIEW_SELECT = 'id, edition_id, division, author_id, author_name, rating, content, created_at';

/** 후기 등록/수정 (사용자당 부문 1개 → upsert 로 재작성 시 수정) */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { editionId?: string; division?: string; rating?: number; content?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const editionId = (body.editionId ?? '').trim();
  const division = (body.division ?? '').trim();
  const rating = Math.round(Number(body.rating));
  const content = (body.content ?? '').trim();
  if (!editionId || !(rating >= 1 && rating <= 5) || !content) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }
  if (content.length > 2000) return NextResponse.json({ error: 'too_long' }, { status: 400 });

  // 스위치 확인 — 대회가 꺼져 있거나, 등록된 부문이 꺼져 있으면 작성 불가.
  const { data: edition } = await supabase
    .from('jnj_editions')
    .select('id, reviews_enabled')
    .eq('id', editionId)
    .eq('is_active', true)
    .maybeSingle();
  if (!edition || edition.reviews_enabled === false) {
    return NextResponse.json({ error: 'reviews_disabled' }, { status: 403 });
  }
  if (division) {
    const { data: div } = await supabase
      .from('jnj_divisions')
      .select('reviews_enabled')
      .eq('edition_id', editionId)
      .eq('code', division)
      .maybeSingle();
    if (div && div.reviews_enabled === false) {
      return NextResponse.json({ error: 'reviews_disabled' }, { status: 403 });
    }
  }

  // 표시 이름: 프로필 name → 이메일 앞부분 (상품 후기와 같은 규칙)
  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .maybeSingle();
  const authorName = (profile?.name ?? '').trim() || user.email?.split('@')[0] || 'Anonymous';

  const { data, error } = await supabase
    .from('jnj_reviews')
    .upsert(
      {
        edition_id: editionId,
        division,
        author_id: user.id,
        author_name: authorName,
        rating,
        content,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'edition_id,division,author_id' },
    )
    .select(REVIEW_SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, review: { ...data, product_id: '' } });
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

  const { error } = await supabase.from('jnj_reviews').delete().eq('id', id).eq('author_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
