// 새 비밀번호 설정 — 메일의 재설정 링크가 도착하는 곳.
import { Suspense } from 'react';
import type { Locale } from '@123band/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage({ params }: { params: { locale: string } }) {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm locale={locale} dict={dict} />
    </Suspense>
  );
}
