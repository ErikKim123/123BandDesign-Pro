// 비밀번호 찾기 — 재설정 링크 메일 요청.
import { Suspense } from 'react';
import type { Locale } from '@123band/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

export default async function ForgotPasswordPage({ params }: { params: { locale: string } }) {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm locale={locale} dict={dict} />
    </Suspense>
  );
}
