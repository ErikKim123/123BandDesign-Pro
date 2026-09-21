// 행사 피드백 뷰 (오거나이저).
//
// 두 층이다. 먼저 '내 행사 목록'에서 어느 행사에 답이 쌓였는지 보고, 행사를 고르면 그 행사의
// 응답을 읽는다. 행사를 섞어 한 줄로 늘어놓지 않는 이유는 설문이 8단계 60문항이라 —
// 행사 구분 없이 쌓으면 읽을 수가 없다.
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Link2, MessageSquareText } from 'lucide-react';
import {
  FEEDBACK_SECTIONS,
  FEEDBACK_NAME_CODE,
  FEEDBACK_EMAIL_CODE,
  feedbackAnswerText,
  type I18n,
} from '@123band/shared';
import { useT } from '@/i18n/useT';
import { useI18nText, useLocaleControl } from '@/lib/i18n/locale-context';
import { createClient } from '@/lib/supabase/client';
import type { FeedbackEvent, FeedbackResponse } from '@/lib/queries/partner-feedback';
import { SurveyLink } from './SurveyLink';
import { FeedbackSummary } from './FeedbackSummary';

export function FeedbackView({
  events,
  selectedId,
  responses,
}: {
  events: FeedbackEvent[];
  selectedId: string | null;
  responses: FeedbackResponse[];
}) {
  const t = useT();
  const f = t.feedback;
  const router = useRouter();
  const i18nText = useI18nText();
  const loc = useLocaleControl();
  const locale = loc?.locale === 'ko' ? 'ko' : 'en';
  const [busy, setBusy] = useState<string | null>(null);
  // 링크 패널을 펼친 행사 — 한 번에 하나만 편다(목록이 길어지지 않게).
  const [linkOpen, setLinkOpen] = useState<string | null>(null);
  // 상세 화면 탭 — 응답이 쌓이면 요약부터 본다.
  const [tab, setTab] = useState<'summary' | 'responses'>('summary');

  const selected = events.find((e) => e.id === selectedId) ?? null;
  const name = (e: FeedbackEvent) => i18nText(e.name_i18n as I18n) || e.code || '—';

  async function toggle(event: FeedbackEvent) {
    if (busy) return;
    setBusy(event.id);
    const { error } = await createClient()
      .from('products')
      .update({ feedback_enabled: !event.feedback_enabled })
      .eq('id', event.id);
    setBusy(null);
    if (!error) router.refresh();
  }

  // ── 행사 하나를 고른 상태: 그 행사의 응답 ──
  if (selected) {
    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => router.push('/feedback')}
          className="flex items-center gap-1 text-sm text-grey-500 hover:text-grey-900"
        >
          <ChevronLeft size={16} /> {f.backToList}
        </button>

        <div>
          <h1 className="text-xl font-bold text-grey-900">{name(selected)}</h1>
          <p className="mt-1 text-sm text-grey-500">{f.count(responses.length)}</p>
        </div>

        {selected.slug && <SurveyLink slug={selected.slug} open={selected.feedback_enabled} />}

        {responses.length === 0 ? (
          <p className="py-16 text-center text-grey-400">{f.emptyResponses}</p>
        ) : (
          <>
            <div className="flex gap-1 border-b border-grey-200" role="tablist">
              {(
                [
                  ['summary', f.tabSummary],
                  ['responses', f.tabResponses(responses.length)],
                ] as const
              ).map(([key, text]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={
                    '-mb-px border-b-2 px-3 py-2 text-sm transition-colors ' +
                    (tab === key
                      ? 'border-black font-semibold text-grey-900'
                      : 'border-transparent text-grey-500 hover:text-grey-900')
                  }
                >
                  {text}
                </button>
              ))}
            </div>

            {tab === 'summary' ? (
              <FeedbackSummary productId={selected.id} responses={responses} lang={locale} />
            ) : (
              <ul className="space-y-3">
                {responses.map((r) => (
                  <ResponseCard key={r.id} response={r} locale={locale} anonymous={f.anonymous} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    );
  }

  // ── 기본 상태: 내 행사 목록 ──
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-grey-900">{f.title}</h1>
        <p className="mt-1 text-sm text-grey-500">{f.subtitle}</p>
      </div>

      {events.length === 0 ? (
        <p className="py-16 text-center text-grey-400">{f.emptyEvents}</p>
      ) : (
        <ul className="divide-y divide-grey-100 overflow-hidden rounded-lg border border-grey-200">
          {events.map((e) => (
            <li key={e.id} className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-grey-900">{name(e)}</p>
                  <p className="mt-0.5 text-xs text-grey-400">
                    {e.responses > 0
                      ? `${f.count(e.responses)} · ${f.lastAt} ${e.last_at?.slice(0, 10)}`
                      : f.noResponsesYet}
                  </p>
                </div>

                {/* 설문 받기 스위치 — 행사가 끝난 뒤 켜고, 다 받으면 끈다. */}
                <button
                  type="button"
                  onClick={() => toggle(e)}
                  disabled={busy === e.id}
                  className={
                    'rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ' +
                    (e.feedback_enabled
                      ? 'bg-black text-white'
                      : 'bg-grey-100 text-grey-500 hover:bg-grey-200')
                  }
                >
                  {e.feedback_enabled ? f.open : f.closed}
                </button>

                {e.slug && (
                  <button
                    type="button"
                    onClick={() => setLinkOpen((v) => (v === e.id ? null : e.id))}
                    aria-expanded={linkOpen === e.id}
                    className={
                      'flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs transition-colors ' +
                      (linkOpen === e.id
                        ? 'border-black bg-black text-white'
                        : 'border-grey-300 text-grey-700 hover:bg-grey-100')
                    }
                  >
                    <Link2 size={14} /> {f.surveyLink}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => router.push(`/feedback?event=${e.id}`)}
                  disabled={e.responses === 0}
                  className="flex items-center gap-1.5 rounded-pill border border-grey-300 px-3 py-1.5 text-xs text-grey-700 hover:bg-grey-100 disabled:opacity-40"
                >
                  <MessageSquareText size={14} /> {f.viewResponses}
                </button>
              </div>

              {linkOpen === e.id && e.slug && (
                <div className="mt-3">
                  <SurveyLink slug={e.slug} open={e.feedback_enabled} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 응답 한 건 — 접었다 펴는 카드. 60문항이 한 번에 펼쳐지면 목록이 안 읽힌다. */
function ResponseCard({
  response,
  locale,
  anonymous,
}: {
  response: FeedbackResponse;
  locale: 'ko' | 'en';
  anonymous: string;
}) {
  const [open, setOpen] = useState(false);
  const answers = response.answers as Record<string, unknown>;

  return (
    <li className="overflow-hidden rounded-lg border border-grey-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-grey-50"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-grey-900">
            {response.respondent_name?.trim() || anonymous}
          </p>
          {response.respondent_email && (
            <p className="truncate text-xs text-grey-400">{response.respondent_email}</p>
          )}
        </div>
        <span className="shrink-0 text-xs text-grey-400">{response.created_at.slice(0, 10)}</span>
      </button>

      {open && (
        <div className="border-t border-grey-100 bg-grey-50 p-4">
          {FEEDBACK_SECTIONS.map((section) => {
            // 답한 문항만 보여 준다 — 빈 칸까지 늘어놓으면 실제로 뭘 말했는지 묻힌다.
            const filled = section.fields.filter(
              (fd) =>
                fd.code !== FEEDBACK_NAME_CODE &&
                fd.code !== FEEDBACK_EMAIL_CODE &&
                feedbackAnswerText(fd.code, answers[fd.code], locale) !== '',
            );
            if (filled.length === 0) return null;
            return (
              <div key={section.code} className="mt-4 first:mt-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-grey-400">
                  {section.emoji} {locale === 'ko' ? section.ko : section.en}
                </p>
                <dl className="mt-2 space-y-2">
                  {filled.map((fd) => (
                    <div key={fd.code}>
                      <dt className="text-xs text-grey-500">{locale === 'ko' ? fd.ko : fd.en}</dt>
                      <dd className="whitespace-pre-wrap text-sm text-grey-900">
                        {feedbackAnswerText(fd.code, answers[fd.code], locale)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
        </div>
      )}
    </li>
  );
}
