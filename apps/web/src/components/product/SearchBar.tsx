// Design Ref: §5 — 상품 검색바 (입력 → /search?q=)
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

export function SearchBar({
  locale,
  placeholder,
  initial,
}: {
  locale: string;
  placeholder: string;
  initial?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initial ?? '');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (term) router.push(`/${locale}/search?q=${encodeURIComponent(term)}`);
  }

  return (
    <form onSubmit={submit} className="relative">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-400" />
      <input
        className="input pl-9"
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label={placeholder}
      />
    </form>
  );
}
