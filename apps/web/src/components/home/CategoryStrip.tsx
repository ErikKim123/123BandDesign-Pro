// Design Ref: §5 Phase 2 — 카테고리 띠 (가로 pill 칩, 모바일 스크롤)
import Link from 'next/link';
import { pickI18n, type Locale } from '@123band/shared';
import type { HomeCategory } from '@/lib/queries/home';
import type { Dictionary } from '@/i18n/dictionaries';

export function CategoryStrip({
  title,
  categories,
  locale,
  dict,
}: {
  title?: string;
  categories: HomeCategory[];
  locale: Locale;
  dict: Dictionary;
}) {
  if (categories.length === 0) return null;
  return (
    <section className="container-band py-8">
      <h2 className="section-title mb-5">{title || dict.home.categories}</h2>
      <div className="flex flex-wrap gap-2.5">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/${locale}/categories/${c.id}`}
            className="rounded-pill border-[1.5px] border-grey-300 px-5 py-2.5 text-sm font-medium text-black transition-colors hover:border-black hover:bg-grey-100"
          >
            {pickI18n(c.name_i18n, locale) || c.code || '—'}
          </Link>
        ))}
      </div>
    </section>
  );
}
