// 상품 등록(오거나이저 입점) 안내 — 한/영. 입점 절차 + 오거나이저 포털 CTA.
import type { Metadata } from 'next';
import type { Locale } from '@123band/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-static';

// 오거나이저(파트너) 포털 주소 — 푸터와 동일 기본값.
const PARTNER_URL = process.env.NEXT_PUBLIC_PARTNER_URL ?? 'https://123band-partner.vercel.app';

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale = params.locale as Locale;
  const title = locale === 'ko' ? '오거나이저로 입점하기' : 'List Your Event';
  const description =
    locale === 'ko'
      ? '라틴 댄스 페스티벌·행사패스를 123Band에서 직접 등록·판매하세요. 입점 절차 안내.'
      : 'Sell your Latin dance festivals and event passes on 123Band. How to become an organizer.';
  return buildMetadata({ locale, path: '/sell', title, description });
}

type Step = { title: string; body: string };

const KO: { intro: string; steps: Step[]; ctaTitle: string; cta: string } = {
  intro: '123Band에서 오거나이저(주최자)로 입점하면 라틴 댄스 페스티벌·행사패스와 상품을 직접 등록·판매할 수 있습니다. 아래 절차를 따라 시작하세요.',
  steps: [
    { title: '1. 오거나이저로 가입', body: '회원가입 시 계정 유형을 ‘오거나이저’로 선택하고 회사명·국가 등 기본 정보를 입력합니다.' },
    { title: '2. 운영자 승인', body: '입점 신청 후 운영자 검토를 거쳐 승인되면 오거나이저 포털에서 등록·판매를 시작할 수 있습니다.' },
    { title: '3. 상품·행사패스 등록', body: '오거나이저 포털에서 행사패스(티켓)와 상품을 등록합니다. 행사 정보(일정·장소·티켓 구간 가격), 포스터/배너, 상세 페이지를 작성하고 AI 자동 채우기로 빠르게 초안을 만들 수 있습니다.' },
    { title: '4. 검수 후 노출', body: '등록한 상품은 검수(승인) 후 고객 화면에 노출됩니다. 승인 전에는 미리보기로 확인할 수 있습니다.' },
    { title: '5. 판매·정산', body: '판매가 발생하면 오거나이저 포털의 ‘판매·정산’에서 내역과 정산 예정액(수수료 차감)을 확인할 수 있습니다. 실제 지급은 운영자 정산 일정에 따릅니다.' },
  ],
  ctaTitle: '지금 오거나이저로 시작하세요',
  cta: '오거나이저로 가입하기',
};

const EN: { intro: string; steps: Step[]; ctaTitle: string; cta: string } = {
  intro: 'Become an Organizer on 123Band to list and sell Latin dance festivals, event passes, and products directly. Follow the steps below to get started.',
  steps: [
    { title: '1. Sign up as an Organizer', body: 'Choose the “Organizer” account type at sign-up and enter basic info such as company name and country.' },
    { title: '2. Operator approval', body: 'After applying, your application is reviewed. Once approved, you can start listing and selling in the Organizer Portal.' },
    { title: '3. Register products & event passes', body: 'In the Organizer Portal, register event passes (tickets) and products. Add event info (schedule, venue, price tiers), poster/banner, and detail pages — AI auto-fill can quickly draft them.' },
    { title: '4. Review & go live', body: 'Listings appear to customers after review (approval). Before approval, you can check them via preview.' },
    { title: '5. Sales & payout', body: 'When sales occur, view records and the expected payout (after commission) under “Sales & Payout” in the Organizer Portal. Actual payout follows the operator’s settlement schedule.' },
  ],
  ctaTitle: 'Start as an Organizer today',
  cta: 'Sign up as an Organizer',
};

export default async function SellPage({ params }: { params: { locale: string } }) {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  const c = locale === 'ko' ? KO : EN;

  return (
    <div className="container-band max-w-3xl py-10">
      <h1 className="section-title mb-6">{dict.footer.sell}</h1>
      <p className="mb-8 leading-relaxed text-grey-700">{c.intro}</p>

      <div className="space-y-7">
        {c.steps.map((s) => (
          <section key={s.title}>
            <h2 className="mb-2 font-display text-lg">{s.title}</h2>
            <p className="leading-relaxed text-grey-700">{s.body}</p>
          </section>
        ))}
      </div>

      {/* 가입 CTA */}
      <div className="mt-10 rounded-xl bg-grey-900 p-8 text-center text-white">
        <p className="font-display text-xl uppercase tracking-tight [word-break:keep-all] [text-wrap:balance]">{c.ctaTitle}</p>
        <a
          href={`${PARTNER_URL}/login?lang=${locale}`}
          className="btn mt-5 rounded-pill bg-white px-7 py-3 text-black hover:bg-grey-200"
        >
          {c.cta}
        </a>
      </div>
    </div>
  );
}
