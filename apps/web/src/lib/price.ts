// Design Ref: 표시 통화 결정 — 로케일 통화 우선, 없으면 다른 통화에서 근사 환산.
// 주의: 환율은 '표시 전용' 근사값. 실제 결제 통화/금액과 다를 수 있어 approx=true 로 표기.
import {
  formatPrice,
  toDisplayAmount,
  toMinorAmount,
  type Currency,
  type Prices,
} from '@123band/shared';

// 1 단위 통화 = ? USD (표시 전용 근사 환율). 필요 시 이 상수만 갱신.
const USD_PER_UNIT: Record<Currency, number> = {
  USD: 1,
  KRW: 1 / 1400, // 1 KRW ≈ 1/1400 USD (≈ 1 USD = 1,400원)
  THB: 1 / 36,
  VND: 1 / 25000,
  CNY: 1 / 7.2,
  JPY: 1 / 150,
};

/** 대상 통화 금액(최소단위) 결정. 대상 통화가 없으면 보유 통화에서 환산. */
export function resolvePrice(
  prices: Prices | null | undefined,
  target: Currency,
): { minor: number; approx: boolean } | null {
  if (!prices) return null;
  if (prices[target] != null) return { minor: prices[target]!, approx: false };
  for (const c of Object.keys(prices) as Currency[]) {
    const v = prices[c];
    if (v == null) continue;
    const usd = toDisplayAmount(v, c) * USD_PER_UNIT[c]; // 보유 통화 → USD 표시금액
    const targetDisplay = usd / USD_PER_UNIT[target]; // → 대상 통화 표시금액
    return { minor: toMinorAmount(targetDisplay, target), approx: true };
  }
  return null;
}

/**
 * 로케일 통화로 가격 라벨 생성.
 * - priceText(직접 표기) 최우선
 * - 보유가 있으면 로케일 통화로 표시(없으면 환산, approx 표기 '≈')
 * - 아무 가격도 없으면 freeText
 */
export function priceLabel(
  prices: Prices | null | undefined,
  currency: Currency,
  intl: string,
  freeText: string,
  priceText?: string,
): string {
  if (priceText) return priceText;
  const r = resolvePrice(prices, currency);
  if (!r || r.minor <= 0) return freeText;
  const formatted = formatPrice({ [currency]: r.minor } as Prices, currency, intl);
  return formatted;
}
