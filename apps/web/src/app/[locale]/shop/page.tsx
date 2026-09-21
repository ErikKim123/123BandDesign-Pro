// Design Ref: §5 — 상품 탐색 (타입 탭: 전체/실물/티켓/구독)
import type { Metadata } from 'next';
import type { Locale } from '@123band/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { listProducts, listTicketPasses } from '@/lib/queries/products';
import { ProductGrid } from '@/components/product/ProductGrid';
import { FestivalPassBrowser } from '@/components/product/FestivalPassBrowser';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  const description =
    locale === 'ko'
      ? '라틴 페스티벌 굿즈·행사패스·구독을 한곳에서. 123Band에서 둘러보세요.'
      : 'Browse Latin festival gear, event passes and subscriptions on 123Band.';
  return buildMetadata({ locale, path: '/shop', title: dict.shop.title, description });
}

const TYPES = ['physical', 'ticket', 'subscription'] as const;

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { type?: string };
}) {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  const type = TYPES.includes(searchParams.type as (typeof TYPES)[number])
    ? searchParams.type
    : 'physical';
  const title =
    type === 'ticket'
      ? dict.nav.tickets
      : type === 'subscription'
        ? dict.nav.subscription
        : dict.shop.title;

  return (
    <div className="container-band py-8">
      <h1 className="section-title mb-6">{title}</h1>

      {type === 'ticket' ? (
        // 페스티벌 패스: 전체 보기 + 월 단위 필터
        <FestivalPassBrowser passes={await listTicketPasses()} locale={locale} dict={dict} />
      ) : (
        <ProductGrid products={await listProducts({ productType: type })} locale={locale} dict={dict} />
      )}
    </div>
  );
}
