// Design Ref: §5 Phase 4 — 장바구니 라우트
import type { Locale } from '@123band/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { CartView } from '@/components/cart/CartView';

export default async function CartPage({ params }: { params: { locale: string } }) {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  return <CartView locale={locale} dict={dict} />;
}
