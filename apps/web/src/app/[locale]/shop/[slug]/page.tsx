// Design Ref: §7 SEO — 일반 상품 상세 정식 URL: /{locale}/shop/{slug}
// 티켓(행사)은 /events/{slug} 로 간다. 섹션이 어긋난 주소는 여기서 정식 주소로 301.
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import type { Locale } from '@123band/shared';
import {
  ProductPageView,
  noindexMetadata,
  productMetadata,
  resolveProductRoute,
  resolveProductRouteSafe,
} from '@/lib/product-page';

export const dynamic = 'force-dynamic';

type Props = {
  params: { locale: string; slug: string };
  searchParams: { preview?: string };
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const locale = params.locale as Locale;
  const here = `/shop/${params.slug}`;
  const r = await resolveProductRouteSafe(params.slug, here);
  if (r.kind !== 'render') return noindexMetadata(`/${locale}${r.kind === 'redirect' ? r.rel : here}`);
  const hidden =
    Boolean(searchParams.preview) || r.product.status === 'draft' || r.product.status === 'pending';
  return productMetadata({ locale, product: r.product, rel: r.rel, hidden });
}

export default async function ShopDetailPage({ params, searchParams }: Props) {
  const locale = params.locale as Locale;
  const preview = Boolean(searchParams.preview);
  const r = await resolveProductRoute(params.slug, `/shop/${params.slug}`);

  if (r.kind === 'notfound') notFound();
  if (r.kind === 'redirect') permanentRedirect(`/${locale}${r.rel}${preview ? '?preview=1' : ''}`);
  if (!preview && (r.product.status === 'draft' || r.product.status === 'pending')) notFound();

  return <ProductPageView locale={locale} product={r.product} rel={r.rel} preview={preview} />;
}
