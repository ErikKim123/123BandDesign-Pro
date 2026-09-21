// Design Ref: §5 Phase 4 — 고객 로그인
import { Suspense } from 'react';
import type { Locale } from '@123band/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { AuthForm } from '@/components/auth/AuthForm';

export default async function LoginPage({ params }: { params: { locale: string } }) {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  return (
    <Suspense fallback={null}>
      <AuthForm locale={locale} dict={dict} mode="login" />
    </Suspense>
  );
}
