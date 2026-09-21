// 설문 전용 페이지 — 주최자가 참가자에게 링크로 보내는 곳. 행사 상세 없이 설문만 보여 준다.
//
// 행사 상세페이지에도 같은 설문이 붙지만, 끝난 행사는 대개 비전시라 상세페이지가 열리지 않는다.
// 이 페이지는 전시 여부와 무관하게 '설문을 켠 행사' 면 열린다(getFeedbackEvent 참고).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { formatEventAddress, pickI18n, type Locale } from '@123band/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { intlLocale } from '@/lib/locale';
import { getFeedbackEvent } from '@/lib/queries/feedback-event';
import { EventFeedback } from '@/components/product/EventFeedback';

export const dynamic = 'force-dynamic';

type Params = { params: { locale: string; slug: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const locale = params.locale as Locale;
  const [dict, event] = await Promise.all([getDictionary(locale), getFeedbackEvent(params.slug)]);
  // 설문이 꺼졌거나 없는 행사 — 404 화면을 띄운다. 행사 이름이 없는 제목을 만들 이유도 없다.
  // (참고: [locale]/loading.tsx 가 스트리밍을 먼저 열어 상태 코드는 200 으로 나간다. 행사 상세도 같다.)
  if (!event) notFound();
  const name = pickI18n(event.name_i18n, locale);
  return {
    title: `${name || event.slug} — ${dict.feedback.title}`,
    // 설문은 검색에 걸릴 이유가 없다 — 링크를 받은 참가자만 들어온다.
    robots: { index: false, follow: false },
  };
}

/** datetime-local(TZ 없음)은 KST 절대시각으로 읽는다 — 행사 상세(EventDetail)와 같은 규칙. */
function fmtDate(iso: string | null, locale: Locale): string {
  if (!iso) return '';
  const d = new Date(/[+Z]/.test(iso) ? iso : `${iso}+09:00`);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(intlLocale(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Seoul',
  }).format(d);
}

export default async function FeedbackPage({ params }: Params) {
  const locale = params.locale as Locale;
  const [dict, event] = await Promise.all([getDictionary(locale), getFeedbackEvent(params.slug)]);
  if (!event) notFound();

  const start = fmtDate(event.startAt, locale);
  const end = fmtDate(event.endAt, locale);
  const when = start && end && start !== end ? `${start} – ${end}` : start;
  const where = pickI18n(event.location ?? undefined, locale) || formatEventAddress(event.address ?? undefined, locale);

  return (
    <EventFeedback
      productId={event.id}
      locale={locale}
      dict={dict}
      event={{
        name: pickI18n(event.name_i18n, locale) || event.slug,
        cover: event.image_url,
        when,
        where,
      }}
    />
  );
}
