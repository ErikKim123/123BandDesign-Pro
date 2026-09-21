// 소셜 QR 랜딩 — 마이페이지의 내 QR(/{locale}/u/{code})을 찍으면 열리는 화면.
// 두 가지 용도를 하나의 코드로 처리한다.
//   1) 로그인 상태  → 상대에게 오늘의 하트 보내기
//   2) 미로그인 상태 → 추천 코드를 보관하고 가입/로그인 유도 (로그인 후 마이페이지에서 반영)
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Heart, QrCode } from 'lucide-react';
import type { Locale } from '@123band/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { createClient } from '@/lib/supabase/server';
import { CharacterAvatar } from '@/components/account/CharacterAvatar';
import { ReactionPicker } from '@/components/social/ReactionPicker';
import type { ReactionKind } from '@/lib/social/reactions';
import { ReferralCapture } from '@/components/social/Referral';

export const dynamic = 'force-dynamic';

// 개인 프로필이므로 검색엔진에는 올리지 않는다.
export const metadata = { robots: { index: false, follow: false } };

interface SocialProfile {
  id: string;
  name: string | null;
  avatar_seed: string | null;
  avatar_url: string | null;
  avatar_traits: unknown;
  social_code: string;
  hearts_received: number;
  referral_count: number;
  blocked: boolean;
  is_me: boolean;
  sent_kinds: ReactionKind[] | null;
}

export default async function SocialProfilePage({
  params,
}: {
  params: { locale: string; code: string };
}) {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  const t = dict.social;
  const code = decodeURIComponent(params.code).toUpperCase();

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // social_profile_by_code 는 anon 에도 열려 있다(가입 유도 화면을 보여줘야 하므로).
  const { data: raw } = await supabase.rpc('social_profile_by_code', { p_code: code });
  const profile = (raw ?? null) as SocialProfile | null;
  if (!profile) notFound();

  const name = profile.name || t.anonymous;
  // 로그인 후 복귀 경로 — 미들웨어의 소문자 정규화(308)를 타지 않도록 소문자로
  const nextPath = `u/${profile.social_code.toLowerCase()}`;

  return (
    <div className="container-band flex max-w-md flex-col items-center py-12">
      {/* 미로그인 방문자의 추천 코드를 보관 — 로그인 후 마이페이지에서 1회 반영된다 */}
      {!user && <ReferralCapture code={profile.social_code} />}

      <p className="label-caps text-grey-400">{t.profileTitle}</p>

      <div className="mt-5">
        <CharacterAvatar
          seed={profile.avatar_seed}
          photoUrl={profile.avatar_url}
          traits={profile.avatar_traits}
          size={140}
          label={name}
        />
      </div>

      <h1 className="mt-4 text-center font-display text-2xl">{name}</h1>
      <p className="mt-1 font-mono text-xs tracking-[0.2em] text-grey-400">
        {profile.social_code}
      </p>

      <div className="mt-4 flex items-center gap-5 text-sm text-grey-600">
        <span className="inline-flex items-center gap-1.5">
          <Heart size={15} className="fill-primary text-primary" aria-hidden />
          <b className="tabular-nums text-ink">{profile.hearts_received.toLocaleString()}</b>
          {t.heartsReceived}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <QrCode size={15} className="text-grey-400" aria-hidden />
          <b className="tabular-nums text-ink">{profile.referral_count.toLocaleString()}</b>
          {t.referrals}
        </span>
      </div>

      <div className="mt-8 w-full">
        {profile.is_me ? (
          <Link href={`/${locale}/account/social`} className="btn btn-secondary w-full">
            {t.title}
          </Link>
        ) : profile.blocked ? (
          <p className="rounded-lg border border-grey-200 p-5 text-center text-sm text-grey-500">
            {t.errBlocked}
          </p>
        ) : user ? (
          <ReactionPicker
            code={profile.social_code}
            sentKinds={profile.sent_kinds ?? []}
            t={t}
          />
        ) : (
          <div className="space-y-3">
            <p className="text-center text-sm text-grey-600">{t.scanSignupHint}</p>
            <Link
              href={`/${locale}/signup?ref=${profile.social_code}&next=${encodeURIComponent(nextPath)}`}
              className="btn btn-primary w-full"
            >
              {t.signupWithRef}
            </Link>
            <Link
              href={`/${locale}/login?next=${encodeURIComponent(nextPath)}`}
              className="btn btn-secondary w-full"
            >
              {t.loginToHeart}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
