// 적립 알림 수신 — DB 트리거가 pg_net 으로 부른다. 사람이 여는 엔드포인트가 아니다.
//
// 두 가지 사건이 들어온다. 둘 다 DB 안에서 일어나므로 앱은 이 웹훅으로만 그 사실을 안다.
//   · userCouponId  — 쿠폰 발급(0064). 지금은 포인트 교환이 유일한 경로다.
//                     (스탬프 카드 완성으로 나간 쿠폰은 0065 이전의 지난 기록)
//   · pointLedgerId — 스탬프 카드 완성 보상 포인트 지급(0065).
// 본문에는 식별자만 오고, 쿠폰명·회원 같은 상세는 여기서 service role 로 조회한다.
//
// 경로 이름이 /coupon 인 것은 0064 때 운영에 설정된 수신 URL 이기 때문이다.
// 설정(app_settings 'notify.webhook')을 다시 만지지 않으려고 그대로 둔다.
import { NextResponse } from 'next/server';
import {
  createAdminClient,
  notifyAdminCouponIssued,
  notifyAdminStampReward,
  pickI18n,
  type I18n,
} from '@123band/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 트리거가 보낸 요청인지 확인. 시크릿이 설정돼 있지 않으면 아무도 못 부르게 막는다. */
function authorized(req: Request): boolean {
  const expected = process.env.NOTIFY_WEBHOOK_SECRET ?? '';
  if (!expected) return false;
  return req.headers.get('x-notify-secret') === expected;
}

/** supabase 임베드는 to-one 이어도 배열로 올 수 있어 단일 객체로 정규화 */
const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? v[0] ?? null : v ?? null;

type Member = { name: string | null; email: string | null };

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body: { userCouponId?: string; pointLedgerId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const couponId = (body.userCouponId ?? '').trim();
  const ledgerId = (body.pointLedgerId ?? '').trim();
  if (!couponId && !ledgerId) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }

  const admin = createAdminClient();

  // 스탬프 카드 완성 → 포인트 지급
  if (ledgerId) {
    const { data } = await admin
      .from('point_ledger')
      .select('delta, balance_after, reason, user:profiles!user_id(name, email)')
      .eq('id', ledgerId)
      .maybeSingle();

    if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    const row = data as unknown as {
      delta: number;
      balance_after: number;
      reason: string;
      user: Member | Member[] | null;
    };
    // 트리거가 거르지만, 다른 이유의 원장이 흘러들어와 엉뚱한 메일이 나가지 않게 한 번 더 본다.
    if (row.reason !== 'stamp_reward') {
      return NextResponse.json({ error: 'not_applicable' }, { status: 400 });
    }
    const user = one(row.user);

    await notifyAdminStampReward({
      points: row.delta,
      balanceAfter: row.balance_after,
      customerEmail: user?.email ?? null,
      customerName: user?.name ?? null,
    });

    return NextResponse.json({ ok: true });
  }

  // 쿠폰 발급
  const { data } = await admin
    .from('user_coupons')
    .select(
      'code, source, point_cost, expires_at, ' +
        'user:profiles!user_id(name, email), ' +
        'coupon:coupons!coupon_id(code, name_i18n, discount_type, discount_value, currency)',
    )
    .eq('id', couponId)
    .maybeSingle();

  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const row = data as unknown as {
    code: string;
    source: string;
    point_cost: number | null;
    expires_at: string | null;
    user: Member | Member[] | null;
    coupon:
      | { code: string; name_i18n: I18n; discount_type: string; discount_value: number; currency: string }
      | { code: string; name_i18n: I18n; discount_type: string; discount_value: number; currency: string }[]
      | null;
  };
  const user = one(row.user);
  const coupon = one(row.coupon);

  await notifyAdminCouponIssued({
    source: row.source,
    code: row.code,
    couponName: (coupon ? pickI18n(coupon.name_i18n, 'ko') : '') || coupon?.code || '(쿠폰)',
    discountText: coupon
      ? coupon.discount_type === 'percent'
        ? `${coupon.discount_value}%`
        : `${coupon.currency} ${coupon.discount_value.toLocaleString()}`
      : '—',
    expiresAt: row.expires_at ? row.expires_at.slice(0, 10) : null,
    customerEmail: user?.email ?? null,
    customerName: user?.name ?? null,
    pointCost: row.point_cost,
  });

  return NextResponse.json({ ok: true });
}
