// Design Ref: §10.4 — 통화별 가격(prices jsonb). 입력은 자연 단위(달러/원), 저장은 최소단위 정수.
'use client';
import { toDisplayAmount, toMinorAmount, type Currency, type Prices } from '@123band/shared';

// 1차: USD/KRW — 입력은 달러/원 기준(센트 아님), 저장 시 최소단위로 변환
const CURRENCIES: { code: Currency; label: string; step: number; hint: string }[] = [
  { code: 'USD', label: 'USD', step: 0.01, hint: '달러 기준 (예: 110 → $110.00)' },
  { code: 'KRW', label: 'KRW', step: 1, hint: '원 기준 (예: 50000 → ₩50,000)' },
];

interface Props {
  label: string;
  value: Prices;
  onChange: (next: Prices) => void;
}

export function PriceField({ label, value, onChange }: Props) {
  function set(code: Currency, raw: string) {
    const next = { ...value };
    if (raw.trim() === '') delete next[code];
    else next[code] = toMinorAmount(Number(raw) || 0, code); // 달러/원 → 최소단위 정수
    onChange(next);
  }

  return (
    <div className="space-y-1.5">
      <label className="label-caps">{label}</label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CURRENCIES.map(({ code, label, step, hint }) => (
          <div key={code} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-10 text-xs font-medium text-grey-500">{label}</span>
              <input
                type="number"
                min={0}
                step={step}
                className="input"
                value={value[code] != null ? toDisplayAmount(value[code]!, code) : ''}
                onChange={(e) => set(code, e.target.value)}
              />
            </div>
            <p className="pl-12 text-[11px] text-grey-400">{hint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
