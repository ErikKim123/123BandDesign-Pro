// Design Ref: Wolf Design System / signature (SunsetStripe + Footer) — 푸터 (sunset stripe + 로고 + 태그라인 + 사업자정보 + 약관 + 카피 + 뉴스레터 구독)
import Link from 'next/link';
import type { Locale } from '@123band/shared';
import type { Dictionary } from '@/i18n/dictionaries';
import { NewsletterForm } from '@/components/marketing/NewsletterForm';

export function Footer({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <footer className="mt-10 border-t border-beige bg-cream">
      {/* 시그니처: 모든 페이지를 닫는 sunset stripe */}
      <div className="sunset-stripe" aria-hidden />
      <div className="container-band flex flex-col gap-8 py-10 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-3">
          <span className="font-display text-2xl font-extrabold uppercase tracking-tight text-ink">123Band</span>
          <p className="max-w-md text-sm text-grey-500">{dict.footer.tagline}</p>

          {/* 사업자 정보 (전자상거래법 표기) */}
          <div className="mt-2 space-y-0.5 text-xs leading-relaxed text-grey-500">
            <p className="font-medium text-grey-600">{dict.footer.business.company}</p>
            <p>{dict.footer.business.ceo}</p>
            <p>{dict.footer.business.regNo}</p>
            <p>{dict.footer.business.corpNo}</p>
            <p>{dict.footer.business.mailOrder}</p>
            <p>{dict.footer.business.address}</p>
            <p>{dict.footer.business.phone}</p>
            <p>{dict.footer.business.email}</p>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <Link href={`/${locale}/terms`} className="font-medium text-grey-600 hover:text-black hover:underline">
              {dict.footer.terms}
            </Link>
            <Link href={`/${locale}/privacy`} className="font-medium text-grey-600 hover:text-black hover:underline">
              {dict.footer.privacy}
            </Link>
            <Link href={`/${locale}/refund`} className="font-medium text-grey-600 hover:text-black hover:underline">
              {dict.footer.refund}
            </Link>
            <Link href={`/${locale}/cookies`} className="font-medium text-grey-600 hover:text-black hover:underline">
              {dict.footer.cookies}
            </Link>
            <Link href={`/${locale}/guidelines`} className="font-medium text-grey-600 hover:text-black hover:underline">
              {dict.footer.guidelines}
            </Link>
            <Link href={`/${locale}/ip`} className="font-medium text-grey-600 hover:text-black hover:underline">
              {dict.footer.ip}
            </Link>
            <Link href={`/${locale}/organizer-terms`} className="font-medium text-grey-600 hover:text-black hover:underline">
              {dict.footer.organizerTerms}
            </Link>
            <Link href={`/${locale}/sell`} className="font-medium text-grey-600 hover:text-black hover:underline">
              {dict.footer.sell}
            </Link>
            <span className="text-grey-400">© 2026 123Band. {dict.footer.rights}</span>
          </div>
        </div>

        {/* 뉴스레터 구독 — 모든 페이지 하단에서 구독 유도. 모바일에선 사업자정보 위로 올린다. */}
        <div className="order-first w-full shrink-0 md:order-none md:w-auto md:max-w-sm">
          <NewsletterForm locale={locale} dict={dict} />
        </div>
      </div>
    </footer>
  );
}
