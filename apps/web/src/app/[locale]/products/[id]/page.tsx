// Design Ref: §7 SEO — 레거시 상세 URL: /{locale}/products/{uuid}
//
// 색인·외부 링크·카톡 공유에 이미 퍼진 주소라 없애지 않는다. 대신 정식 슬러그 URL 로 301 해서
// 순위 신호를 한 주소로 모은다. 슬러그가 아직 없으면(0035 미적용/미발행) 여기가 정식 주소이므로 그대로 렌더한다.
// 화면 구현은 /lib/product-page 공용 — /events/[slug] · /shop/[slug] 와 같다.
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
  params: { locale: string; id: string };
  searchParams: { preview?: string };
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const locale = params.locale as Locale;
  const here = `/products/${params.id}`;
  const r = await resolveProductRouteSafe(params.id, here);
  if (r.kind !== 'render') return noindexMetadata(`/${locale}${r.kind === 'redirect' ? r.rel : here}`);
  const hidden =
    Boolean(searchParams.preview) || r.product.status === 'draft' || r.product.status === 'pending';
  return productMetadata({ locale, product: r.product, rel: r.rel, hidden });
}

export default async function LegacyProductPage({ params, searchParams }: Props) {
  const locale = params.locale as Locale;
  // 미리보기(승인 전): RLS는 그대로 적용되므로 본인/관리자 세션에서만 pending·draft 가 조회된다.
  const preview = Boolean(searchParams.preview);
  const r = await resolveProductRoute(params.id, `/products/${params.id}`);

  if (r.kind === 'notfound') notFound();
  // 어드민/파트너 미리보기 링크도 그대로 따라가도록 쿼리를 유지한다.
  if (r.kind === 'redirect') permanentRedirect(`/${locale}${r.rel}${preview ? '?preview=1' : ''}`);
  if (!preview && (r.product.status === 'draft' || r.product.status === 'pending')) notFound();

  return <ProductPageView locale={locale} product={r.product} rel={r.rel} preview={preview} />;
}
