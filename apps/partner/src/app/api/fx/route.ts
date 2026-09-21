// 실시간 환율(표시용) — USD 기준 서브통화(THB/VND/CNY/JPY)의 "1 USD 당 단위수".
// open.er-api.com 무료 API(키 불필요) 사용. 실패 시 근사 폴백. 6시간 캐시.
// 오거나이저 위저드가 이 값으로 서브통화 가격을 자동 계산(이후 수동 수정 가능).
import { NextResponse } from 'next/server';
import { SUB_CURRENCIES } from '@123band/shared';

export const revalidate = 21600; // 6h

// 1 USD ≈ (근사 폴백)
const FALLBACK: Record<string, number> = { THB: 36, VND: 25000, CNY: 7.2, JPY: 150 };

export async function GET() {
  const rates: Record<string, number> = { ...FALLBACK };
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      next: { revalidate: 21600 },
    });
    if (res.ok) {
      const j = (await res.json()) as { rates?: Record<string, number> };
      for (const c of SUB_CURRENCIES) {
        const r = Number(j.rates?.[c]);
        if (r > 0) rates[c] = r;
      }
    }
  } catch {
    /* 폴백 사용 */
  }
  return NextResponse.json({ base: 'USD', rates });
}
