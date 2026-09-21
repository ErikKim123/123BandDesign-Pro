// 쿠키 정책 — 한/영. 운영사 제공 원문(Drive)을 실제 구현에 맞게 조정했다.
// 실제로 설정되는 쿠키는 Supabase 인증 세션 쿠키(band-web-auth)뿐이며,
// 장바구니·통화 설정은 localStorage, 언어는 URL 경로(/en, /ko)로 처리한다.
// 선택 분석 쿠키(Microsoft Clarity)는 동의한 방문자에게만 실린다 — 3항에 그 범위와
// 철회 방법을 적고, 화면 아래 ConsentPreference 로 바로 바꿀 수 있게 했다.
// 광고·마케팅 추적 스크립트는 여전히 도입되어 있지 않으므로 기재하지 않는다.
import type { Metadata } from 'next';
import type { Locale } from '@123band/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { ConsentPreference } from '@/components/analytics/ConsentPreference';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-static';

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale = params.locale as Locale;
  const title = locale === 'ko' ? '쿠키 정책' : 'Cookie Policy';
  const description =
    locale === 'ko'
      ? '123Band가 사용하는 쿠키와 이용자의 선택권을 안내합니다.'
      : 'How 123Band uses cookies and the choices available to you.';
  return buildMetadata({ locale, path: '/cookies', title, description });
}

type Section = { title: string; body: string };

const KO: { intro: string; sections: Section[] } = {
  intro:
    '주식회사 123솔루션(이하 "회사")은 123Band 플랫폼에서 쿠키 및 유사 기술을 사용합니다. 본 정책은 쿠키의 정의, 회사가 실제로 사용하는 쿠키의 범위, 그리고 이용자의 통제 권한에 대해 설명합니다.',
  sections: [
    {
      title: '1. 쿠키란 무엇인가요?',
      body: '쿠키는 웹사이트 방문 시 이용자의 기기에 저장되는 작은 텍스트 파일입니다. 쿠키는 웹사이트가 이용자의 작업과 환경설정을 기억하게 하여 동일한 정보를 반복해서 입력하지 않도록 돕습니다.',
    },
    {
      title: '2. 회사가 사용하는 쿠키',
      body: '회사는 서비스 운영에 반드시 필요한 필수 쿠키만 사용합니다. 구체적으로 로그인 상태와 세션을 안전하게 유지하기 위한 인증 쿠키(band-web-auth 및 그 분할 쿠키)를 사용하며, 이 쿠키는 서버에서만 읽을 수 있도록(HttpOnly) 설정됩니다. 필수 쿠키는 서비스 이용에 필수적이므로 수집을 거부할 경우 로그인·결제 등 핵심 기능을 이용할 수 없습니다. 이와 별도로 회사는 서비스 이용 분석을 위한 자체 방문자 식별 쿠키(band_vid)를 사용합니다. 이 쿠키에는 무작위로 생성된 익명 식별자만 담기며 이름·이메일 등 개인을 직접 알아볼 수 있는 정보는 담기지 않습니다. 보관기간은 1년이고, 어떤 화면에서 이용자가 이탈하는지 파악해 서비스를 개선하는 목적으로만 사용합니다. 회원이 로그인한 경우 이 식별자는 회원 계정과 연결되어 보관됩니다. 브라우저의 쿠키 삭제 기능으로 언제든지 지울 수 있으며, 삭제해도 로그인·결제 등 서비스 이용에는 영향이 없습니다.',
    },
    {
      title: '3. 회사가 사용하지 않는 쿠키',
      body: '회사는 이용자가 동의한 경우에 한하여 선택 분석 쿠키를 사용합니다. 현재 사용하는 도구는 Microsoft Clarity(마이크로소프트)이며, 이용자가 어떤 화면에서 막히는지 파악해 서비스를 개선하는 목적으로만 사용합니다. 이 도구는 화면 조작(클릭·스크롤) 기록과 익명 식별자를 마이크로소프트 서버로 전송합니다. 회사는 입력된 텍스트를 수집하지 않도록 설정하여 운영합니다. 선택 분석 쿠키는 필수가 아니며, 동의하지 않아도 로그인·결제를 포함한 모든 기능을 동일하게 이용할 수 있습니다. 동의 여부는 본 페이지 하단의 ‘분석 쿠키 설정’에서 언제든지 바꿀 수 있고, 허용하지 않으면 해당 스크립트를 내려받지 않습니다. 이와 별개로 회사는 광고·마케팅 목적의 추적 쿠키를 일절 사용하지 않으며, 위 2항의 방문 분석은 제3자에게 전송되지 않고 회사 서버에만 기록되는 자체 집계입니다. 향후 다른 제3자 분석·광고 도구를 도입하는 경우 본 정책을 사전에 개정하여 공지하고, 관련 법령에 따라 필요한 동의 절차를 마련하겠습니다.',
    },
    {
      title: '4. 쿠키가 아닌 저장 방식',
      body: '장바구니 내용과 표시 통화 설정은 쿠키가 아니라 이용자의 브라우저 로컬 저장소(localStorage)에 보관되며 서버로 전송되지 않습니다. 언어 설정은 쿠키가 아니라 주소(URL) 경로(/ko, /en)로 구분됩니다. 이 정보들은 브라우저의 저장 데이터 삭제 기능으로 직접 지울 수 있습니다.',
    },
    {
      title: '5. 제3자 쿠키',
      body: '결제 진행 시 결제대행사(PayVerse)의 결제창이 열리며, 해당 창에서는 결제 처리를 위해 결제대행사의 쿠키가 설정될 수 있습니다. 인증 인프라(Supabase)는 회사의 도메인에서 위 인증 쿠키를 설정합니다. 소셜 로그인을 이용하는 경우 해당 인증 제공자의 정책이 함께 적용됩니다.',
    },
    {
      title: '6. 이용자의 선택권',
      body: '이용자는 웹 브라우저 설정을 통해 모든 쿠키 또는 일부 쿠키를 거부하거나, 웹사이트가 쿠키를 설정할 때 알림을 받도록 설정할 수 있습니다. 다만 필수 쿠키를 차단하면 로그인 유지가 불가능하여 123Band의 핵심 기능을 이용할 수 없습니다.',
    },
    {
      title: '7. 정책 업데이트',
      body: '기술 변경이나 법적 요건 변경에 따라 본 정책이 개정될 수 있습니다. 중요한 변경이 있는 경우 개정된 시행일과 함께 본 페이지에 사전 공지합니다.',
    },
    {
      title: '8. 문의처',
      body: '쿠키 사용과 관련된 문의는 다음 이메일로 연락해 주시기 바랍니다: bandnara123@gmail.com',
    },
  ],
};

const EN: { intro: string; sections: Section[] } = {
  intro:
    '123 Solution Co., Ltd. ("Company") uses cookies and similar technologies on the 123Band platform. This policy explains what cookies are, which ones we actually use, and the choices available to you.',
  sections: [
    {
      title: '1. What are cookies?',
      body: 'Cookies are small text files saved on your device when you visit a website. They help the site remember your actions and preferences so you do not have to re-enter them.',
    },
    {
      title: '2. Cookies we use',
      body: 'We use only the essential cookies required to run the service. Specifically, we set an authentication cookie (band-web-auth and its chunked variants) to keep you securely signed in and manage your session. It is HttpOnly, meaning it can only be read by the server. Essential cookies cannot be opted out of — if you block them, core features such as signing in and checking out will not work. Separately, we set our own visitor cookie (band_vid) for usage analytics. It contains only a randomly generated anonymous identifier — no name, email, or other directly identifying information. It is retained for one year and used solely to understand where users drop off so we can improve the service. If you are signed in, this identifier is linked to your member account. You can delete it at any time through your browser; doing so does not affect signing in or checking out.',
    },
    {
      title: '3. Cookies we do not use',
      body: 'We use optional analytics cookies only where you have agreed to them. The tool we currently use is Microsoft Clarity, and we use it solely to see where people get stuck so we can improve the service. It sends interaction records (clicks and scrolling) and an anonymous identifier to Microsoft servers; we run it configured not to collect the text you type. These cookies are not essential — if you decline, every feature, including signing in and checking out, works exactly the same. You can change your choice at any time under ‘Analytics cookie settings’ at the foot of this page, and while you decline the script is never downloaded. Separately, we use no advertising or marketing tracking cookies, and the usage analytics described in section 2 are recorded only on our own servers and never sent to a third party. If we adopt another third-party analytics or advertising tool in the future, we will update this policy in advance and put in place any consent mechanism required by law.',
    },
    {
      title: '4. Storage that is not a cookie',
      body: 'Your cart contents and display currency are kept in your browser’s localStorage rather than in cookies, and are not sent to our servers. Your language preference is carried in the URL path (/en, /ko) rather than in a cookie. You can clear this data yourself through your browser’s site-data settings.',
    },
    {
      title: '5. Third-party cookies',
      body: 'When you pay, our payment provider (PayVerse) opens its own checkout window, which may set that provider’s cookies to process the transaction. Our authentication infrastructure (Supabase) sets the authentication cookie described above on our domain. If you use social login, the policy of that identity provider also applies.',
    },
    {
      title: '6. Your choices',
      body: 'You can set your browser to refuse all or some cookies, or to alert you when a site sets one. Note that blocking essential cookies makes it impossible to stay signed in, so core parts of 123Band will not function.',
    },
    {
      title: '7. Updates to this policy',
      body: 'We may update this policy as our technology or legal requirements change. We will post any material change on this page in advance, together with the new effective date.',
    },
    {
      title: '8. Contact us',
      body: 'If you have questions about our use of cookies, email us at: bandnara123@gmail.com',
    },
  ],
};

export default async function CookiesPage({ params }: { params: { locale: string } }) {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  const c = locale === 'ko' ? KO : EN;
  // 정책이 바뀌면 시행일도 올린다 — 날짜가 그대로면 개정 사실이 보이지 않는다.
  const effective =
    locale === 'ko'
      ? '시행일: 2026년 9월 20일 (개정: 선택 분석 쿠키 도입)'
      : 'Effective: September 20, 2026 (revised: optional analytics cookies)';

  return (
    <div className="container-band max-w-3xl py-10">
      <h1 className="section-title mb-2">{dict.footer.cookies}</h1>
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

      {/* 무엇에 동의했는지 읽은 자리에서 바로 바꿀 수 있어야 한다. */}
      <ConsentPreference t={dict.consent} />
    </div>
  );
}
