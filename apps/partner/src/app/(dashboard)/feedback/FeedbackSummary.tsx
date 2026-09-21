// 행사 피드백 요약 대시보드 — 응답이 쌓였을 때 '대체로 어땠나' 를 한 화면에.
//
// 위에서 아래로 읽히는 순서다: 핵심 숫자(타일) → 항목별 평점 → 서술형(AI 요약 + 원문) → 선택형 분포.
// 서술형을 선택형보다 위에 두는 이유 — '많이 들어오면 요약' 의 핵심은 사람들이 한 말이고, 선택 분포는 뒷받침이다.
// 차트 규칙: 계열이 하나뿐인 막대라 색은 잉크 한 가지, 범례 없음. 값은 막대 옆에 글자로 적는다
// (색·길이만으로 읽게 하지 않는다). 원자료는 '개별 응답' 탭이 표 역할을 한다.
'use client';
import { useMemo, useState } from 'react';
import {
  ChevronDown,
  MessageSquareQuote,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { FEEDBACK_RATING_MAX } from '@123band/shared';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/utils';
import { summarizeFeedback, type ChoiceStat, type TextStat } from '@/lib/feedback-summary';
import type { FeedbackResponse } from '@/lib/queries/partner-feedback';
import type { FeedbackAiSummary } from '@/app/api/ai/feedback-summary/route';

type Lang = 'ko' | 'en';

// ── 조각들 ──────────────────────────────────────────────────────────────

function Tile({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-grey-200 bg-white p-4">
      <p className="flex items-center gap-1.5 text-xs text-grey-500">
        {icon}
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-grey-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-grey-400">{sub}</p>}
    </div>
  );
}

/** 가로 막대 한 줄. 막대 끝만 둥글고(4px) 시작은 기준선에 붙는다. */
function Bar({ pct, title, className }: { pct: number; title: string; className?: string }) {
  return (
    <div className={cn('h-2 overflow-hidden rounded-sm bg-grey-100', className)} title={title}>
      <div
        className="h-full rounded-r-[4px] bg-grey-900 transition-[width] duration-500"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

function Card({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-grey-200 bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-grey-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-grey-900">{title}</h2>
        {aside}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function ChoiceCard({ c, answeredLabel }: { c: ChoiceStat; answeredLabel: string }) {
  const top = Math.max(...c.options.map((o) => o.count));
  return (
    <div className="rounded-lg border border-grey-200 p-3">
      <p className="text-[11px] text-grey-400">{c.section}</p>
      <p className="mt-0.5 text-sm font-medium leading-snug text-grey-900">{c.label}</p>
      <ul className="mt-3 space-y-1.5">
        {c.options.map((o) => (
          // 좁은 화면: '라벨 | 값' 한 줄 + 아래 전체 폭 막대. 넓은 화면: 라벨 · 막대 · 값 한 줄.
          // 한 줄에 셋을 고집하면 폰에서 라벨이 폭을 다 먹어 막대가 점이 된다.
          <li
            key={o.value}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 text-xs sm:grid-cols-[minmax(0,9rem)_1fr_4rem]"
          >
            <span
              className={cn(
                'truncate sm:order-1',
                o.count === top && o.count > 0 ? 'font-semibold text-grey-900' : 'text-grey-600',
              )}
              title={o.label}
            >
              {o.label}
            </span>
            <span className="text-right tabular-nums text-grey-500 sm:order-3">
              {o.count} · {o.pct}%
            </span>
            <Bar
              pct={o.pct}
              title={`${o.label}: ${o.count} (${o.pct}%)`}
              className="col-span-2 sm:order-2 sm:col-span-1"
            />
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-grey-400">{answeredLabel.replace('{n}', String(c.answered))}</p>
    </div>
  );
}

function TextBlock({ t, anonymous }: { t: TextStat; anonymous: string }) {
  const [open, setOpen] = useState(false);
  const shown = open ? t.items : t.items.slice(0, 2);
  return (
    <div className="border-b border-grey-100 py-3 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="min-w-0">
          <span className="block text-[11px] text-grey-400">{t.section}</span>
          <span className="block text-sm font-medium text-grey-900">{t.label}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-xs text-grey-500">
          {t.items.length}
          <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
        </span>
      </button>
      <ul className="mt-2 space-y-1.5">
        {shown.map((it, i) => (
          <li key={i} className="rounded-md bg-grey-50 px-3 py-2 text-sm leading-relaxed text-grey-800">
            <p className="whitespace-pre-wrap">{it.text}</p>
            <p className="mt-1 text-[11px] text-grey-400">
              {it.name?.trim() || anonymous} · {it.at.slice(0, 10)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AiList({ title, items, icon }: { title: string; items: string[]; icon: React.ReactNode }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-grey-700">
        {icon}
        {title}
      </p>
      <ul className="mt-1.5 space-y-1 text-sm leading-relaxed text-grey-800">
        {items.map((x, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-grey-400" />
            <span>{x}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Names({ title, names }: { title: string; names: string[] }) {
  if (names.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-grey-700">{title}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {names.map((n) => (
          <span key={n} className="rounded-pill border border-grey-200 px-2.5 py-0.5 text-xs text-grey-700">
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── 본체 ────────────────────────────────────────────────────────────────

export function FeedbackSummary({
  productId,
  responses,
  lang,
}: {
  productId: string;
  responses: FeedbackResponse[];
  lang: Lang;
}) {
  const f = useT().feedback;
  const s = useMemo(() => summarizeFeedback(responses, lang), [responses, lang]);

  const [ai, setAi] = useState<FeedbackAiSummary | null>(null);
  const [aiBasedOn, setAiBasedOn] = useState(0);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');

  // 강점·약점은 비교가 성립할 때만 짚는다 — 평점 항목이 둘 이상이고, 점수가 서로 다르고,
  // 응답이 몇 건은 쌓였을 때. 한두 명의 답으로 '개선 필요' 딱지를 붙이면 오해만 만든다.
  const sorted = [...s.ratings].sort((a, b) => b.avg - a.avg);
  const comparable =
    s.total >= 3 && sorted.length >= 2 && (sorted[0]?.avg ?? 0) > (sorted[sorted.length - 1]?.avg ?? 0);
  const best = comparable ? sorted[0]?.code : undefined;
  const worst = comparable ? sorted[sorted.length - 1]?.code : undefined;

  async function runAi() {
    if (aiBusy) return;
    setAiBusy(true);
    setAiError('');
    try {
      const res = await fetch('/api/ai/feedback-summary', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId, lang }),
      });
      const j = (await res.json()) as { summary?: FeedbackAiSummary; basedOn?: number; error?: string };
      if (!res.ok || !j.summary) throw new Error(j.error ?? String(res.status));
      setAi(j.summary);
      setAiBasedOn(j.basedOn ?? s.total);
    } catch (e) {
      setAiError(e instanceof Error && e.message !== 'parse_failed' ? `${f.aiFailed} (${e.message})` : f.aiFailed);
    } finally {
      setAiBusy(false);
    }
  }

  const pctText = (x: { pct: number; n: number } | null) => (x ? `${x.pct}%` : '—');

  return (
    <div className="space-y-4">
      {/* 핵심 숫자 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label={f.kpiResponses}
          value={s.total}
          sub={s.last7 > 0 ? f.kpiLast7.replace('{n}', String(s.last7)) : undefined}
        />
        <Tile
          label={f.kpiOverall}
          icon={<Star size={12} className="fill-amber-400 text-amber-400" />}
          value={
            s.overall.n ? (
              <>
                {s.overall.avg.toFixed(1)}
                <span className="text-sm font-medium text-grey-400"> / {FEEDBACK_RATING_MAX}</span>
              </>
            ) : (
              '—'
            )
          }
          sub={s.overall.n ? f.kpiBase.replace('{n}', String(s.overall.n)) : undefined}
        />
        <Tile
          label={f.kpiAttendAgain}
          value={pctText(s.attendAgain)}
          sub={s.attendAgain ? f.kpiPositive.replace('{n}', String(s.attendAgain.n)) : undefined}
        />
        <Tile
          label={f.kpiRecommend}
          value={pctText(s.recommend)}
          sub={s.recommend ? f.kpiPositive.replace('{n}', String(s.recommend.n)) : undefined}
        />
      </div>

      {/* 항목별 평점 */}
      {s.ratings.length > 0 && (
        <Card title={f.ratingsTitle}>
          <ul className="space-y-2.5">
            {s.ratings.map((r) => (
              <li
                key={r.code}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 text-sm md:grid-cols-[minmax(0,15rem)_1fr_5rem]"
              >
                <span className="flex min-w-0 items-center gap-1.5 md:order-1">
                  <span className="truncate text-grey-700" title={r.label}>
                    {r.label}
                  </span>
                  {/* 강점·약점은 색이 아니라 아이콘+글자로 — 색만으로 뜻을 싣지 않는다. */}
                  {r.code === best && (
                    <span className="flex shrink-0 items-center gap-0.5 rounded-pill bg-grey-100 px-1.5 py-0.5 text-[10px] font-semibold text-grey-700">
                      <TrendingUp size={10} /> {f.strength}
                    </span>
                  )}
                  {r.code === worst && (
                    <span className="flex shrink-0 items-center gap-0.5 rounded-pill border border-grey-300 px-1.5 py-0.5 text-[10px] font-semibold text-grey-700">
                      <TrendingDown size={10} /> {f.weakness}
                    </span>
                  )}
                </span>
                <span className="text-right tabular-nums md:order-3">
                  <span className="font-semibold text-grey-900">{r.avg.toFixed(1)}</span>
                  <span className="text-xs text-grey-400"> · {r.n}</span>
                </span>
                <Bar
                  pct={(r.avg / FEEDBACK_RATING_MAX) * 100}
                  title={`${r.label}: ${r.avg.toFixed(2)} / ${FEEDBACK_RATING_MAX} (n=${r.n})`}
                  className="col-span-2 md:order-2 md:col-span-1"
                />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* 서술형 — AI 요약이 맨 위, 그 아래 원문 */}
      {s.texts.length > 0 && (
        <Card
          title={f.textsTitle}
          aside={
            <button
              type="button"
              onClick={runAi}
              disabled={aiBusy}
              className="flex items-center gap-1.5 rounded-pill bg-black px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-50"
            >
              <Sparkles size={13} />
              {aiBusy ? f.aiRunning : ai ? f.aiRerun : f.aiRun}
            </button>
          }
        >
          {aiError && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{aiError}</p>}

          {ai && (
            <div className="mb-4 space-y-4 rounded-lg border border-grey-200 bg-grey-50 p-4">
              <p className="flex items-center gap-1.5 text-[11px] text-grey-400">
                <Sparkles size={11} /> {f.aiBasis.replace('{n}', String(aiBasedOn))}
              </p>
              {ai.overview && <p className="text-sm leading-relaxed text-grey-900">{ai.overview}</p>}
              <div className="grid gap-4 md:grid-cols-3">
                <AiList title={f.aiHighlights} items={ai.highlights} icon={<ThumbsUp size={12} />} />
                <AiList title={f.aiPainPoints} items={ai.painPoints} icon={<ThumbsDown size={12} />} />
                <AiList
                  title={f.aiSuggestions}
                  items={ai.suggestions}
                  icon={<MessageSquareQuote size={12} />}
                />
              </div>
              {(ai.mentionedArtists.length > 0 || ai.mentionedDjs.length > 0) && (
                <div className="grid gap-4 border-t border-grey-200 pt-3 md:grid-cols-2">
                  <Names title={f.aiArtists} names={ai.mentionedArtists} />
                  <Names title={f.aiDjs} names={ai.mentionedDjs} />
                </div>
              )}
            </div>
          )}

          {!ai && !aiBusy && <p className="mb-2 text-xs text-grey-400">{f.aiHint}</p>}

          <div>
            {s.texts.map((t) => (
              <TextBlock key={t.code} t={t} anonymous={f.anonymous} />
            ))}
          </div>
        </Card>
      )}

      {/* 선택형 분포 */}
      {s.choices.length > 0 && (
        <Card title={f.choicesTitle}>
          <div className="grid gap-3 md:grid-cols-2">
            {s.choices.map((c) => (
              <ChoiceCard
                key={c.code}
                c={c}
                answeredLabel={c.multi ? f.answeredMulti : f.answeredSingle}
              />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
