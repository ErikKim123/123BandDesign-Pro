// 마이페이지 — 소셜 탭. 소셜 댄스 후 주고받은 "고마움" 하트와 친구 추천 현황.
// 상대방의 이름/캐릭터는 profiles RLS(본인 행만) 때문에 임베드 조인으로 못 가져온다.
// my_hearts / my_referrals RPC 가 노출 가능한 항목만 묶어서 돌려준다.
import { Heart, UserPlus } from 'lucide-react';
import type { Locale } from '@123band/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { createClient } from '@/lib/supabase/server';
import { requireCustomer } from '@/lib/auth/guard';
import { SITE } from '@/lib/seo';
import { CharacterAvatar } from '@/components/account/CharacterAvatar';
import { MyQrCard } from '@/components/social/MyQrCard';
import { HeartScanner } from '@/components/social/HeartScanner';
import { reactionEmoji } from '@/lib/social/reactions';

export const dynamic = 'force-dynamic';

interface HeartRow {
  id: string;
  name: string | null;
  avatar_seed: string | null;
  avatar_url: string | null;
  avatar_traits: unknown;
  social_code: string | null;
  kind: string | null;
  message: string | null;
  created_at: string;
}

interface ReferralPerson {
  name: string | null;
  avatar_seed: string | null;
  avatar_url: string | null;
  avatar_traits: unknown;
  social_code: string | null;
  referred_at?: string | null;
}

export default async function SocialPage({ params }: { params: { locale: string } }) {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  const t = dict.social;

  await requireCustomer(locale, 'account/social');
  const supabase = createClient();

  const [{ data: recvRaw }, { data: givenRaw }, { data: refRaw }, { data: summaryRaw }] =
    await Promise.all([
      supabase.rpc('my_hearts', { p_direction: 'received', p_limit: 50 }),
      supabase.rpc('my_hearts', { p_direction: 'given', p_limit: 50 }),
      supabase.rpc('my_referrals'),
      supabase.rpc('my_social_summary'),
    ]);

  const myCode = (summaryRaw as { social_code?: string | null } | null)?.social_code ?? null;

  const received = (recvRaw ?? []) as HeartRow[];
  const given = (givenRaw ?? []) as HeartRow[];
  const refs = (refRaw ?? null) as {
    referred_by: ReferralPerson | null;
    referrals: ReferralPerson[];
  } | null;
  const referrals = refs?.referrals ?? [];

  const dateFmt = new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  function HeartList({ rows, empty }: { rows: HeartRow[]; empty: string }) {
    if (rows.length === 0) {
      return (
        <p className="mt-4 rounded-lg border border-grey-200 p-6 text-center text-sm text-grey-500">
          {empty}
        </p>
      );
    }
    return (
      <ul className="mt-4 divide-y divide-grey-100 border-y border-grey-100">
        {rows.map((h) => (
          <li key={h.id} className="flex items-center gap-3 py-3">
            <div className="relative shrink-0">
              <CharacterAvatar
                seed={h.avatar_seed}
                photoUrl={h.avatar_url}
                traits={h.avatar_traits}
                size={40}
                label={h.name ?? ''}
              />
              {/* 어떤 반응이었는지 캐릭터 우하단에 배지로 */}
              <span
                aria-hidden
                className="absolute -bottom-1 -right-1 rounded-full bg-white px-1 text-sm leading-none shadow-sm"
              >
                {reactionEmoji(h.kind)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{h.name || t.anonymous}</p>
              {h.message ? (
                <p className="truncate text-sm text-grey-600">{h.message}</p>
              ) : (
                <p className="font-mono text-xs tracking-widest text-grey-400">{h.social_code}</p>
              )}
            </div>
            <span className="shrink-0 text-xs tabular-nums text-grey-400">
              {dateFmt.format(new Date(h.created_at))}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div>
      {/* 하트 받기(내 QR) ↔ 하트 주기(카메라 스캔) — 소셜 탭의 핵심 동작 두 개를 나란히 */}
      <div className="grid gap-4 sm:grid-cols-2">
        <MyQrCard locale={locale} code={myCode} siteUrl={SITE} t={t} />
        <HeartScanner t={t} />
      </div>

      <p className="mt-4 rounded-lg bg-cream-light px-4 py-3 text-sm text-grey-600">
        {t.dailyLimit}
      </p>

      {/* 받은 하트 */}
      <section className="mt-8">
        <h2 className="section-title flex items-center gap-2">
          <Heart size={18} className="text-primary" aria-hidden />
          {t.receivedTitle}
          {received.length > 0 && (
            <span className="rounded-pill bg-primary px-2 py-0.5 text-xs font-semibold text-white">
              {received.length}
            </span>
          )}
        </h2>
        <HeartList rows={received} empty={t.emptyReceived} />
      </section>

      {/* 보낸 하트 */}
      <section className="mt-10">
        <h2 className="section-title flex items-center gap-2">
          <Heart size={18} className="text-grey-400" aria-hidden />
          {t.givenTitle}
        </h2>
        <HeartList rows={given} empty={t.emptyGiven} />
      </section>

      {/* 친구 추천 */}
      <section className="mt-10">
        <h2 className="section-title flex items-center gap-2">
          <UserPlus size={18} className="text-grey-400" aria-hidden />
          {t.referralTitle}
        </h2>

        {refs?.referred_by && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-primary/30 bg-cream p-4">
            <CharacterAvatar
              seed={refs.referred_by.avatar_seed}
              photoUrl={refs.referred_by.avatar_url}
              traits={refs.referred_by.avatar_traits}
              size={40}
              label=""
            />
            <div className="min-w-0">
              <p className="text-xs text-grey-500">{t.referredBy}</p>
              <p className="truncate font-medium">{refs.referred_by.name || t.anonymous}</p>
            </div>
          </div>
        )}

        {referrals.length === 0 ? (
          <p className="mt-4 rounded-lg border border-grey-200 p-6 text-center text-sm text-grey-500">
            {t.emptyReferral}
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {referrals.map((r) => (
              <li
                key={r.social_code ?? r.name}
                className="flex flex-col items-center gap-2 rounded-lg border border-grey-200 p-4 text-center"
              >
                <CharacterAvatar
                  seed={r.avatar_seed}
                  photoUrl={r.avatar_url}
                  traits={r.avatar_traits}
                  size={52}
                  label={r.name ?? ''}
                />
                <p className="w-full truncate text-sm font-medium">{r.name || t.anonymous}</p>
                {r.referred_at && (
                  <p className="text-xs tabular-nums text-grey-400">
                    {dateFmt.format(new Date(r.referred_at))}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
