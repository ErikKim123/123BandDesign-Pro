// Design Ref: §7 SEO — 행사(티켓) 상세 정식 URL: /{locale}/events/{slug}
// 구현은 /lib/product-page 공용 — /shop/[slug] · 레거시 /products/[id] 와 같은 화면을 쓴다.
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
  const here = `/events/${params.slug}`;
  const r = await resolveProductRouteSafe(params.slug, here);
  // 301 대상이거나 없는 상품 → 색인 금지. canonical 은 최종 목적지를 가리킨다.
  if (r.kind !== 'render') return noindexMetadata(`/${locale}${r.kind === 'redirect' ? r.rel : here}`);
  const hidden =
    Boolean(searchParams.preview) || r.product.status === 'draft' || r.product.status === 'pending';
  return productMetadata({ locale, product: r.product, rel: r.rel, hidden });
}

export default async function EventDetailPage({ params, searchParams }: Props) {
  const locale = params.locale as Locale;
  // 미리보기(승인 전): RLS는 그대로 적용되므로 본인/관리자 세션에서만 pending·draft 가 조회된다.
  const preview = Boolean(searchParams.preview);
  const r = await resolveProductRoute(params.slug, `/events/${params.slug}`);

  if (r.kind === 'notfound') notFound();
  if (r.kind === 'redirect') permanentRedirect(`/${locale}${r.rel}${preview ? '?preview=1' : ''}`);
  // 미승인 상품은 preview 아닌 접근에서 404 (색인·유출 방지)
  if (!preview && (r.product.status === 'draft' || r.product.status === 'pending')) notFound();

  return <ProductPageView locale={locale} product={r.product} rel={r.rel} preview={preview} />;
}
