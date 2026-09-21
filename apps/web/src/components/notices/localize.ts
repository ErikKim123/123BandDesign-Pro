// 알림 제목·본문을 사이트 언어에 맞춰 고른다(0109).
// 영어 판(title_en/body_en)은 둘 다 있을 때만 쓴다 — 한쪽만 영어면 반쪽짜리가 된다.
// 영어 판이 없는 알림(예전 것·운영자가 영어를 안 적은 공지)은 기존 제목·본문 그대로.
export interface LocalizableNotice {
  title: string;
  body: string;
  title_en?: string | null;
  body_en?: string | null;
}

export function localizeNotice(n: LocalizableNotice, locale: string): { title: string; body: string } {
  if (locale === 'en' && n.title_en && n.body_en) return { title: n.title_en, body: n.body_en };
  return { title: n.title, body: n.body };
}
