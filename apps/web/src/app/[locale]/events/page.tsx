// Design Ref: 행사 캘린더 — 티켓(event_content) 행사를 startAt 기준 월 캘린더로 표시.
import type { Metadata } from 'next';
import type { Locale } from '@123band/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { listEvents } from '@/lib/queries/events';
import { EventCalendar } from '@/components/product/EventCalendar';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  const description =
    locale === 'ko'
      ? '월별 라틴 댄스 페스티벌·행사 일정을 캘린더로 확인하고 티켓을 예매하세요.'
      : 'Browse Latin dance festivals and events by month and grab your passes.';
  return buildMetadata({ locale, path: '/events', title: dict.events.title, description });
}

export default async function EventsPage({ params }: { params: { locale: string } }) {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  const events = await listEvents();
  // '오늘' 키는 KST 기준(YYYY-MM-DD) — 서버 타임존 영향 제거
  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

  return (
    <div className="container-band py-8">
      <h1 className="section-title mb-6">{dict.events.title}</h1>
      <EventCalendar events={events} locale={locale} dict={dict} initialKey={todayKey} />
    </div>
  );
}
