// 오거나이저(로그인/가입) 푸터 — web(123Band) 의 법적/안내 페이지로 연결.
// 약관·개인정보·취소환불·상품등록 안내는 web 앱에만 존재하므로 web URL 로 링크한다.
'use client';

const WEB_BASE = process.env.NEXT_PUBLIC_WEB_URL ?? 'https://123band-web.vercel.app';

const LABELS = {
  en: {
    terms: 'Terms of Service',
    organizerTerms: 'Organizer Agreement',
    privacy: 'Privacy Policy',
    cookies: 'Cookie Policy',
    refund: 'Cancellation & Refund',
    ip: 'Intellectual Property',
    sell: 'List Your Event',
    rights: 'All rights reserved.',
  },
  ko: {
    terms: '이용약관',
    organizerTerms: '주최자 약관',
    privacy: '개인정보처리방침',
    cookies: '쿠키 정책',
    refund: '취소·환불 정책',
    ip: '지식재산권 정책',
    sell: '상품 등록 안내',
    rights: 'All rights reserved.',
  },
};

export function PartnerFooter({ locale }: { locale: string }) {
  const t = locale === 'ko' ? LABELS.ko : LABELS.en;
  const loc = locale === 'ko' ? 'ko' : 'en';
  const link = (path: string) => `${WEB_BASE}/${loc}/${path}`;

  return (
    <footer className="border-t border-grey-200 bg-grey-50">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-6 text-xs">
        <a href={link('terms')} className="font-medium text-grey-600 hover:text-black hover:underline">
          {t.terms}
        </a>
        <a href={link('organizer-terms')} className="font-medium text-grey-600 hover:text-black hover:underline">
          {t.organizerTerms}
        </a>
        <a href={link('privacy')} className="font-medium text-grey-600 hover:text-black hover:underline">
          {t.privacy}
        </a>
        <a href={link('cookies')} className="font-medium text-grey-600 hover:text-black hover:underline">
          {t.cookies}
        </a>
        <a href={link('refund')} className="font-medium text-grey-600 hover:text-black hover:underline">
          {t.refund}
        </a>
        <a href={link('ip')} className="font-medium text-grey-600 hover:text-black hover:underline">
          {t.ip}
        </a>
        <a href={link('sell')} className="font-medium text-grey-600 hover:text-black hover:underline">
          {t.sell}
        </a>
        <span className="text-grey-400">© 2026 123Band. {t.rights}</span>
      </div>
    </footer>
  );
}
