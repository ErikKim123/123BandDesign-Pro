// 현장 QR — 참가자가 행사장에 붙은 QR 을 폰 카메라로 찍으면 열리는 곳.
//
// 로그인 전: 어떤 뱃지인지 보여 주고 로그인/가입으로 보낸다(돌아오면 바로 지급).
// 로그인 후: StationClaim 이 열리자마자 claim_station 을 불러 결과를 보여 준다.
// QR 코드 하나에 대해서만 묻는다(station_info) — 다른 QR 목록은 새지 않는다.
import type { Metadata } from 'next';
import { pickI18n, type I18n, type Locale } from '@123band/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { createClient } from '@/lib/supabase/server';
import { StationClaim, type StationInfo } from '@/components/achievement/StationClaim';

export const dynamic = 'force-dynamic';

type Params = { params: { locale: string; code: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const dict = await getDictionary(params.locale as Locale);
  // 현장 QR 은 검색에 걸릴 이유가 없다.
  return { title: dict.station.title, robots: { index: false, follow: false } };
}

export default async function StationPage({ params }: Params) {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  const supabase = createClient();

  const [{ data: raw }, { data: auth }] = await Promise.all([
    supabase.rpc('station_info', { p_code: params.code }),
    supabase.auth.getUser(),
  ]);

  const r = raw as Record<string, unknown> | null;
  const info: StationInfo | null = r
    ? {
        code: params.code,
        name: pickI18n(r.achievement_name as I18n, locale) || String(r.achievement_code ?? ''),
        description: pickI18n(r.achievement_description as I18n, locale),
        badge: (r.badge_image_url as string) ?? null,
        points: Number(r.point_reward ?? 0),
        eventName: r.event_name ? pickI18n(r.event_name as I18n, locale) : '',
        open: r.open === true,
        validFrom: (r.valid_from as string) ?? null,
        validUntil: (r.valid_until as string) ?? null,
      }
    : null;

  return (
    <StationClaim
      locale={locale}
      dict={dict}
      info={info}
      signedIn={Boolean(auth.user)}
    />
  );
}
