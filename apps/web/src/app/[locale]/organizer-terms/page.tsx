// 주최자(오거나이저) 약관 — 한/영. 운영사 제공 원문(Drive)을 실제 구현·법적 지위에 맞게 조정했다.
//  - 123Band 는 통신판매업자·판매 당사자(결제 중개자 아님) → 원문의 '결제 중개자' 표현을 정정
//  - 수수료: 등록 수수료 없음 + 판매 수수료 기본 10%(partners.commission_rate) 명시
//  - 정산 기한은 '영업일 7일 이내 지급을 원칙' 으로 두되 예외 사유를 함께 기재
//  - 회원 독점할인 강제 메커니즘은 미구현이므로 '권장' 으로 완화
// 고객 약관(customerTerms)의 "오거나이저는 별도의 판매이용약관을 함께 적용받는다" 가 가리키는 문서.
import type { Metadata } from 'next';
import type { Locale } from '@123band/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-static';

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale = params.locale as Locale;
  const title = locale === 'ko' ? '주최자 약관' : 'Organizer Agreement';
  const description =
    locale === 'ko'
      ? '123Band에 페스티벌·행사패스를 등록하는 오거나이저에게 적용되는 약관입니다.'
      : 'Terms that apply to Organizers listing festivals and event passes on 123Band.';
  return buildMetadata({ locale, path: '/organizer-terms', title, description });
}

type Section = { title: string; body: string };

const KO: { intro: string; sections: Section[] } = {
  intro:
    '본 약관은 123Band에 페스티벌·행사패스를 등록하는 오거나이저(판매회원)에게 적용됩니다. 플랫폼에 행사를 게시함으로써 귀하는 본 약관에 동의하는 것으로 간주되며, 오거나이저는 본 약관과 함께 123Band 이용약관의 적용을 받습니다.',
  sections: [
    {
      title: '1. 당사자의 지위',
      body: '주식회사 123솔루션(이하 "회사")은 통신판매업자로서 123Band에서 행사패스·상품을 직접 판매하며, 구매자와 체결되는 매매계약의 당사자가 됩니다. 오거나이저는 회사에 상품·행사패스를 등록·공급하고 행사를 실제로 주최·운영하는 사업자입니다. 회사는 오거나이저를 대리하지 않으며, 오거나이저 또한 회사를 대리하지 않습니다.',
    },
    {
      title: '2. 등록 수수료 및 판매 수수료',
      body: '123Band에 행사를 등록하는 데에는 선불 등록 수수료가 부과되지 않습니다. 다만 판매가 성사된 건에 대해서는 판매 수수료가 부과됩니다. 판매 수수료율은 기본 10%이며, 오거나이저별로 회사와 별도 합의한 요율이 있는 경우 그 요율이 적용됩니다. 적용 중인 요율과 예상 정산액은 오거나이저 대시보드의 매출 화면에서 확인할 수 있습니다.',
    },
    {
      title: '3. 123Band 회원 혜택',
      body: '회사는 오거나이저가 123Band 회원에게 전용 할인 등의 혜택을 제공할 것을 권장하며, 그 조건은 회사와 오거나이저가 개별적으로 합의합니다. 합의된 혜택은 해당 행사가 플랫폼에 게시되어 있는 기간 동안 유지되어야 합니다.',
    },
    {
      title: '4. 판매 대금의 정산',
      body: '구매자 보호를 위해 티켓 판매 수익은 행사 종료 시점까지 회사가 보관합니다. 회사는 페스티벌이 공식적으로 종료된 후 영업일 기준 7일 이내에, 판매액에서 판매 수수료와 환불·취소분을 공제한 금액을 오거나이저가 사전에 지정한 계좌로 지급하는 것을 원칙으로 합니다. 다만 환불 분쟁이 진행 중이거나 정산 계좌 정보에 오류가 있는 등 확인이 필요한 사유가 있는 경우, 회사는 해당 사유가 해소될 때까지 정산의 전부 또는 일부를 보류할 수 있으며 그 사유를 오거나이저에게 통지합니다.',
    },
    {
      title: '5. 등록 정보의 정확성',
      body: '오거나이저는 등록한 행사 정보(일정, 장소, 라인업, 가격, 환불 규정 등)의 정확성에 대하여 책임을 집니다. 회사는 게시 전 등록 내용을 검토하며, 법령 위반이나 타인의 권리 침해가 확인되는 경우 게시를 거부하거나 판매를 중단할 수 있습니다.',
    },
    {
      title: '6. 행사에 대한 책임',
      body: '오프라인 행사의 진행에 대한 책임은 전적으로 오거나이저에게 있습니다. 여기에는 행사장 안전, 아티스트 섭외, 일정 변경 및 현지 인허가 취득 등이 포함됩니다. 회사는 판매 및 홍보 플랫폼으로서 판매자의 책임을 부담하나, 행사 현장에서 발생하는 상해·분쟁 또는 행사 진행상의 차질에 대해서는 오거나이저가 책임을 집니다.',
    },
    {
      title: '7. 취소 및 환불',
      body: '오거나이저가 페스티벌을 취소하거나 라인업·일정에 중대한 변경을 가하는 경우, 구매자에 대한 환불은 회사가 판매 당사자로서 즉시 진행합니다. 오거나이저는 이로 인해 회사가 구매자에게 지급한 환불 금액을 회사에 반환하여야 하며, 미정산 판매 대금이 있는 경우 회사는 이를 환불 금액과 상계할 수 있습니다.',
    },
    {
      title: '8. 콘텐츠 및 지식재산권',
      body: '오거나이저가 업로드하는 플라이어·영상·이미지 등은 오거나이저가 적법한 권리를 보유하거나 사용 허락을 받은 것이어야 합니다. 세부 사항과 침해 신고 절차는 지식재산권 정책에 따릅니다.',
    },
    {
      title: '9. 약관 위반 및 계약 해지',
      body: '오거나이저가 본 약관 또는 관련 법령을 위반하는 경우, 회사는 게시 중단, 판매 중지, 정산 보류 및 오거나이저 계정의 이용 정지 조치를 할 수 있습니다.',
    },
    {
      title: '10. 문의',
      body: '오거나이저 등록·정산 관련 문의: bandnara123@gmail.com',
    },
  ],
};

const EN: { intro: string; sections: Section[] } = {
  intro:
    'This agreement applies to Organizers listing festivals and event passes on 123Band. By publishing an event on the platform you agree to these terms, which apply in addition to the 123Band Terms of Service.',
  sections: [
    {
      title: '1. Status of the parties',
      body: '123 Solution Co., Ltd. ("Company") is a mail-order seller that sells event passes and products directly on 123Band and is the party to the sales contract with the buyer. The Organizer is the business that registers and supplies those passes and actually hosts and runs the event. Neither party acts as an agent for the other.',
    },
    {
      title: '2. Listing fee and sales commission',
      body: 'There is no upfront fee to list an event on 123Band. A sales commission applies to completed sales. The standard commission rate is 10%; where a different rate has been separately agreed with an Organizer, that rate applies. Your current rate and expected payout are shown in the Sales screen of the Organizer dashboard.',
    },
    {
      title: '3. Benefits for 123Band members',
      body: 'We encourage Organizers to offer 123Band members an exclusive discount or similar benefit, on terms agreed individually with the Company. Any agreed benefit must remain available for as long as the event is listed on the platform.',
    },
    {
      title: '4. Payouts',
      body: 'To protect buyers, ticket revenue is held by the Company until the event concludes. As a rule, we pay out to the Organizer’s designated bank account within 7 business days after the festival officially concludes, less the sales commission and any refunded or cancelled orders. Where verification is needed — for example an open refund dispute or incorrect settlement details — we may withhold all or part of a payout until the issue is resolved, and will notify the Organizer of the reason.',
    },
    {
      title: '5. Accuracy of listings',
      body: 'Organizers are responsible for the accuracy of the event information they register (dates, venue, line-up, pricing, refund terms). The Company reviews submissions before publication and may refuse a listing or suspend sales where a legal violation or infringement of third-party rights is identified.',
    },
    {
      title: '6. Event liability',
      body: 'The Organizer holds full responsibility for running the physical event, including venue safety, artist bookings, schedule changes, and local permits. The Company bears a seller’s responsibilities as a sales and promotional platform, but the Organizer is responsible for injuries, disputes, and logistical failures at the event itself.',
    },
    {
      title: '7. Cancellations and refunds',
      body: 'If the Organizer cancels a festival or materially changes its line-up or dates, the Company — as the seller — refunds buyers immediately. The Organizer must reimburse the Company for those refunds, and the Company may set the amount off against any unpaid sales revenue held for that Organizer.',
    },
    {
      title: '8. Content and intellectual property',
      body: 'Flyers, video, images, and other media uploaded by an Organizer must be owned by, or properly licensed to, that Organizer. Details and the infringement reporting procedure are set out in our Intellectual Property Policy.',
    },
    {
      title: '9. Breach and termination',
      body: 'If an Organizer breaches this agreement or applicable law, the Company may unpublish listings, suspend sales, withhold payouts, and suspend the Organizer’s account.',
    },
    {
      title: '10. Contact',
      body: 'Organizer onboarding and payout inquiries: bandnara123@gmail.com',
    },
  ],
};

export default async function OrganizerTermsPage({ params }: { params: { locale: string } }) {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  const c = locale === 'ko' ? KO : EN;
  const effective = locale === 'ko' ? '시행일: 2026년 1월 1일' : 'Effective: January 1, 2026';

  return (
    <div className="container-band max-w-3xl py-10">
      <h1 className="section-title mb-2">{dict.footer.organizerTerms}</h1>
      <p className="mb-8 text-xs text-grey-400">{effective}</p>

      <p className="mb-8 leading-relaxed text-grey-700">{c.intro}</p>

      <div className="space-y-7">
        {c.sections.map((s) => (
          <section key={s.title}>
            <h2 className="mb-2 font-display text-lg">{s.title}</h2>
            <p className="leading-relaxed text-grey-700">{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
