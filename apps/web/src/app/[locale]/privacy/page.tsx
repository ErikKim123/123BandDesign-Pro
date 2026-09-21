// 개인정보처리방침 — 한/영. 표준 템플릿(운영사/법무 검토 후 확정 필요).
import type { Metadata } from 'next';
import type { Locale } from '@123band/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-static';

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale = params.locale as Locale;
  const title = locale === 'ko' ? '개인정보처리방침' : 'Privacy Policy';
  const description =
    locale === 'ko'
      ? '123Band 개인정보처리방침입니다.'
      : 'Privacy Policy for 123Band.';
  return buildMetadata({ locale, path: '/privacy', title, description });
}

type Section = { title: string; body: string };

const KO: { intro: string; sections: Section[] } = {
  intro: '주식회사 123솔루션(이하 “회사”)은 「개인정보 보호법」 등 관련 법령을 준수하며, 이용자의 개인정보를 보호하기 위해 다음과 같이 개인정보처리방침을 수립·공개합니다.',
  sections: [
    { title: '1. 수집하는 개인정보 항목', body: '회원가입·서비스 이용 과정에서 이메일, 이름, 휴대폰번호, 국가, 결제정보(거래내역), 접속기록(IP·접속로그) 등을 수집할 수 있습니다. 소셜 로그인 이용 시 해당 서비스가 제공하는 프로필 정보(이메일 등)를 수집합니다. 또한 포인트·디지털 배지 제도와 상품평 기능의 운영을 위해 행사패스 입장 확인 이력(QR 코드 스캔 기록), 이용자가 작성한 콘텐츠(상품평·별점·문의), 업적 달성 이력, 뉴스레터 구독 여부를 수집합니다. 소셜 기능 이용 시에는 캐릭터 아바타 시드, 회사가 발급한 공개 코드, 하트를 주고받은 이력과 메시지, 친구 추천 관계를 수집합니다. 회사는 이용자의 위치정보(GPS)를 수집하지 않습니다. 또한 서비스 이용 분석을 위해 방문자 식별 쿠키(band_vid)로 부여한 익명 식별자와 함께 페이지 조회 기록(방문 경로·시각), 유입 경로(referrer·UTM), 기기 종류와 브라우저 정보, 홈화면 설치 앱 실행 여부, 접속 지역 정보(국가·지역·도시 — IP 기반 추정값이며 GPS 위치정보가 아닙니다)를 수집합니다. 회원이 로그인한 경우 위 익명 식별자를 회원 계정과 연결하여 보관합니다.' },
    { title: '2. 개인정보의 수집·이용 목적', body: '회원 식별 및 관리, 상품·티켓 주문 및 결제·정산, 고객 문의 대응, 서비스 개선 및 부정이용 방지, 법령상 의무 이행을 위해 이용합니다. 또한 이용자의 활동 데이터를 활용하여 포인트를 산정·적립하고, 업적 달성에 따른 디지털 배지를 발급하며, 상품평·별점을 게시·관리하고, 소셜 프로필·하트·친구 추천 기능을 운영합니다. 방문 분석 정보는 어떤 화면에서 이용자가 이탈하는지 파악해 서비스를 개선하고, 유입 경로별 효과를 측정하는 목적으로만 이용하며, 광고 목적의 프로파일링이나 제3자 광고 노출에는 이용하지 않습니다.' },
    { title: '3. 개인정보의 보유 및 이용기간', body: '원칙적으로 수집·이용 목적 달성 시 지체 없이 파기합니다. 다만 전자상거래법 등 관련 법령에 따라 거래·결제 기록 등은 법정 보존기간(예: 계약·청약철회 5년, 대금결제 5년, 소비자 불만·분쟁 3년) 동안 보관합니다.' },
    { title: '4. 개인정보의 제3자 제공', body: '회사는 이용자의 동의 없이 개인정보를 외부에 제공하지 않습니다. 다만 결제·배송 등 거래 이행을 위해 필요한 범위에서 해당 오거나이저·결제대행사 등에 제공될 수 있으며, 행사 입장 관리 및 QR 코드 출석 확인을 위해 해당 행사의 오거나이저와 필요한 범위의 정보를 공유합니다.' },
    { title: '5. 다른 이용자에게 공개되는 정보', body: '① 이용자가 작성한 상품평·문의는 작성 시점의 표시 이름과 함께 다른 이용자에게 공개됩니다. ② 소셜 기능을 이용하는 경우, 회사가 발급한 공개 코드가 담긴 QR을 통해 접속한 사람에게 이용자의 표시 이름, 캐릭터 아바타, 공개 코드, 받은 하트 수, 친구 추천 수가 표시됩니다. 이 화면은 로그인하지 않은 사람도 볼 수 있으나 검색엔진에는 색인되지 않으며, 공개 코드를 알지 못하면 접근할 수 없습니다. ③ 하트를 주고받은 상대와 메시지 내용은 해당 당사자만 확인할 수 있습니다. ④ 이용자의 포인트 잔액, 획득한 디지털 배지, 주문 내역은 본인만 확인할 수 있으며 다른 이용자에게 공개되지 않습니다.' },
    { title: '6. 개인정보 처리의 위탁', body: '회사는 서비스 제공을 위해 결제대행(PayVerse 등), 클라우드 인프라(Supabase 등)에 일부 처리를 위탁할 수 있으며, 수탁사가 법령을 준수하도록 관리·감독합니다.' },
    { title: '7. 쿠키의 사용', body: '회사는 로그인 상태 유지를 위한 인증 쿠키와, 서비스 이용 분석을 위한 자체 방문자 식별 쿠키(band_vid, 보관기간 1년)를 사용합니다. 제3자 광고·마케팅 추적 쿠키나 외부 분석 도구(예: Google Analytics, Meta Pixel)의 쿠키는 사용하지 않습니다. 자세한 내용은 쿠키 정책에서 확인할 수 있습니다.' },
    { title: '8. 이용자의 권리와 행사 방법', body: '이용자는 언제든지 자신의 개인정보를 조회·수정하거나 회원 탈퇴(동의 철회)를 요청할 수 있습니다. 계정 페이지 또는 아래 연락처를 통해 행사할 수 있습니다.' },
    { title: '9. 개인정보의 파기', body: '보유기간 경과 또는 처리목적 달성 시 전자적 파일은 복구 불가능한 방법으로 삭제하고, 출력물은 분쇄·소각합니다.' },
    { title: '10. 개인정보의 안전성 확보 조치', body: '접근권한 관리, 전송구간 암호화, 접근기록 보관 등 관리적·기술적 보호조치를 시행합니다.' },
    { title: '11. 개인정보 보호책임자', body: '개인정보 관련 문의·불만은 다음 연락처로 접수할 수 있습니다. 이메일: bandnara123@gmail.com' },
    { title: '12. 고지의 의무', body: '본 방침의 변경 시 시행일자 및 변경사유를 서비스 화면에 사전 공지합니다.' },
  ],
};

const EN: { intro: string; sections: Section[] } = {
  intro: '123 Solution Co., Ltd. (“Company”) complies with the Personal Information Protection Act and related laws, and establishes this Privacy Policy to protect users’ personal information.',
  sections: [
    { title: '1. Personal Data Collected', body: 'During sign-up and use, we may collect email, name, mobile number, country, payment and transaction records, and access logs (IP, access history). For social login, we collect profile information (e.g., email) provided by that service. To operate our points, digital badge, and review features, we also collect event pass admission records (QR code scans), user-generated content (reviews, star ratings, Q&A), achievement history, and newsletter subscription status. If you use the social features, we also collect your character avatar seed, the public code we issue to you, the record of hearts sent and received together with any messages, and referral relationships. We do not collect users’ GPS location. We also collect service usage analytics: an anonymous identifier issued via a visitor cookie (band_vid), together with page view records (path and time), referral source (referrer, UTM), device type and browser information, whether the site was launched as an installed home-screen app, and approximate access location (country, region, city — derived from IP address, not GPS). If you are signed in, we link that anonymous identifier to your member account.' },
    { title: '2. Purpose of Collection and Use', body: 'To identify and manage members, process orders/payments/settlement, respond to inquiries, improve the service and prevent abuse, and fulfill legal obligations. We also use activity data to calculate and award reward points, issue digital achievement badges, publish and manage reviews and star ratings, and operate the social profile, hearts, and referral features. Usage analytics are used only to understand where users drop off so we can improve the service and to measure the effectiveness of referral sources; they are not used for advertising profiling or third-party ad targeting.' },
    { title: '3. Retention Period', body: 'In principle, data is destroyed without delay once its purpose is achieved. However, transaction/payment records are retained for statutory periods under applicable laws (e.g., contracts/withdrawal 5 years, payments 5 years, consumer complaints/disputes 3 years).' },
    { title: '4. Provision to Third Parties', body: 'We do not provide personal data to third parties without consent, except as necessary to fulfill transactions (e.g., to the relevant Organizer or payment provider). We share the data needed to manage event access and verify QR code attendance with the Organizer of that event.' },
    { title: '5. Information Visible to Other Users', body: '(1) Reviews and Q&A posts you write are shown to other users together with the display name recorded at the time of posting. (2) If you use the social features, anyone who opens the QR link containing your public code can see your display name, character avatar, public code, total hearts received, and referral count. That page is viewable without signing in, but it is not indexed by search engines and cannot be reached without knowing your public code. (3) Who sent or received a heart, and any attached message, are visible only to the two people involved. (4) Your point balance, earned digital badges, and order history are visible only to you and are never shown to other users.' },
    { title: '6. Entrustment of Processing', body: 'We may entrust certain processing to payment providers (e.g., PayVerse) and cloud infrastructure (e.g., Supabase), and supervise them to comply with the law.' },
    { title: '7. Use of Cookies', body: 'We use an authentication cookie to keep you signed in, and our own visitor cookie (band_vid, retained for one year) for usage analytics. We do not use third-party advertising or marketing tracking cookies, nor external analytics tools such as Google Analytics or Meta Pixel. See our Cookie Policy for details.' },
    { title: '8. User Rights', body: 'Users may view or correct their personal data, or request account withdrawal (consent withdrawal) at any time via the account page or the contact below.' },
    { title: '9. Destruction of Personal Data', body: 'Upon expiry of the retention period or achievement of purpose, electronic files are deleted irrecoverably and printouts are shredded or incinerated.' },
    { title: '10. Security Measures', body: 'We apply administrative and technical safeguards including access control, encryption in transit, and access log retention.' },
    { title: '11. Privacy Officer', body: 'Inquiries and complaints regarding personal data can be submitted to: bandnara123@gmail.com' },
    { title: '12. Notice of Changes', body: 'Any change to this policy will be announced in advance within the Service, with the effective date and reason.' },
  ],
};

export default async function PrivacyPage({ params }: { params: { locale: string } }) {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  const c = locale === 'ko' ? KO : EN;
  const effective = locale === 'ko' ? '시행일: 2026년 1월 1일' : 'Effective: January 1, 2026';

  return (
    <div className="container-band max-w-3xl py-10">
      <h1 className="section-title mb-2">{dict.footer.privacy}</h1>
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
