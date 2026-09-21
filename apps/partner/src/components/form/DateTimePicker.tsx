// 커스텀 날짜·시간 선택기 — 네이티브 datetime-local 대체.
// 이유: Chrome 은 네이티브 date/time 위젯(입력칸 + 팝업)을 브라우저 로케일로 강제 표시해
// (예: 한국어 '오전/오후·일월화') lang 속성을 무시한다. 직접 렌더해 앱 로케일(EN/KO)만 따르게 한다.
// 값 형식은 datetime-local 과 동일: 'YYYY-MM-DDTHH:mm'.
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

type Parts = { y: number; mo: number; d: number; h: number; mi: number };

function pad(n: number) {
  return String(n).padStart(2, '0');
}
function parse(value?: string): Parts | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  return { y: +m[1]!, mo: +m[2]!, d: +m[3]!, h: +m[4]!, mi: +m[5]! };
}
function toStr(p: Parts): string {
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
}

export function DateTimePicker({
  value,
  onChange,
  locale,
}: {
  value?: string;
  onChange: (v: string) => void;
  locale: string;
}) {
  const intl = locale === 'ko' ? 'ko-KR' : 'en-US';
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cur = parse(value);

  const today = new Date();
  const [view, setView] = useState(() => ({
    y: cur?.y ?? today.getFullYear(),
    mo: cur?.mo ?? today.getMonth() + 1,
  }));

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // 열 때 현재 값의 월로 이동
  useEffect(() => {
    if (open && cur) setView({ y: cur.y, mo: cur.mo });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        new Intl.DateTimeFormat(intl, { weekday: 'short' }).format(new Date(2023, 0, 1 + i)),
      ),
    [intl],
  );
  const monthLabel = new Intl.DateTimeFormat(intl, { month: 'long', year: 'numeric' }).format(
    new Date(view.y, view.mo - 1, 1),
  );
  const display = cur
    ? `${new Intl.DateTimeFormat(intl, { dateStyle: 'medium' }).format(
        new Date(cur.y, cur.mo - 1, cur.d),
      )} ${pad(cur.h)}:${pad(cur.mi)}`
    : '';

  const firstWeekday = new Date(view.y, view.mo - 1, 1).getDay();
  const daysInMonth = new Date(view.y, view.mo, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function pickDay(d: number) {
    const base = cur ?? { h: 0, mi: 0, y: view.y, mo: view.mo, d };
    onChange(toStr({ y: view.y, mo: view.mo, d, h: base.h, mi: base.mi }));
  }
  function setTime(h: number, mi: number) {
    const base = cur ?? { y: view.y, mo: view.mo, d: today.getDate() };
    onChange(toStr({ y: base.y, mo: base.mo, d: base.d, h, mi }));
  }
  function shiftMonth(delta: number) {
    setView((v) => {
      const m = v.mo - 1 + delta;
      return { y: v.y + Math.floor(m / 12), mo: ((m % 12) + 12) % 12 + 1 };
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input flex w-full items-center justify-between text-left"
      >
        <span className={display ? '' : 'text-grey-400'}>{display || 'YYYY-MM-DD --:--'}</span>
        <CalendarDays size={16} className="shrink-0 text-grey-400" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 flex gap-3 rounded-lg border border-grey-200 bg-white p-3 shadow-lg">
          {/* 달력 */}
          <div className="w-60">
            <div className="mb-2 flex items-center justify-between">
              <button type="button" className="rounded p-1 hover:bg-grey-100" onClick={() => shiftMonth(-1)}>
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-medium">{monthLabel}</span>
              <button type="button" className="rounded p-1 hover:bg-grey-100" onClick={() => shiftMonth(1)}>
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] text-grey-400">
              {weekdays.map((w) => (
                <span key={w} className="py-1">{w}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center text-sm">
              {cells.map((d, i) => {
                const selected =
                  d != null && cur && cur.y === view.y && cur.mo === view.mo && cur.d === d;
                return (
                  <div key={i} className="py-0.5">
                    {d != null && (
                      <button
                        type="button"
                        onClick={() => pickDay(d)}
                        className={`h-7 w-7 rounded-full ${
                          selected ? 'bg-black text-white' : 'hover:bg-grey-100'
                        }`}
                      >
                        {d}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 시:분 (24시간) */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-grey-400">{locale === 'ko' ? '시간' : 'Time'}</span>
            <div className="flex items-start gap-1">
              <TimeColumn
                count={24}
                selected={cur?.h ?? -1}
                onPick={(h) => setTime(h, cur?.mi ?? 0)}
              />
              <span className="pt-1">:</span>
              <TimeColumn
                count={60}
                selected={cur?.mi ?? -1}
                onPick={(mi) => setTime(cur?.h ?? 0, mi)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 0..count-1 스크롤 목록 (시 또는 분)
function TimeColumn({
  count,
  selected,
  onPick,
}: {
  count: number;
  selected: number;
  onPick: (n: number) => void;
}) {
  return (
    <div className="h-48 w-12 overflow-y-auto rounded border border-grey-200">
      {Array.from({ length: count }, (_, n) => (
        <button
          key={n}
          type="button"
          onClick={() => onPick(n)}
          className={`block w-full px-2 py-1 text-center text-sm ${
            selected === n ? 'bg-black text-white' : 'hover:bg-grey-100'
          }`}
        >
          {pad(n)}
        </button>
      ))}
    </div>
  );
}
