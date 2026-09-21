// 커뮤니티 가이드라인 — 한/영. 운영사 제공 원문(Drive)을 실제 구현에 맞게 조정했다.
// 포인트 적립 경로는 실제 구현(가입 보너스·상품평·상품문의·업적)만 기재한다.
// 소셜 미디어 댓글 적립은 미구현이므로 제외.
import type { Metadata } from 'next';
import type { Locale } from '@123band/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-static';

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale = params.locale as Locale;
  const title = locale === 'ko' ? '커뮤니티 가이드라인' : 'Community Guidelines';
  const description =
    locale === 'ko'
      ? '123Band 커뮤니티에서 지켜야 할 기본 원칙입니다.'
      : 'The ground rules for taking part in the 123Band community.';
  return buildMetadata({ locale, path: '/guidelines', title, description });
}

type Section = { title: string; body: string };

const KO: { intro: string; sections: Section[] } = {
  intro:
    '123Band는 글로벌 라틴 댄스 커뮤니티를 위한 공간입니다. 모든 이용자는 플랫폼 내에서 상호 존중하며, 유익하고 진정성 있게 활동해야 합니다.',
  sections: [
    {
      title: '1. 포인트 및 디지털 배지 이용 수칙',
      body: '123Band는 적극적으로 활동하는 커뮤니티 회원에게 보상을 제공합니다. 포인트는 회원가입, 구매한 상품에 대한 상품평(리뷰) 작성, 상품 문의(Q&A) 작성, 업적 달성 등 서비스 화면에 안내된 활동을 통해 적립됩니다. 단, 포인트 획득만을 목적으로 무의미하거나 반복적인 글을 도배(스팸)하거나 시스템을 악용해서는 안 됩니다. 어뷰징이 확인된 계정에 대해 회사는 포인트를 회수·초기화하거나 발급된 디지털 배지를 회수할 수 있습니다.',
    },
    {
      title: '2. 허위 리뷰 작성 금지',
      body: '회원이 남기는 페스티벌·상품 평점과 리뷰는 다른 댄서들의 여행 계획 수립에 중요한 정보가 됩니다. 반드시 본인이 직접 구매하거나 참석한 대상에 대해서만 리뷰와 평점을 남겨야 합니다. 허위 리뷰로 확인될 경우 해당 게시물은 삭제되며, 반복될 경우 서비스 이용이 제한될 수 있습니다.',
    },
    {
      title: '3. 행동 규범',
      body: '123Band는 괴롭힘, 혐오 발언, 부적절한 콘텐츠 게시를 엄격하게 금지합니다. 프로필 정보, 댓글 게시 및 다른 이용자와의 모든 소통 과정에서 건전성을 유지해 주십시오. 소셜 댄스 플로어에서 타인을 배려하고 존중하듯 온라인에서도 동일한 매너를 지켜주시기 바랍니다. 본 규범을 위반하는 경우 게시물 삭제 및 계정 이용 정지 조치가 취해질 수 있습니다.',
    },
    {
      title: '4. 소셜 하트와 친구 추천',
      body: '하트는 소셜 댄스 플로어에서 실제로 함께 춤춘 상대에게 전하는 감사의 표시입니다. 같은 상대에게는 하루 한 번만 보낼 수 있습니다. 하트나 추천 수를 늘리기 위해 여러 계정을 만들거나 자동화된 수단을 사용하는 행위는 금지되며, 확인될 경우 관련 기록이 삭제되고 소셜 기능 이용이 정지될 수 있습니다. 하트에 남기는 메시지에도 본 가이드라인의 행동 규범이 동일하게 적용됩니다.',
    },
    {
      title: '5. 타인의 저작물 존중',
      body: '사진·영상 등 콘텐츠를 업로드할 때에는 본인이 해당 저작물에 대한 권리를 보유하거나 원저작권자의 허락을 받아야 합니다. 자세한 내용과 침해 신고 절차는 지식재산권 정책을 참고해 주세요.',
    },
    {
      title: '6. 신고 및 문의',
      body: '가이드라인 위반 사례를 발견하셨거나 조치에 대해 이의가 있으시면 bandnara123@gmail.com으로 연락해 주시기 바랍니다.',
    },
  ],
};

const EN: { intro: string; sections: Section[] } = {
  intro:
    '123Band is a global hub for the Latin dance community. We expect all users to keep the platform respectful, helpful, and authentic.',
  sections: [
    {
      title: '1. Gamification integrity',
      body: 'We reward active community members. Points are earned through the activities announced in the Service — signing up, writing a review of a product you purchased, posting a product Q&A, and unlocking achievements. Do not post low-effort or repetitive content, or otherwise game the system, just to farm points. We reserve the right to reclaim or reset points and revoke digital badges for accounts caught abusing the programme.',
    },
    {
      title: '2. Authentic reviews',
      body: 'Your festival and product ratings help other dancers make travel decisions. Only review and rate what you actually purchased or attended. Reviews found to be fake will be deleted, and repeated violations may lead to restrictions on your account.',
    },
    {
      title: '3. Code of conduct',
      body: 'We do not tolerate harassment, hate speech, or inappropriate content. Keep your profile details, comments, and interactions with other users clean. Treat others with the same respect you would show on the social dance floor. Violations may result in content removal and account suspension.',
    },
    {
      title: '4. Social hearts and referrals',
      body: 'A heart is a thank-you to someone you actually danced with on the social floor. You can send one heart per person per day. Creating multiple accounts or using automated means to inflate your heart or referral count is prohibited; where we find it, the records are deleted and social features may be suspended. The code of conduct above applies equally to any message attached to a heart.',
    },
    {
      title: '5. Respect other people’s work',
      body: 'When you upload photos, video, or other media, you must own the rights to it or have permission from the original owner. See our Intellectual Property Policy for details and for how to report an infringement.',
    },
    {
      title: '6. Reporting and contact',
      body: 'If you spot a violation of these guidelines, or wish to dispute an action taken on your account, contact us at bandnara123@gmail.com.',
    },
  ],
};

export default async function GuidelinesPage({ params }: { params: { locale: string } }) {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  const c = locale === 'ko' ? KO : EN;
  const effective = locale === 'ko' ? '시행일: 2026년 1월 1일' : 'Effective: January 1, 2026';

  return (
    <div className="container-band max-w-3xl py-10">
      <h1 className="section-title mb-2">{dict.footer.guidelines}</h1>
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
