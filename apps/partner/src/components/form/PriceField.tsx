// Design Ref: §10.4 — 통화별 가격(prices jsonb), 최소단위 정수 입력
'use client';
import type { Currency, Prices } from '@123band/shared';
import { useT } from '@/i18n/useT';

interface Props {
  label: string;
  value: Prices;
  onChange: (next: Prices) => void;
}

export function PriceField({ label, value, onChange }: Props) {
  const t = useT();
  // 1차: USD/KRW
  const CURRENCIES: { code: Currency; label: string; hint: string }[] = [
    { code: 'USD', label: 'USD', hint: t.form.usdHint },
    { code: 'KRW', label: 'KRW', hint: t.form.krwHint },
  ];
  function set(code: Currency, raw: string) {
    const next = { ...value };
    if (raw === '') delete next[code];
    else next[code] = Math.max(0, Math.trunc(Number(raw) || 0));
    onChange(next);
  }

  return (
    <div className="space-y-1.5">
      <label className="label-caps">{label}</label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CURRENCIES.map(({ code, label, hint }) => (
          <div key={code} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-10 text-xs font-medium text-grey-500">{label}</span>
              <input
                type="number"
                min={0}
                step={1}
                className="input"
                value={value[code] ?? ''}
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
