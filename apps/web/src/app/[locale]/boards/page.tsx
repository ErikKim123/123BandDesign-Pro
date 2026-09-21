// Design Ref: §5 Phase 4 — 게시판 목록 (유형 탭 + 글 리스트)
import type { Metadata } from 'next';
import Link from 'next/link';
import type { Locale } from '@123band/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { boardTitle, getBoards, type BoardType } from '@/lib/queries/boards';
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
      ? '공지·자주 묻는 질문(FAQ)·문의 등 123Band 고객지원 게시판입니다.'
      : 'Notices, FAQ and support posts for 123Band.';
  return buildMetadata({ locale, path: '/boards', title: dict.boards.title, description });
}

const TYPES: BoardType[] = ['notice', 'qna', 'review', 'faq'];

export default async function BoardsPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { type?: string };
}) {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  const type = TYPES.includes(searchParams.type as BoardType)
    ? (searchParams.type as BoardType)
    : undefined;
  const posts = await getBoards(type);
  const label = (t: BoardType) => dict.boards[t];

  function Tab({ href, text, active }: { href: string; text: string; active: boolean }) {
    return (
      <Link
        href={href}
        className={`rounded-pill px-4 py-2 text-sm font-medium transition-colors ${
          active ? 'bg-black text-white' : 'border border-grey-300 text-grey-600 hover:border-black'
        }`}
      >
        {text}
      </Link>
    );
  }

  return (
    <div className="container-band max-w-3xl py-8">
      <h1 className="section-title mb-6">{dict.boards.title}</h1>

      <div className="mb-6 flex flex-wrap gap-2">
        <Tab href={`/${locale}/boards`} text={dict.boards.all} active={!type} />
        {TYPES.map((t) => (
          <Tab key={t} href={`/${locale}/boards?type=${t}`} text={label(t)} active={type === t} />
        ))}
      </div>

      {posts.length === 0 ? (
        <p className="py-16 text-center text-grey-400">{dict.boards.empty}</p>
      ) : (
        <ul className="divide-y divide-grey-100 border-y border-grey-100">
          {posts.map((p) => (
            <li key={p.id}>
              <Link
                href={`/${locale}/boards/${p.id}`}
                className="flex items-center gap-3 py-4 hover:bg-grey-50"
              >
                {p.board_type && (
                  <span className="rounded-pill bg-grey-100 px-2.5 py-1 text-xs font-medium text-grey-600">
                    {label(p.board_type)}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate font-medium">
                  {boardTitle(p, locale) || '—'}
                </span>
                <time className="shrink-0 text-xs text-grey-400">
                  {String(p.created_at).slice(0, 10)}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
