// Design Ref: 설명.txt 쿠폰관리 — 고객 쿠폰 검증/할인 계산 (공개 읽기 RLS)
// 0038 이후 쿠폰은 두 종류다:
//   1) 전역 코드(coupons)          — 아무나 코드를 입력해 쓴다. used_count 로 총 사용량 제한.
//   2) 개인 발급 코드(user_coupons) — 포인트 교환으로 내게 발급된 코드(PTxxxxxxxx). RLS 로 본인만 조회 가능.
// 할인 규칙은 두 경우 모두 원본 coupons 행을 따르고, 주문에는 입력한 코드가 그대로 기록된다.
import type { Currency } from '@123band/shared';
import { createClient } from '@/lib/supabase/client';

export interface Coupon {
  code: string;
  discount_type: string;
  discount_value: number;
  min_amount: number;
  currency: string;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  used_count: number;
  is_active: boolean;
}

/** 내 쿠폰함 항목 — 포인트로 교환해 발급받은 개인 쿠폰 */
export interface MyCoupon {
  id: string;
  code: string;
  status: string;
  point_cost: number;
  expires_at: string | null;
  coupon: Coupon & { name_i18n?: Record<string, string> | null };
}

export type CouponResult =
  | { ok: true; coupon: Coupon; discount: number; personal: boolean }
  | { ok: false; reason: 'invalid' | 'min' | 'expired' | 'used' };

const COUPON_COLS =
  'code, discount_type, discount_value, min_amount, currency, starts_at, ends_at, usage_limit, used_count, is_active';

/** 할인액(최소단위) 계산 — 총액을 넘지 않도록 캡 */
export function computeDiscount(coupon: Coupon, totalMinor: number, currency: Currency): number {
  let d = 0;
  if (coupon.discount_type === 'percent') {
    d = Math.floor((totalMinor * coupon.discount_value) / 100);
  } else if (coupon.currency === currency) {
    d = coupon.discount_value; // 정액: 통화 일치 시에만
  }
  return Math.min(d, totalMinor);
}

/** supabase 임베드는 to-one 이어도 배열로 올 수 있어 단일 객체로 정규화 */
function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? v[0] ?? null : v ?? null;
}

/** 내 쿠폰함 — 사용 가능한 개인 쿠폰 목록 (RLS 로 본인 것만 조회된다) */
export async function listMyCoupons(): Promise<MyCoupon[]> {
  const { data } = await createClient()
    .from('user_coupons')
    .select(`id, code, status, point_cost, expires_at, coupon:coupons!coupon_id(${COUPON_COLS}, name_i18n)`)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  const today = new Date().toISOString().slice(0, 10);
  return ((data ?? []) as unknown as (Omit<MyCoupon, 'coupon'> & { coupon: MyCoupon['coupon'] | MyCoupon['coupon'][] })[])
    .map((r) => ({ ...r, coupon: one(r.coupon) as MyCoupon['coupon'] }))
    .filter((r) => r.coupon?.is_active && (!r.expires_at || r.expires_at >= today));
}

/** 쿠폰 코드 검증 + 할인 계산 — 개인 발급 코드를 먼저 찾고, 없으면 전역 코드를 본다. */
export async function validateCoupon(
  code: string,
  totalMinor: number,
  currency: Currency,
  today: string,
): Promise<CouponResult> {
  const raw = code.trim().toUpperCase();
  if (!raw) return { ok: false, reason: 'invalid' };
  const supabase = createClient();

  // 1) 내 쿠폰함(개인 발급) — 이미 발급받은 것이라 총 사용제한(used_count)은 보지 않는다.
  const { data: mineRaw } = await supabase
    .from('user_coupons')
    .select(`code, status, expires_at, coupon:coupons!coupon_id(${COUPON_COLS})`)
    .eq('code', raw)
    .eq('status', 'active')
    .maybeSingle();
  const mine = mineRaw as { code: string; expires_at: string | null; coupon: Coupon | Coupon[] } | null;
  if (mine) {
    const origin = one(mine.coupon);
    if (!origin || !origin.is_active) return { ok: false, reason: 'invalid' };
    if (mine.expires_at && mine.expires_at < today) return { ok: false, reason: 'expired' };
    if (origin.starts_at && origin.starts_at > today) return { ok: false, reason: 'expired' };
    if (origin.ends_at && origin.ends_at < today) return { ok: false, reason: 'expired' };
    if (origin.min_amount > 0 && totalMinor < origin.min_amount) return { ok: false, reason: 'min' };
    // 주문에는 개인 코드가 기록되어야 결제확정 때 그 쿠폰이 사용 처리된다.
    const coupon = { ...origin, code: mine.code };
    return { ok: true, coupon, discount: computeDiscount(coupon, totalMinor, currency), personal: true };
  }

  // 2) 전역 코드 — 교환 전용 쿠폰의 원본 코드는 직접 입력해 쓸 수 없다.
  const { data } = await supabase
    .from('coupons')
    .select(COUPON_COLS)
    .eq('code', raw)
    .eq('is_active', true)
    .eq('is_exchangeable', false)
    .maybeSingle();

  const coupon = data as Coupon | null;
  if (!coupon) return { ok: false, reason: 'invalid' };
  if (coupon.starts_at && coupon.starts_at > today) return { ok: false, reason: 'expired' };
  if (coupon.ends_at && coupon.ends_at < today) return { ok: false, reason: 'expired' };
  if (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit) {
    return { ok: false, reason: 'used' };
  }
  if (coupon.min_amount > 0 && totalMinor < coupon.min_amount) {
    return { ok: false, reason: 'min' };
  }
  return { ok: true, coupon, discount: computeDiscount(coupon, totalMinor, currency), personal: false };
}
