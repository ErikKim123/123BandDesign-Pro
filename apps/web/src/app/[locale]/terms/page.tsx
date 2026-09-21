// 이용약관 페이지 — 한/영. 표준 템플릿(운영사 검토 후 확정 필요).
// KO 전문은 가입 동의 모달과 동일한 소스(content/customerTerms)를 사용해 일치시킨다.
import type { Metadata } from 'next';
import type { Locale } from '@123band/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { CUSTOMER_TERMS_KO } from '@/content/customerTerms';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-static';

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale = params.locale as Locale;
  const title = locale === 'ko' ? '이용약관' : 'Terms of Service';
  const description =
    locale === 'ko' ? '123Band 이용약관입니다.' : 'Terms of Service for 123Band.';
  return buildMetadata({ locale, path: '/terms', title, description });
}

type Article = { title: string; body: string };

const KO_INTRO =
  '본 약관은 주식회사 123솔루션(이하 “회사”)이 운영하는 123Band(이하 “123Band”)에서 제공하는 전자상거래 관련 서비스의 이용과 관련하여, 회사와 이용자 간의 권리·의무 및 책임사항 등을 규정함을 목적으로 합니다.';

const EN: { intro: string; articles: Article[] } = {
  intro: 'These Terms govern the rights, obligations, and responsibilities between 123 Solution Co., Ltd. (“Company”) and users in connection with the use of 123Band (“Service”).',
  articles: [
    { title: 'Article 1 (Purpose)', body: 'These Terms set out the conditions and procedures for using the Service, and the rights, obligations, and responsibilities of the Company and users.' },
    { title: 'Article 2 (Definitions)', body: '“User” means members and non-members who use the Service under these Terms. “Organizer” means a business that, with the Company’s approval, registers and supplies products or event passes that the Company sells directly to users.' },
    { title: 'Article 3 (Effect and Amendment)', body: 'These Terms take effect when posted within the Service. The Company may amend the Terms within the scope permitted by law. We will give prior notice of the effective date and reason for any change, at least 15 days in advance, or 30 days in advance where the change is unfavourable to users.' },
    { title: 'Article 4 (Provision of Service and Cancellations)', body: 'The Company directly sells tickets and products as a mail-order seller, and provides related services such as event information, payment, and delivery. If an Organizer cancels an event, the Company processes refunds according to the timeline and method specified on the event page. The Company may change or suspend all or part of the Service for operational or technical reasons.' },
    { title: 'Article 5 (Registration, Account, and Termination)', body: 'Users may register as members following the Company’s procedures. Users must keep their account information accurate and may not transfer or lend their account to third parties. The Company may suspend or terminate accounts that violate these Terms. Members who withdraw voluntarily may be subject to a one-month waiting period before re-registering.' },
    { title: 'Article 6 (Payment and Refund)', body: 'Prices, payment methods, and cancellation policies follow each product detail page and applicable laws (e.g., the Act on Consumer Protection in Electronic Commerce). For event passes, the refund terms shown on the event detail page apply first. See the Cancellation & Refund Policy for details.' },
    { title: 'Article 7 (Organizer Obligations and Policies)', body: 'The Company charges Organizers no upfront listing fee; a sales commission applies to completed sales as agreed with each Organizer. Organizers are responsible for the accuracy of their listed information and must comply with applicable laws and these Terms. The Company reviews submitted listings before publication and may suspend a listing or sales if an Organizer violates these rules. Organizers are separately bound by the Organizer Agreement.' },
    { title: 'Article 8 (Points and Digital Badges)', body: 'The Service offers points and digital badges. Points are earned through activities the Company designates and announces in the Service, such as signing up, writing a review of a product you purchased, posting a product Q&A, and unlocking achievements. Points and badges have no cash value, cannot be exchanged for currency, and cannot be transferred to others; points may be redeemed only for coupons or other uses the Company designates. Points are reclaimed if the underlying transaction is cancelled or refunded. The Company may reclaim or reset points and revoke badges from users who post low-effort or repetitive content to farm points, and may modify or discontinue the programme with prior notice.' },
    { title: 'Article 9 (User-Generated Content)', body: 'Users may post reviews, comments, and other content. You retain copyright in your content and are responsible for it. By posting on the Service, you grant the Company a free, non-exclusive licence to display, reproduce, and distribute that content for operating, promoting, and marketing the Service; the Company will stop such use upon your deletion request except where retention is required by law. You must hold the rights to any media you upload. The Company may remove offensive, spammy, or inappropriate content without notice.' },
    { title: 'Article 10 (Data Collection)', body: 'The Company collects in-service activity data — order history, reviews and Q&A, achievement history, and newsletter subscription status — to award points, issue digital badges, and improve the Service. Event pass admission is recorded through QR code scanning. The Company does not collect users’ GPS location. Your point balance, badges, and order history are visible only to you. Where you use the social features, anyone opening the QR link that carries your public code can see your display name, character avatar, public code, hearts received, and referral count; who sent a heart and any message remain visible only to the two people involved. Details are set out in the Privacy Policy.' },
    { title: 'Article 11 (Prohibited Conduct)', body: 'Users must not misappropriate the information of others, interfere with the Service, register false information, transact outside the Company’s payment flow, resell passes for profit, or violate laws, public order, or morals.' },
    { title: 'Article 12 (Limitation of Liability)', body: 'The Company sells products and event passes directly to users as the seller party to the sales contract and bears a seller’s responsibilities under applicable law. However, the Company does not operate the events themselves. We are not liable for the quality of a festival, venue safety, last-minute schedule changes, or the conduct of other attendees, nor for service disruptions caused by force majeure.' },
    { title: 'Article 13 (Governing Law and Jurisdiction)', body: 'These Terms are governed by the laws of the Republic of Korea. Disputes are subject to the courts determined under the Civil Procedure Act.' },
  ],
};

export default async function TermsPage({ params }: { params: { locale: string } }) {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  const isKo = locale === 'ko';
  const effective = isKo ? '시행일: 2026년 1월 1일' : 'Effective: January 1, 2026';

  return (
    <div className="container-band max-w-3xl py-10">
      <h1 className="section-title mb-2">{dict.footer.terms}</h1>
      <p className="mb-8 text-xs text-grey-400">{effective}</p>

      <p className="mb-8 leading-relaxed text-grey-700">{isKo ? KO_INTRO : EN.intro}</p>

      {isKo ? (
        <div className="space-y-10">
          {CUSTOMER_TERMS_KO.map((chapter) => (
            <div key={chapter.title}>
              <h2 className="mb-4 font-display text-xl">{chapter.title}</h2>
              <div className="space-y-6">
                {chapter.articles.map((a) => (
                  <section key={a.title}>
                    <h3 className="mb-2 font-semibold text-grey-800">{a.title}</h3>
                    <p className="whitespace-pre-line leading-relaxed text-grey-700">{a.body}</p>
                  </section>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-7">
          {EN.articles.map((a) => (
            <section key={a.title}>
              <h2 className="mb-2 font-display text-lg">{a.title}</h2>
              <p className="leading-relaxed text-grey-700">{a.body}</p>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
