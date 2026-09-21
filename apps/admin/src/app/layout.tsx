import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Providers } from './providers';
import { DEFAULT_ADMIN_LOCALE, isAdminLocale } from '@/i18n/dict';
import '@/i18n/tr-server'; // 서버 컴포넌트의 tr() 이 요청 쿠키의 로케일을 쓰게 등록
import './globals.css';

export const metadata: Metadata = {
  title: '123Band Admin',
  description: '운영자 관리 페이지',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieLocale = cookies().get('admin_locale')?.value;
  const locale = isAdminLocale(cookieLocale) ? cookieLocale : DEFAULT_ADMIN_LOCALE;
  return (
    <html lang={locale}>
      <body>
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
