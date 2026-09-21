// 검색형 국가 선택 — 전세계(ISO 3166-1) + 키워드 즉시 필터. 값은 ISO2 코드.
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import type { Locale } from '@123band/shared';
import { COUNTRY_CODES } from '@/lib/countries';

function FlagImg({ code, className }: { code: string; className?: string }) {
  const cc = code.toLowerCase();
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/32x24/${cc}.png`}
      srcSet={`https://flagcdn.com/64x48/${cc}.png 2x`}
      alt=""
      loading="lazy"
      className={className ?? 'h-3.5 w-auto rounded-[1px]'}
    />
  );
}

export function CountrySelect({
  locale,
  value,
  onChange,
}: {
  locale: Locale;
  value: string;
  onChange: (cc: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  const dn = useMemo(() => {
    try {
      return new Intl.DisplayNames([locale], { type: 'region' });
    } catch {
      return null;
    }
  }, [locale]);
  const nameOf = (cc: string) => dn?.of(cc.toUpperCase()) ?? cc;

  const list = useMemo(
    () =>
      COUNTRY_CODES.map((cc) => ({ cc, name: nameOf(cc) })).sort((a, b) =>
        a.name.localeCompare(b.name, locale),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dn, locale],
  );
  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return list;
    return list.filter((c) => c.name.toLowerCase().includes(k) || c.cc.toLowerCase().includes(k));
  }, [list, q]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const txt =
    locale === 'ko'
      ? { ph: '국가 선택', search: '국가 검색…', none: '검색 결과 없음' }
      : { ph: 'Select country', search: 'Search country…', none: 'No results' };

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input flex w-full items-center justify-between gap-2 text-left"
      >
        <span className={`flex items-center gap-2 ${value ? '' : 'text-grey-500'}`}>
          {value ? (
            <>
              <FlagImg code={value} /> {nameOf(value)}
            </>
          ) : (
            txt.ph
          )}
        </span>
        <ChevronDown size={16} className="shrink-0 text-grey-400" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-grey-200 bg-white shadow-lg">
          <div className="relative border-b border-grey-100 p-2">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-grey-400" />
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <input
              autoFocus
              className="input pl-8"
              placeholder={txt.search}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.map((c) => (
              <button
                key={c.cc}
                type="button"
                onClick={() => {
                  onChange(c.cc);
                  setOpen(false);
                  setQ('');
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-grey-50"
              >
                <FlagImg code={c.cc} className="h-3.5 w-auto shrink-0 rounded-[1px]" />
                <span className="truncate">{c.name}</span>
                <span className="ml-auto text-xs text-grey-400">{c.cc}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-center text-sm text-grey-400">{txt.none}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
