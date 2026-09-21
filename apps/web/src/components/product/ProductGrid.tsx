// Design Ref: §5 — 상품 그리드 (반응형 2~4열). shop/카테고리/검색에서 재사용.
import type { Locale } from '@123band/shared';
import { ProductCard } from '@/components/home/ProductCard';
import type { HomeProduct } from '@/lib/queries/home';
import type { Dictionary } from '@/i18n/dictionaries';

export function ProductGrid({
  products,
  locale,
  dict,
}: {
  products: HomeProduct[];
  locale: Locale;
  dict: Dictionary;
}) {
  if (products.length === 0) {
    return <p className="py-16 text-center text-grey-400">{dict.home.empty}</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} locale={locale} dict={dict} />
      ))}
    </div>
  );
}
