// Design Ref: §5 Phase 4 — 게시판 조회 (공개 글, board_type 별).
// 제목·본문은 다국어(*_i18n). 평문 title/content 는 구버전 행 폴백용으로만 읽는다(0048 마이그레이션).
import { cache } from 'react';
import { pickI18n, type I18n, type Locale } from '@123band/shared';
import { createClient } from '@/lib/supabase/server';

export type BoardType = 'notice' | 'qna' | 'review' | 'faq';

export interface BoardRow {
  id: string;
  board_type: BoardType | null;
  /** @deprecated title_i18n 사용 — 구버전 행 폴백 */
  title: string | null;
  /** @deprecated content_i18n 사용 — 구버전 행 폴백 */
  content: string | null;
  title_i18n: I18n | null;
  content_i18n: I18n | null;
  status: string;
  created_at: string;
}

const COLUMNS = 'id, board_type, title, content, title_i18n, content_i18n, status, created_at';

/** 현재 언어의 제목 — 없으면 영문(기본 로케일) → 평문 폴백 */
export function boardTitle(post: BoardRow, locale: Locale): string {
  return pickI18n(post.title_i18n, locale) || post.title || '';
}

/** 현재 언어의 본문 — 없으면 영문(기본 로케일) → 평문 폴백 */
export function boardContent(post: BoardRow, locale: Locale): string {
  return pickI18n(post.content_i18n, locale) || post.content || '';
}

/** 공개(open) 글 목록 — type 지정 시 해당 유형만 */
export async function getBoards(type?: BoardType): Promise<BoardRow[]> {
  let q = createClient()
    .from('boards')
    .select(COLUMNS)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(50);
  if (type) q = q.eq('board_type', type);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as BoardRow[];
}

export const getBoard = cache(async (id: string): Promise<BoardRow | null> => {
  const { data, error } = await createClient()
    .from('boards')
    .select(COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as BoardRow | null) ?? null;
});
