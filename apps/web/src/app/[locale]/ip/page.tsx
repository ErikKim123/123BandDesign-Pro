// 지식재산권 정책 — 한/영. 운영사 제공 원문(Drive)을 그대로 반영(충돌 항목 없음).
import type { Metadata } from 'next';
import type { Locale } from '@123band/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-static';

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale = params.locale as Locale;
  const title = locale === 'ko' ? '지식재산권 정책' : 'Intellectual Property Policy';
  const description =
    locale === 'ko'
      ? '123Band의 저작권 보호 원칙과 침해 신고·게시중단 절차입니다.'
      : 'How 123Band protects copyright, and how to report an infringement.';
  return buildMetadata({ locale, path: '/ip', title, description });
}

type Section = { title: string; body: string };

const KO: { intro: string; sections: Section[] } = {
  intro:
    '회사는 댄스 씬(scene)에서 활동하는 비디오그래퍼, 아티스트, 사진작가의 창작물을 존중하며, 오거나이저 및 이용자에게도 동일한 의무를 요구합니다.',
  sections: [
    {
      title: '1. 콘텐츠 업로드',
      body: '123Band에 페스티벌 홍보물(플라이어), 프로모션 영상, 프로필 사진 등을 업로드하는 경우, 업로드하는 분은 반드시 해당 미디어에 대한 적법한 권리를 소유하거나 사용 권한을 확보하고 있어야 합니다. 원저작권자의 명시적인 사전 허락 없이 저작권 보호를 받는 음악, 이미지 또는 아티스트의 브랜딩을 무단으로 사용해서는 안 됩니다.',
    },
    {
      title: '2. 저작권 침해 신고',
      body: '귀하의 창작물이 허락 없이 123Band에 업로드되었다고 판단되는 경우, bandnara123@gmail.com으로 이메일을 보내 신고해 주시기 바랍니다. 신고 시 당사 웹사이트 내 침해 의심 콘텐츠의 직접적인 링크(URL)와 귀하가 원저작권자임을 입증할 수 있는 증빙 자료를 반드시 포함해 주십시오.',
    },
    {
      title: '3. 게시 중단(Takedown) 절차',
      body: '회사는 접수된 모든 유효한 신고를 신속하게 검토합니다. 저작권 규정을 명백하게 위반한 콘텐츠로 확인될 경우 즉시 삭제(게시 중단) 조치합니다. 또한, 해당 콘텐츠를 업로드한 이용자 또는 오거나이저에게 조치 사실을 공식적으로 통보합니다.',
    },
    {
      title: '4. 반복 위반자에 대한 조치',
      body: '타인의 지식재산권을 반복적으로 침해하는 오거나이저 또는 이용자는 123Band 플랫폼 이용이 영구적으로 정지(차단)됩니다.',
    },
  ],
};

const EN: { intro: string; sections: Section[] } = {
  intro:
    'We respect the work of videographers, artists, and photographers in the dance scene. We require our Organizers and users to do the same.',
  sections: [
    {
      title: '1. Uploading content',
      body: 'When you upload festival flyers, promotional videos, or profile avatars to 123Band, you must own the rights to that media. Do not use copyrighted music, images, or artist branding without explicit permission from the original owner.',
    },
    {
      title: '2. Reporting copyright violations',
      body: 'If you believe your original work has been uploaded to 123Band without your permission, please email us at bandnara123@gmail.com. Include a direct link to the infringing content on our site and proof of your original ownership.',
    },
    {
      title: '3. Takedown procedure',
      body: 'We review all valid reports promptly. If we find content that clearly violates copyright rules, we will remove it immediately. We will also formally notify the user or Organizer who uploaded it.',
    },
    {
      title: '4. Repeat offenders',
      body: 'Organizers or users who repeatedly violate intellectual property rights will be permanently banned from using the 123Band platform.',
    },
  ],
};

export default async function IpPolicyPage({ params }: { params: { locale: string } }) {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  const c = locale === 'ko' ? KO : EN;
  const effective = locale === 'ko' ? '시행일: 2026년 1월 1일' : 'Effective: January 1, 2026';

  return (
    <div className="container-band max-w-3xl py-10">
      <h1 className="section-title mb-2">{dict.footer.ip}</h1>
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
