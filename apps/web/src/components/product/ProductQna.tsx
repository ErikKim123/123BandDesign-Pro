// Design Ref: 상품 상세 QnA 게시판 — 로그인 사용자 질문 작성/삭제 + 판매자 답변 표시. (후기 ProductReviews 와 동일 패턴)
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MessageCircleQuestion, CornerDownRight } from 'lucide-react';
import type { Locale } from '@123band/shared';
import type { Dictionary } from '@/i18n/dictionaries';
import type { ProductQuestion, QnaData } from '@/lib/queries/qna';
import { PointEventHint } from './PointEventHint';

export function ProductQna({
  productId,
  locale,
  dict,
  initial,
}: {
  productId: string;
  locale: Locale;
  dict: Dictionary;
  initial: QnaData;
}) {
  const router = useRouter();
  const q = dict.qna;
  const [items, setItems] = useState<ProductQuestion[]>(initial.items);
  const uid = initial.currentUserId;
  // 포인트는 상품당 1회만 지급된다 — 이미 문의를 남긴 상품이면 안내 배지를 숨긴다.
  const alreadyAsked = !!uid && items.some((i) => i.author_id === uid);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    setErr('');
    if (!question.trim()) return setErr(q.needQuestion);
    setBusy(true);
    try {
      const res = await fetch('/api/qna', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId, question: question.trim() }),
      });
      const data = (await res.json()) as { item?: ProductQuestion; error?: string };
      if (!res.ok || !data.item) throw new Error(data.error ?? 'err');
      setItems((prev) => [data.item as ProductQuestion, ...prev]);
      setQuestion('');
      router.refresh();
    } catch {
      setErr(q.error);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    // eslint-disable-next-line no-alert
    if (!window.confirm(q.deleteConfirm)) return;
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/qna', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error();
      setItems((prev) => prev.filter((x) => x.id !== id));
      router.refresh();
    } catch {
      setErr(q.error);
    } finally {
      setBusy(false);
    }
  }

  const count = items.length;

  return (
    <section className="container-band pt-2">
      <div className="border-t border-grey-200 pt-8">
        <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="font-display text-2xl uppercase tracking-tight">{q.title}</h2>
          {count > 0 && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-grey-600">
              <MessageCircleQuestion size={16} />
              {q.count.replace('{n}', String(count))}
            </span>
          )}
        </div>

        {/* 질문 작성 (로그인 사용자) */}
        {uid ? (
          <div className="mb-8 rounded-xl border border-grey-200 p-4">
            <p className="mb-2 text-sm font-medium text-grey-800">{q.writeTitle}</p>
            {/* 이 상품에 이미 문의를 남겼으면 지급 대상이 아니므로 안내를 감춘다 */}
            {!alreadyAsked && <PointEventHint kind="qna" label={dict.points.earnHint} />}
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={q.placeholder}
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
                {busy ? '…' : q.submit}
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-8 rounded-xl border border-dashed border-grey-300 p-4 text-center text-sm text-grey-500">
            <Link href={`/${locale}/login`} className="font-medium text-primary hover:underline">
              {q.loginPrompt}
            </Link>
          </div>
        )}

        {/* 목록 */}
        {count === 0 ? (
          <p className="py-8 text-center text-grey-400">{q.empty}</p>
        ) : (
          <ul className="divide-y divide-grey-100">
            {items.map((it) => (
              <li key={it.id} className="py-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-pill bg-grey-100 px-2 py-0.5 text-[11px] font-medium text-grey-600">
                      Q
                    </span>
                    <span className="text-sm font-medium text-grey-800">{it.author_name || '—'}</span>
                    {it.author_id === uid && (
                      <span className="rounded-pill bg-grey-100 px-2 py-0.5 text-[11px] text-grey-500">
                        {q.mine}
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-grey-400">{it.created_at.slice(0, 10)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-grey-700">
                  {it.question}
                </p>

                {/* 답변 */}
                {it.answer ? (
                  <div className="mt-2 flex gap-2 rounded-lg bg-grey-50 p-3">
                    <CornerDownRight size={16} className="mt-0.5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <div className="mb-0.5 flex items-center gap-2">
                        <span className="text-xs font-semibold text-primary">{q.answerLabel}</span>
                        {it.answered_at && (
                          <span className="text-xs text-grey-400">{it.answered_at.slice(0, 10)}</span>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-grey-700">
                        {it.answer}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-grey-400">{q.awaiting}</p>
                )}

                {it.author_id === uid && (
                  <button
                    type="button"
                    onClick={() => remove(it.id)}
                    disabled={busy}
                    className="mt-1 text-xs text-grey-400 transition-colors hover:text-danger"
                  >
                    {q.delete}
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
