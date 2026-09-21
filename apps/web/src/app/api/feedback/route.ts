// 행사 피드백 설문 접수. 로그인 없이도 낼 수 있다(설문은 응답률이 곧 쓸모).
//
// 로그인 벽이 없으니 대신 세 겹으로 막는다.
//   1) 설문을 켜 둔 행사에만 받는다 (products.feedback_enabled — RLS 에도 같은 조건이 있다)
//   2) 같은 방문자(band_vid 쿠키)가 같은 행사에 여러 번 내지 못하게 한다
//   3) 알려진 문항 코드만 저장하고 길이를 자른다 — 아무 JSON 이나 담기는 자루가 되면 안 된다
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  FEEDBACK_FIELDS,
  FEEDBACK_NAME_CODE,
  FEEDBACK_EMAIL_CODE,
  FEEDBACK_RATING_MAX,
} from '@123band/shared';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_TEXT = 2000;

/** 알려진 문항만, 타입에 맞게, 길이를 잘라서 통과시킨다. */
function clean(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [code, value] of Object.entries(raw as Record<string, unknown>)) {
    const field = FEEDBACK_FIELDS[code];
    if (!field || value == null || value === '') continue;
    if (field.type === 'rating') {
      const n = Math.round(Number(value));
      if (n >= 1 && n <= FEEDBACK_RATING_MAX) out[code] = n;
      continue;
    }
    if (field.type === 'multi') {
      if (!Array.isArray(value)) continue;
      const allowed = new Set(field.choices?.map((c) => c.value));
      const picked = value.filter((v): v is string => typeof v === 'string' && allowed.has(v));
      if (picked.length > 0) out[code] = picked;
      continue;
    }
    if (typeof value !== 'string') continue;
    if (field.type === 'single') {
      if (field.choices?.some((c) => c.value === value)) out[code] = value;
      continue;
    }
    const text = value.trim().slice(0, MAX_TEXT);
    if (text) out[code] = text;
  }
  return out;
}

export async function POST(req: Request) {
  let body: { productId?: string; answers?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const productId = (body.productId ?? '').trim();
  if (!productId) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const answers = clean(body.answers);
  // 이메일 칸은 '답을 듣고 싶을 때' 쓰는 연락처다 — 형식이 아니면 버린다(연락할 수 없는 값은 쓸모가 없다).
  const email = answers[FEEDBACK_EMAIL_CODE];
  if (typeof email === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    delete answers[FEEDBACK_EMAIL_CODE];
  }
  // 이름·이메일만 적고 낸 것은 응답이 아니다 — 집계만 흐려진다.
  const substantive = Object.keys(answers).filter(
    (c) => c !== FEEDBACK_NAME_CODE && c !== FEEDBACK_EMAIL_CODE,
  );
  if (substantive.length === 0) return NextResponse.json({ error: 'empty' }, { status: 400 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'unavailable' }, { status: 503 });

  // 설문을 켜 둔 행사인가. status 는 보지 않는다 — 끝난 행사는 대개 soldout 이고, 그때가 설문할 때다.
  const { data: product } = await admin
    .from('products')
    .select('id, feedback_enabled')
    .eq('id', productId)
    .maybeSingle();
  if (!product || product.feedback_enabled !== true) {
    return NextResponse.json({ error: 'closed' }, { status: 403 });
  }

  // 로그인 상태면 누가 냈는지 남긴다. 아니면 익명 그대로.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 방문자 쿠키로 같은 행사 중복 접수를 막는다. 쿠키를 지우면 뚫리지만, 그건 작정한 경우고
  // 여기서 막고 싶은 것은 '되돌아가서 또 내기' 같은 실수와 가벼운 장난이다.
  const visitorId = cookies().get('band_vid')?.value ?? null;
  if (visitorId || user) {
    const dup = admin.from('event_feedback').select('id', { head: true, count: 'exact' }).eq('product_id', productId);
    const { count } = user
      ? await dup.eq('author_id', user.id)
      : await dup.eq('visitor_id', visitorId as string);
    if ((count ?? 0) > 0) return NextResponse.json({ error: 'duplicate' }, { status: 409 });
  }

  const { error } = await admin.from('event_feedback').insert({
    product_id: productId,
    author_id: user?.id ?? null,
    visitor_id: visitorId,
    respondent_name: (answers[FEEDBACK_NAME_CODE] as string) ?? null,
    respondent_email: (answers[FEEDBACK_EMAIL_CODE] as string) ?? null,
    answers,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
