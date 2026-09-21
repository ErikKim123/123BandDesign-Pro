// 국가번호(+1, +82 …)를 국가 선택으로 자동 채우는 전화 입력.
// 좌측: 검색형 국가 드롭다운(국기 + 국가명 + +코드), 우측: 번호 입력. 값은 (country ISO2, number) 분리.
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import type { Locale } from '@123band/shared';
import { COUNTRY_CODES, DIAL_CODES } from '@/lib/countries';

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

export function PhoneField({
  locale,
  country,
  onCountryChange,
  number,
  onNumberChange,
  placeholder,
}: {
  locale: Locale;
  country: string;
  onCountryChange: (cc: string) => void;
  number: string;
  onNumberChange: (v: string) => void;
  placeholder?: string;
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
      COUNTRY_CODES.filter((cc) => DIAL_CODES[cc])
        .map((cc) => ({ cc, name: nameOf(cc), dial: DIAL_CODES[cc] }))
        .sort((a, b) => a.name.localeCompare(b.name, locale)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dn, locale],
  );
  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return list;
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(k) ||
        c.cc.toLowerCase().includes(k) ||
        ('+' + c.dial).includes(k),
    );
  }, [list, q]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const dial = country ? DIAL_CODES[country] : '';
  const txt =
    locale === 'ko'
      ? { search: '국가 검색…', none: '검색 결과 없음' }
      : { search: 'Search country…', none: 'No results' };

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center rounded-lg border border-grey-300 bg-grey-100 transition-colors duration-200 focus-within:border-black focus-within:bg-white focus-within:shadow-focus">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex shrink-0 items-center gap-1.5 py-3 pl-4 pr-2 text-base text-black"
        >
          {country ? (
            <>
              <FlagImg code={country} />
              <span>+{dial}</span>
            </>
          ) : (
            <span className="text-grey-500">＋ —</span>
          )}
          <ChevronDown size={14} className="text-grey-400" />
        </button>
        <span className="h-5 w-px shrink-0 bg-grey-300" />
        <input
          type="tel"
          className="w-full flex-1 bg-transparent px-3 py-3 text-base text-black outline-none placeholder:text-grey-500"
          placeholder={placeholder}
          value={number}
          onChange={(e) => onNumberChange(e.target.value)}
        />
      </div>

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
                  onCountryChange(c.cc);
                  setOpen(false);
                  setQ('');
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-grey-50"
              >
                <FlagImg code={c.cc} className="h-3.5 w-auto shrink-0 rounded-[1px]" />
                <span className="truncate">{c.name}</span>
                <span className="ml-auto text-xs text-grey-400">+{c.dial}</span>
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
