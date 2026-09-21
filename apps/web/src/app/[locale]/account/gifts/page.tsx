// 선물함 — 3탭(선물하기/선물한/선물받은). 고객 전용 가드. 데이터는 서버에서 조회해 클라이언트 GiftBox 에 주입.
// 마이페이지 공통 헤더/탭은 account/layout.tsx 가 그린다 — 여기선 본문만.
import type { Locale } from '@123band/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { requireCustomer } from '@/lib/auth/guard';
import { getGiftableItems, getSentGifts, getReceivedGifts } from '@/lib/queries/gifts';
import { GiftBox } from '@/components/account/GiftBox';

export const dynamic = 'force-dynamic';

export default async function GiftsPage({ params }: { params: { locale: string } }) {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  await requireCustomer(locale, 'account/gifts');

  const [giftable, sent, received] = await Promise.all([
    getGiftableItems(),
    getSentGifts(),
    getReceivedGifts(),
  ]);

  return (
    <div>
      <GiftBox t={dict.gifts} locale={locale} giftable={giftable} sent={sent} received={received} />
    </div>
  );
}
