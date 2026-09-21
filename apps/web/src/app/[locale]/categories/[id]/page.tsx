// Design Ref: §5 — 카테고리별 상품 목록 (CategoryStrip 링크 대상)
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { pickI18n, type Locale } from '@123band/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { listProducts, getCategory } from '@/lib/queries/products';
import { ProductGrid } from '@/components/product/ProductGrid';
import { buildMetadata, breadcrumbJsonLd } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: { locale: string; id: string };
}): Promise<Metadata> {
  const locale = params.locale as Locale;
  const [dict, category] = await Promise.all([getDictionary(locale), getCategory(params.id)]);
  const name =
    (category && (pickI18n(category.name_i18n, locale) || category.code)) || dict.home.categories;
  const description =
    locale === 'ko'
      ? `${name} 카테고리의 라틴 페스티벌 상품·행사패스를 둘러보세요.`
      : `Browse ${name} — Latin festival products and event passes on 123Band.`;
  return buildMetadata({ locale, path: `/categories/${params.id}`, title: name, description });
}

export default async function CategoryPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  const locale = params.locale as Locale;
  const [dict, category] = await Promise.all([getDictionary(locale), getCategory(params.id)]);
  if (!category) notFound();

  const products = await listProducts({ categoryId: category.id });
  const name = pickI18n(category.name_i18n, locale) || category.code || dict.home.categories;

  const crumbs = [
    { name: dict.nav.home, path: '' },
    { name, path: `/categories/${category.id}` },
  ];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(locale, crumbs)} />
      <Breadcrumbs locale={locale} items={crumbs} />
      <div className="container-band py-8">
        <h1 className="section-title mb-6">{name}</h1>
        <ProductGrid products={products} locale={locale} dict={dict} />
      </div>
    </>
  );
}
