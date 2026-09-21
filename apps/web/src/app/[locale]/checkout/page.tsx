// Design Ref: §5 Phase 4 — 체크아웃 라우트 (고객 전용 가드: 미로그인/타역할 → 로그인으로)
import type { Locale } from '@123band/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { requireCustomer } from '@/lib/auth/guard';
import { isPaymentAvailable } from '@/lib/payments/config';
import { getWiseCheckoutUrl } from '@/lib/payments/wise';
import { currencyForLocale } from '@/lib/locale';
import { CheckoutView } from '@/components/cart/CheckoutView';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({ params }: { params: { locale: string } }) {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);

  // 세션 분리 규칙: web 은 고객 전용 (admin/partner 계정 차단)
  const user = await requireCustomer(locale, 'checkout');

  const currency = currencyForLocale(locale);
  // PayVerse 통합결제창은 카드/간편결제 선택을 결제창이 담당한다 → 가맹점 쪽 수단 선택 UI 없음.
  const paymentEnabled = isPaymentAvailable(currency);
  // Wise 송금 링크(어드민 설정). 비활성/미설정이면 빈 문자열 → 체크아웃에서 숨김.
  const wiseUrl = await getWiseCheckoutUrl();

  return (
    <CheckoutView
      locale={locale}
      dict={dict}
      userId={user.id}
      paymentEnabled={paymentEnabled}
      wiseUrl={wiseUrl}
    />
  );
}
