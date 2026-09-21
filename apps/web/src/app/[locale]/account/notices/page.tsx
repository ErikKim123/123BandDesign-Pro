// Design Ref: 마이페이지 — 알림 탭. 운영자가 보낸 메시지가 최신순으로 쌓인다.
// 공통 헤더(캐릭터/QR)와 탭 네비는 account/layout.tsx 가 그린다 — 여기선 본문만.
//
// 들어오는 순간 읽음 처리한다(NoticesView 가 mark_notices_read 호출) — 종 배지가 바로 사라진다.
import type { Locale } from '@123band/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { createClient } from '@/lib/supabase/server';
import { requireCustomer } from '@/lib/auth/guard';
import { NoticesView, type NoticeItem } from '@/components/notices/NoticesView';

export const dynamic = 'force-dynamic';

export default async function NoticesPage({ params }: { params: { locale: string } }) {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  await requireCustomer(locale, 'account/notices');

  // RLS 로 본인 것만 내려온다. 오래된 알림까지 무한히 보여줄 이유는 없어 최근 100건만.
  const { data } = await createClient()
    .from('member_notices')
    .select('id, title, body, title_en, body_en, link_url, icon_url, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <NoticesView items={(data ?? []) as NoticeItem[]} locale={locale} t={dict.notices} />
  );
}
