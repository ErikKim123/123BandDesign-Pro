// 취소·환불 정책 — 한/영. 표준 템플릿(운영사/법무 검토 후 확정 필요).
import type { Metadata } from 'next';
import type { Locale } from '@123band/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-static';

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale = params.locale as Locale;
  const title = locale === 'ko' ? '취소·환불 정책' : 'Cancellation & Refund Policy';
  const description =
    locale === 'ko'
      ? '123Band 상품·행사패스 취소·환불 기준 안내입니다.'
      : 'Cancellation and refund policy for 123Band products and event passes.';
  return buildMetadata({ locale, path: '/refund', title, description });
}

type Section = { title: string; body: string };

const KO: { intro: string; sections: Section[] } = {
  intro: '본 정책은 123Band에서 구매한 상품·행사패스(티켓)의 취소·청약철회·환불 기준을 안내합니다. 「전자상거래 등에서의 소비자보호에 관한 법률」을 준수합니다.',
  sections: [
    { title: '1. 청약철회(일반 상품)', body: '실물 상품은 수령일로부터 7일 이내 청약철회가 가능합니다. 다만 이용자의 책임 있는 사유로 상품이 훼손된 경우, 사용·소비로 가치가 현저히 감소한 경우 등 법령상 예외에 해당하면 청약철회가 제한될 수 있습니다.' },
    { title: '2. 행사패스(티켓) 취소·환불', body: '행사패스는 행사 특성상 각 행사 상세 페이지에 표시된 취소·환불 정책이 우선 적용됩니다. 환불 규정(예: 행사일 기준 D-30 전액, D-7 50% 등)을 반드시 확인하세요. 단, 오거나이저의 사정으로 행사가 취소되거나 일정·내용이 중대하게 변경된 경우에는 전액 환불됩니다. 회사는 통신판매업자로서 판매의 당사자이므로, 오거나이저와의 정산 여부와 관계없이 이용자에 대한 환불 책임을 부담합니다.' },
    { title: '3. 환불 사유', body: '다음의 경우 환불을 신청할 수 있습니다. ① 단순 변심 — 실물 상품 수령 후 7일 이내(청약철회). ② 상품의 하자·표시/광고와 다름·오배송 — 상품 수령일로부터 3개월 이내 또는 그 사실을 안 날(알 수 있었던 날)로부터 30일 이내. ③ 행사패스 — 행사 취소·중대한 일정/내용 변경, 또는 각 행사에 명시된 환불 규정에 해당하는 경우. 환불 사유에 따라 반품 배송비 부담 주체(단순 변심은 이용자 부담, 상품 하자·오배송은 판매자 부담)가 달라질 수 있습니다.' },
    { title: '4. 환불 신청 방법', body: '내 계정 > 주문내역에서 해당 주문의 취소·환불을 신청하거나, 고객센터(bandnara123@gmail.com)로 주문번호와 함께 요청해 주세요.' },
    { title: '5. 환불 처리 절차', body: '① 신청 접수(주문내역 또는 고객센터) → ② 사유 확인 및 상품 상태 검수 → ③ 승인 또는 거절 결과 안내 → ④ 승인 시 결제수단으로 환급. 진행 상황은 주문내역에서 확인할 수 있습니다.' },
    { title: '6. 환불 처리 소요기간 및 통화(환율)', body: '환불 승인 후 영업일 기준 3~5일 이내 결제수단으로 환급됩니다. 카드사·결제대행사 사정에 따라 실제 반영(카드 취소·계좌 입금)까지 추가 시일이 소요될 수 있습니다. 해외 결제의 경우 환율 변동이나 해외 결제 수수료로 인해 최종 환급 금액이 결제 금액과 달라질 수 있으며, 이 차액에 대해서는 회사가 책임지지 않습니다.' },
    { title: '7. 부분 취소', body: '여러 상품을 한 번에 결제한 경우 일부 상품만 취소가 가능하며, 쿠폰·할인 적용분은 정책에 따라 재계산될 수 있습니다.' },
    { title: '8. 패스의 양도(선물하기)', body: '행사패스는 선물하기 기능을 통해 다른 123Band 회원에게 무상으로 양도할 수 있으며, 양도 시 기존 QR 코드는 무효화되고 수령 회원에게 새 패스가 발급됩니다. 취소·환불은 최초 구매자의 결제수단을 기준으로 처리됩니다. 회사는 회원 간 패스의 유상 재판매를 중개하지 않으며 이를 금지합니다. 패스에 기재되는 참가자 명의의 변경이 필요한 경우에는 해당 행사의 오거나이저에게 직접 문의하여야 하며, 오거나이저의 개별 정책과 마감일이 적용됩니다.' },
    { title: '9. 환불 불가 사유', body: '다음의 경우 환불이 제한됩니다. ① 사용 완료된 패스 — 행사 현장에서 QR 코드가 스캔·확인되는 즉시 사용됨으로 처리되어 환불이 불가합니다. ② 이미 제공이 개시된 디지털 콘텐츠. ③ 구매 시점에 행사 상세 페이지에 환불 불가로 명시된 패스.' },
    { title: '10. 문의', body: '취소·환불 관련 문의: bandnara123@gmail.com' },
  ],
};

const EN: { intro: string; sections: Section[] } = {
  intro: 'This policy explains cancellation, withdrawal, and refund rules for products and event passes purchased on 123Band, in compliance with the Act on Consumer Protection in Electronic Commerce.',
  sections: [
    { title: '1. Withdrawal (General Products)', body: 'Physical goods may be returned within 7 days of receipt. Withdrawal may be limited in statutory exceptions, e.g., if the product is damaged due to the buyer, or its value is significantly reduced by use/consumption.' },
    { title: '2. Event Pass (Ticket) Cancellation & Refund', body: 'For event passes, the cancellation/refund policy shown on each event detail page takes precedence due to the nature of events. Please check the refund terms (e.g., 100% by D-30, 50% by D-7). If the Organizer cancels the event or materially changes its schedule or content, a full refund is provided. As the mail-order seller and the party to the sales contract, the Company is responsible for refunding you regardless of its settlement status with the Organizer.' },
    { title: '3. Grounds for Refund', body: 'You may request a refund in the following cases: (1) Change of mind — physical goods within 7 days of receipt (withdrawal); (2) Defective, misdescribed, or mis-shipped goods — within 3 months of receipt, or 30 days from when you became (or could have become) aware; (3) Event passes — event cancellation, material schedule/content changes, or as specified in each event’s refund terms. Who bears return shipping may vary by reason (buyer for change of mind; seller for defective/mis-shipped goods).' },
    { title: '4. How to Request a Refund', body: 'Request cancellation/refund from My Account > Orders, or contact support (bandnara123@gmail.com) with your order number.' },
    { title: '5. Refund Procedure', body: '(1) Submit request (Orders page or support) → (2) Review of reason and item condition → (3) Approval or rejection notice → (4) On approval, refund to the original payment method. You can track progress in your Orders.' },
    { title: '6. Refund Processing Time & Currency', body: 'After approval, refunds are issued to the original payment method within 3–5 business days. Actual posting (card reversal / bank deposit) may take longer depending on the card/payment provider. For international transactions, the final refunded amount may differ from the amount paid because of exchange rate fluctuations or cross-border banking fees; the Company is not responsible for that difference.' },
    { title: '7. Partial Cancellation', body: 'If multiple items were paid together, individual items may be cancelled; coupons/discounts may be recalculated per policy.' },
    { title: '8. Pass Transfers (Gifting)', body: 'Event passes may be transferred free of charge to another 123Band member using the gift feature; on transfer the original QR code is invalidated and a new pass is issued to the recipient. Cancellations and refunds are processed against the original buyer’s payment method. The Company does not facilitate paid resale of passes between users and prohibits it. If the attendee name on a pass needs to be changed, contact the event Organizer directly — their individual transfer policy and deadlines apply.' },
    { title: '9. Non-refundable Cases', body: 'Refunds are denied in the following cases: (1) Used passes — the moment a QR code is scanned or verified at the venue, the pass is classified as used and is non-refundable; (2) digital content already delivered; (3) passes explicitly marked non-refundable on the event detail page at the time of purchase.' },
    { title: '10. Contact', body: 'Cancellation/refund inquiries: bandnara123@gmail.com' },
  ],
};

export default async function RefundPage({ params }: { params: { locale: string } }) {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  const c = locale === 'ko' ? KO : EN;
  const effective = locale === 'ko' ? '시행일: 2026년 1월 1일' : 'Effective: January 1, 2026';

  return (
    <div className="container-band max-w-3xl py-10">
      <h1 className="section-title mb-2">{dict.footer.refund}</h1>
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
