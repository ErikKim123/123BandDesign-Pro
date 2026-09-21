// 오거나이저가 상품/행사패스 승인요청(draft→pending) 시 운영자에게 알림 메일.
// 관리/오거나이저 가드(requireStaff) → 본인 상품 조회(RLS) → notifyAdminApproval.
import { NextResponse } from 'next/server';
import { notifyAdminApproval, pickI18n, type I18n } from '@123band/shared';
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

  const productId = String(body.productId ?? '');
  const kind = body.kind === 'product' ? 'product' : 'eventPass';
  if (!productId) return NextResponse.json({ error: '상품 ID 가 필요합니다.' }, { status: 400 });

  // 본인 상품만 조회됨 (RLS). 없으면 알림 생략.
  const { data: product } = await auth.supabase
    .from('products')
    .select('name_i18n')
    .eq('id', productId)
    .maybeSingle();
  if (!product) return NextResponse.json({ ok: true });

  const name =
    pickI18n(product.name_i18n as I18n, 'ko') || pickI18n(product.name_i18n as I18n, 'en') || productId;
  const { data: partner } = await auth.supabase
    .from('partners')
    .select('company_name')
    .eq('user_id', auth.userId)
    .maybeSingle();

  await notifyAdminApproval({ kind, name, partner: partner?.company_name ?? null });
  return NextResponse.json({ ok: true });
}
