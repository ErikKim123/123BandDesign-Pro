// Design Ref: §5 Phase 2 — 추천 상품 그리드 (반응형 2~4열)
import type { Locale } from '@123band/shared';
import { ProductCard } from './ProductCard';
import type { HomeProduct } from '@/lib/queries/home';
import type { Dictionary } from '@/i18n/dictionaries';

export function FeaturedProducts({
  title,
  products,
  locale,
  dict,
}: {
  title?: string;
  products: HomeProduct[];
  locale: Locale;
  dict: Dictionary;
}) {
  if (products.length === 0) return null;
  return (
    <section className="container-band py-10 md:py-14">
      <h2 className="section-title mb-6">{title || dict.home.featured}</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} locale={locale} dict={dict} />
        ))}
      </div>
    </section>
  );
}
