// 설문 전용 페이지(/[locale]/feedback/[slug])가 보여 줄 행사 한 건.
//
// 왜 service_role 로 읽나: 설문이 가장 필요한 때는 행사가 끝난 뒤인데, 끝난 행사는 대개 123Band 목록에서
// 내려(비전시) 비로그인에게 products 가 안 보인다. 일반 조회로는 그 행사의 설문 페이지가 404 가 된다.
//
// 대신 노출 범위를 좁힌다 — 주최자가 설문을 켠 행사(feedback_enabled)만, 설문 머리에 필요한 몇 칸만.
// 비전시 행사의 상세 내용(가격·본문)은 여기서 새지 않는다.
import { cache } from 'react';
import type { EventContent, I18n } from '@123band/shared';
import { createAdminClient } from '@/lib/supabase/admin';

export interface FeedbackEvent {
  id: string;
  slug: string;
  name_i18n: I18n;
  image_url: string | null;
  /** 날짜·장소만 쓴다. 나머지 event_content 는 담지 않는다. */
  startAt: string | null;
  endAt: string | null;
  location: I18n | null;
  address: EventContent['address'] | null;
}

export const getFeedbackEvent = cache(async (slug: string): Promise<FeedbackEvent | null> => {
  const admin = createAdminClient();
  if (!admin || !slug) return null;
  const { data, error } = await admin
    .from('products')
    .select('id, slug, name_i18n, image_url, event_content, feedback_enabled, product_type')
    .eq('slug', slug)
    .maybeSingle();
  if (error || !data) return null;
  if (data.feedback_enabled !== true || data.product_type !== 'ticket') return null;

  const ev = (data.event_content ?? {}) as EventContent;
  return {
    id: data.id as string,
    slug: data.slug as string,
    name_i18n: data.name_i18n as I18n,
    image_url: (data.image_url as string) ?? null,
    startAt: ev.startAt ?? null,
    endAt: ev.endAt ?? null,
    location: ev.location ?? null,
    address: ev.address ?? null,
  };
});
