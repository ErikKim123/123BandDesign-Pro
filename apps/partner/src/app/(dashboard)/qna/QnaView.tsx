// 고객 문의 목록 + 답변 작성 (오거나이저). 답변은 partner 브라우저 클라이언트로 update — RLS 가 판매자만 허용.
'use client';
import { useState } from 'react';
import { CornerDownRight } from 'lucide-react';
import type { I18n } from '@123band/shared';
import { createClient } from '@/lib/supabase/client';
import { useT } from '@/i18n/useT';
import { useI18nText } from '@/lib/i18n/locale-context';
import type { PartnerQuestion } from '@/lib/queries/partner-qna';

// 상품명은 화면 언어를 따른다 — 훅 값을 받아 쓰도록 인자로 넘긴다(모듈 함수라 훅을 못 쓴다).
function productName(item: PartnerQuestion, i18nText: (v: I18n | null | undefined) => string): string {
  return (item.products?.name_i18n ? i18nText(item.products.name_i18n as I18n) : '') || '—';
}

function QnaRow({
  item,
  sellerId,
  onSaved,
}: {
  item: PartnerQuestion;
  sellerId: string;
  onSaved: (updated: PartnerQuestion) => void;
}) {
  const t = useT();
  const i18nText = useI18nText();
  const q = t.qnaAnswers;
  const [draft, setDraft] = useState(item.answer ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    if (!draft.trim()) return;
    setBusy(true);
    setErr('');
    const answeredAt = new Date().toISOString();
    const { error } = await createClient()
      .from('product_qna')
      .update({
        answer: draft.trim(),
        answered_by: sellerId,
        answered_at: answeredAt,
        updated_at: answeredAt,
      })
      .eq('id', item.id);
    setBusy(false);
    if (error) {
      setErr(q.saveFail);
      return;
    }
    onSaved({ ...item, answer: draft.trim(), answered_at: answeredAt });
  }

  return (
    <li className="p-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-pill px-2 py-0.5 text-[11px] font-medium ${
              item.answer ? 'bg-grey-100 text-grey-500' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {item.answer ? q.answered : q.unanswered}
          </span>
          <span className="text-sm font-medium text-grey-800">{item.author_name || '—'}</span>
          <span className="text-xs text-grey-400">· {productName(item, i18nText)}</span>
        </div>
        <span className="shrink-0 text-xs text-grey-400">{item.created_at.slice(0, 10)}</span>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-grey-700">{item.question}</p>

      <div className="mt-2 flex gap-2 rounded-lg bg-grey-50 p-3">
        <CornerDownRight size={16} className="mt-1.5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs font-semibold text-primary">{q.answerLabel}</label>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={q.answerPlaceholder}
            rows={2}
            maxLength={2000}
            className="w-full resize-y rounded-lg border border-grey-300 bg-white p-2.5 text-sm outline-none focus:border-black"
          />
          {err && <p className="mt-1 text-xs text-danger">{err}</p>}
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={save}
              disabled={busy || !draft.trim()}
              className="btn btn-primary btn-sm disabled:opacity-50"
            >
              {busy ? '…' : item.answer ? q.update : q.answer}
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

export function QnaView({ items: initial, sellerId }: { items: PartnerQuestion[]; sellerId: string }) {
  const t = useT();
  const q = t.qnaAnswers;
  const [items, setItems] = useState<PartnerQuestion[]>(initial);
  const [onlyUnanswered, setOnlyUnanswered] = useState(false);

  const count = items.length;
  const list = onlyUnanswered ? items.filter((x) => !x.answer) : items;

  const onSaved = (updated: PartnerQuestion) =>
    setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-grey-900">{q.title}</h1>
        <p className="mt-1 text-sm text-grey-500">{q.subtitle}</p>
      </div>

      {count > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-grey-200 p-3 text-sm">
          <span className="font-medium text-grey-700">{q.count(count)}</span>
          <label className="flex cursor-pointer items-center gap-2 text-grey-600">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={onlyUnanswered}
              onChange={(e) => setOnlyUnanswered(e.target.checked)}
            />
            {q.onlyUnanswered}
          </label>
        </div>
      )}

      {count === 0 ? (
        <p className="py-16 text-center text-grey-400">{q.empty}</p>
      ) : (
        <ul className="divide-y divide-grey-100 overflow-hidden rounded-lg border border-grey-200">
          {list.map((it) => (
            <QnaRow key={it.id} item={it} sellerId={sellerId} onSaved={onSaved} />
          ))}
        </ul>
      )}
    </div>
  );
}
