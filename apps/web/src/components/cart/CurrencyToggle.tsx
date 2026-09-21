// 표시 통화 토글 — 상세/장바구니/결제에서 공용. 오거나이저가 '완전히 입력한' 통화만 노출한다(결제 통화라도
// 값이 없으면 버튼 자체를 숨긴다 — 눌러도 가격이 안 바뀌는 죽은 버튼을 만들지 않기 위함, available 은 호출부 계산).
// 전역 선택이 이 화면에서 쓸 수 없으면(부분 입력 등) 기준 통화로 폴백해 표시·하이라이트한다(가격을 지어내지 않기 위함).
'use client';
import { DISPLAY_CURRENCIES, type Currency, type Locale } from '@123band/shared';
import { useDisplayCurrency } from '@/lib/currency/CurrencyContext';

// 통화 토글 라벨 — CNY/JPY 는 ¥ 중복이라 元/円 로 구분.
export const CURRENCY_LABEL: Record<string, string> = {
  USD: 'US$',
  KRW: '₩',
  THB: '฿',
  VND: '₫',
  CNY: '元',
  JPY: '円',
};

export function CurrencyToggle({
  available,
  base,
  locale,
  className = '',
  hint = false,
}: {
  // 이 화면에서 '완전히 입력된' 통화들. 결제 통화라도 값이 없으면 포함하지 않는다(부분 입력 통화도 제외, 환산 방지).
  available: Currency[];
  // 이 화면의 기준 통화 — 사용자가 아직 통화를 고르지 않았을 때 켜지는 값. 없으면 결제 통화.
  base?: Currency;
  locale: Locale;
  className?: string;
  // 버튼만으로는 통화를 바꿀 수 있다는 걸 모르고 지나치기 쉬워, 결제 화면에서만 안내 문구를 켠다.
  hint?: boolean;
}) {
  const { chosenCurrency, payCurrency, setDisplayCurrency } = useDisplayCurrency();

  // 노출 목록 — 화면에 실제 값이 있는 통화만(호출부가 계산해 넘김). 결제 통화를 무조건 끼워 넣지 않는다 —
  // 값이 없는 결제 통화까지 버튼으로 보이면 눌러도 가격이 안 바뀌는 것처럼 보인다.
  const options = DISPLAY_CURRENCIES.filter((c) => available.includes(c));
  // 직접 고른 통화가 이 화면에서 쓸 수 없으면(또는 아직 안 골랐으면) 기준 통화로 폴백 — 가격을 지어내지 않기 위함.
  const fallback = base && options.includes(base) ? base : (options[0] ?? payCurrency);
  const effective =
    chosenCurrency && options.includes(chosenCurrency) ? chosenCurrency : fallback;
  if (options.length <= 1) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {options.map((c) => {
        const on = effective === c;
        return (
          <button
            key={c}
            type="button"
            onClick={() => setDisplayCurrency(c)}
            aria-pressed={on}
            className={`rounded-pill border px-2.5 py-1 text-xs font-semibold transition-colors ${
              on
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-grey-200 text-grey-500 hover:border-grey-400'
            }`}
          >
            {CURRENCY_LABEL[c] ?? c}
          </button>
        );
      })}
      {hint && (
        <span className="text-xs font-medium text-grey-500">
          {locale === 'ko' ? '통화를 변경할 수 있어요' : 'Tap to change currency'}
        </span>
      )}
    </div>
  );
}
