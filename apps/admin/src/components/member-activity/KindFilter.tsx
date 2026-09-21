// 회원활동 — 활동 종류 필터 칩. 아무것도 안 고르면 '전체'다(빈 배열 = 전체).
'use client';
import { tr } from '@/i18n/tr';
import { cn } from '@/lib/utils';
import { ACTIVITY_KINDS, type ActivityKind } from '@/lib/queries/member-activity';
import { KIND_META } from './kinds';

export function KindFilter({
  value,
  onChange,
}: {
  value: ActivityKind[];
  onChange: (next: ActivityKind[]) => void;
}) {
  function toggle(k: ActivityKind) {
    onChange(value.includes(k) ? value.filter((v) => v !== k) : [...value, k]);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onChange([])}
        className={cn(
          'rounded-pill border px-3 py-1.5 text-xs transition-colors duration-200',
          value.length === 0
            ? 'border-black bg-black text-white'
            : 'border-grey-300 text-grey-600 hover:border-grey-500',
        )}
      >
        {tr('전체')}
      </button>
      {ACTIVITY_KINDS.map((k) => {
        const { label, icon: Icon } = KIND_META[k];
        const on = value.includes(k);
        return (
          <button
            key={k}
            type="button"
            onClick={() => toggle(k)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs transition-colors duration-200',
              on
                ? 'border-black bg-black text-white'
                : 'border-grey-300 text-grey-600 hover:border-grey-500',
            )}
          >
            <Icon size={12} /> {tr(label)}
          </button>
        );
      })}
    </div>
  );
}
