// Design Ref: 상품 상세 후기 게시판 — 별점 리뷰 목록 + 로그인 사용자 작성/수정/삭제.
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Star } from 'lucide-react';
import type { Locale } from '@123band/shared';
import type { Dictionary } from '@/i18n/dictionaries';
import type { ProductReview, ReviewData } from '@/lib/queries/reviews';
import { PointEventHint } from './PointEventHint';

function Stars({
  value,
  size = 16,
  onSelect,
}: {
  value: number;
  size?: number;
  onSelect?: (n: number) => void;
}) {
  return (
    <span className="inline-flex items-center">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onSelect}
          onClick={() => onSelect?.(n)}
          className={onSelect ? 'cursor-pointer p-0.5' : 'p-0'}
          aria-label={`${n}`}
        >
          <Star
            size={size}
            className={n <= value ? 'fill-primary text-primary' : 'fill-none text-grey-300'}
          />
        </button>
      ))}
    </span>
  );
}

export function ProductReviews({
  productId,
  locale,
  dict,
  initial,
  endpoint = '/api/reviews',
  target,
  pointHint = true,
  embedded = false,
  placeholder,
}: {
  productId?: string;
  locale: Locale;
  dict: Dictionary;
  initial: ReviewData;
  /** 다른 대상(J&J 대회 부문 등)의 후기를 받을 때 — 작성 API 와 대상 식별값을 바꾼다. */
  endpoint?: string;
  target?: Record<string, string>;
  /** 작성 포인트 안내 — 포인트가 걸린 상품 후기에서만 보인다. */
  pointHint?: boolean;
  /** 페이지 섹션 안에 들어갈 때 — 바깥 여백·제목은 부모가 그린다. */
  embedded?: boolean;
  placeholder?: string;
}) {
  const router = useRouter();
  const r = dict.reviews;
  const [reviews, setReviews] = useState<ProductReview[]>(initial.reviews);
  const uid = initial.currentUserId;
  const mine = uid ? reviews.find((x) => x.author_id === uid) : undefined;
  const [rating, setRating] = useState<number>(mine?.rating ?? 0);
  const [content, setContent] = useState<string>(mine?.content ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const count = reviews.length;
  const average = count ? reviews.reduce((s, x) => s + x.rating, 0) / count : 0;

  async function submit() {
    setErr('');
    if (rating < 1) return setErr(r.needRating);
    if (!content.trim()) return setErr(r.needContent);
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...(target ?? { productId }), rating, content: content.trim() }),
      });
      const data = (await res.json()) as { review?: ProductReview; error?: string };
      if (!res.ok || !data.review) throw new Error(data.error ?? 'err');
      const nr = data.review;
      setReviews((prev) => [nr, ...prev.filter((x) => x.author_id !== nr.author_id)]);
      router.refresh();
    } catch {
      setErr(r.error);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    // eslint-disable-next-line no-alert
    if (!window.confirm(r.deleteConfirm)) return;
    setBusy(true);
    setErr('');
    try {
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error();
      setReviews((prev) => prev.filter((x) => x.id !== id));
      setRating(0);
      setContent('');
      router.refresh();
    } catch {
      setErr(r.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={embedded ? '' : 'container-band pb-24 pt-2 md:pb-12'}>
      <div className={embedded ? '' : 'border-t border-grey-200 pt-8'}>
        <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1">
          {!embedded && <h2 className="font-display text-2xl uppercase tracking-tight">{r.title}</h2>}
          {count > 0 && (
            <span className="flex items-center gap-1.5 text-grey-600">
              <Stars value={Math.round(average)} />
              <span className="text-sm font-medium">
                {average.toFixed(1)} · {r.count.replace('{n}', String(count))}
              </span>
            </span>
          )}
        </div>

        {/* 작성 폼 (로그인 사용자) */}
        {uid ? (
          <div className="mb-8 rounded-xl border border-grey-200 p-4">
            <p className="mb-2 text-sm font-medium text-grey-800">
              {mine ? r.editTitle : r.writeTitle}
            </p>
            {/* 수정은 지급 대상이 아니므로 신규 작성일 때만 안내한다 */}
            {!mine && pointHint && <PointEventHint kind="review" label={dict.points.earnHint} />}
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm text-grey-500">{r.ratingLabel}</span>
              <Stars value={rating} size={22} onSelect={setRating} />
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={placeholder ?? r.placeholder}
              rows={3}
              maxLength={2000}
              className="w-full resize-y rounded-lg border border-grey-300 p-3 text-sm outline-none focus:border-black"
            />
            {err && <p className="mt-2 text-sm text-danger">{err}</p>}
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="rounded-pill bg-primary px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? '…' : mine ? r.update : r.submit}
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-8 rounded-xl border border-dashed border-grey-300 p-4 text-center text-sm text-grey-500">
            <Link href={`/${locale}/login`} className="font-medium text-primary hover:underline">
              {r.loginPrompt}
            </Link>
          </div>
        )}

        {/* 목록 */}
        {count === 0 ? (
          <p className="py-8 text-center text-grey-400">{r.empty}</p>
        ) : (
          <ul className="divide-y divide-grey-100">
            {reviews.map((rv) => (
              <li key={rv.id} className="py-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars value={rv.rating} />
                    <span className="text-sm font-medium text-grey-800">{rv.author_name || '—'}</span>
                    {rv.author_id === uid && (
                      <span className="rounded-pill bg-grey-100 px-2 py-0.5 text-[11px] text-grey-500">
                        {r.mine}
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-grey-400">{rv.created_at.slice(0, 10)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-grey-700">
                  {rv.content}
                </p>
                {rv.author_id === uid && (
                  <button
                    type="button"
                    onClick={() => remove(rv.id)}
                    disabled={busy}
                    className="mt-1 text-xs text-grey-400 transition-colors hover:text-danger"
                  >
                    {r.delete}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
