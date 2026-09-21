// 행사 피드백 설문 — 행사가 끝난 뒤 주최자가 받는 8단계 설문.
//
// 후기(ProductReviews)와 나란히 서지만 성격이 다르다. 후기는 다른 손님에게 보여 주는 공개 평가고,
// 이건 주최자만 읽는 운영 개선용이다. 그래서 남이 낸 답을 여기서 보여 주지 않는다 — 목록이 없다.
//
// 로그인을 요구하지 않는다. 행사에 온 사람 대부분은 계정이 없고, 설문은 응답률이 곧 쓸모다.
//
// 디자인 — 123Band 디자인 시스템(선셋)을 그대로 쓴다.
//   데스크톱은 두 칸이다. 왼쪽 크림 패널이 '무엇을, 얼마나' 를 알려 주고(선셋 띠 · 소요 시간 · 단계 목록),
//   오른쪽 카드가 지금 장만 보여 준다. 한 칸짜리 넓은 카드에 선택지만 왼쪽에 몰리면 오른쪽이 텅 비어
//   관리자 폼처럼 보였다. 모바일은 패널이 위로 올라가고 단계 목록 대신 카드의 분절 막대가 진행을 맡는다.
'use client';
import { useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  Clock,
  EyeOff,
  ListChecks,
  MapPin,
  Send,
  Star,
} from 'lucide-react';
import {
  FEEDBACK_SECTIONS,
  FEEDBACK_RATING_MAX,
  FEEDBACK_NAME_CODE,
  FEEDBACK_EMAIL_CODE,
  type FeedbackField,
  type Locale,
} from '@123band/shared';
import type { Dictionary } from '@/i18n/dictionaries';
import { storageImageProps } from '@/lib/image';

/** 조건부 클래스 합치기 — web 앱에는 공용 cn 이 없어 여기서 작게 쓴다. */
const cn = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

/** 한국어가 낱말 중간에서 끊기지 않게('쓰이/고') — 문장 덩어리에 붙인다. */
const KEEP = '[word-break:keep-all]';

type Answer = string | number | string[];

/** 문항 문구는 사전이 아니라 문항 정의에 있다(문항이 60개라 사전을 뒤덮는다). */
const pick = (f: { ko: string; en: string }, locale: Locale) => (locale === 'ko' ? f.ko : f.en);
const pickHint = (f: FeedbackField, locale: Locale) => (locale === 'ko' ? f.hintKo : f.hintEn);

/** 두 자리 번호 — '01 / 08'. 단계 번호를 모노 서체로 박아 설문의 리듬을 만든다. */
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * 별점 — 커서를 올린 자리까지 미리 채우고, 옆에 뜻을 적어 준다.
 * 별 다섯 개만으로는 '3점이 좋다는 건가 나쁘다는 건가' 가 사람마다 다르게 읽힌다.
 */
function Rating({
  value,
  labels,
  onSelect,
}: {
  value: number;
  labels: string[];
  onSelect: (n: number) => void;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <div className="flex" role="radiogroup" onMouseLeave={() => setHover(0)}>
        {Array.from({ length: FEEDBACK_RATING_MAX }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={labels[n - 1] ?? String(n)}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(0)}
            onClick={() => onSelect(n)}
            className="rounded-md p-1 transition-transform duration-150 hover:scale-110 focus-visible:outline-none focus-visible:shadow-focus"
          >
            <Star
              size={30}
              strokeWidth={1.6}
              className={cn(
                'transition-colors duration-150',
                n <= shown ? 'fill-primary text-primary' : 'fill-grey-100 text-grey-300',
              )}
            />
          </button>
        ))}
      </div>
      <span
        className={cn(
          'min-w-[5rem] text-sm font-medium transition-colors',
          shown ? 'text-primary-deep' : 'text-grey-400',
        )}
      >
        {shown ? labels[shown - 1] : '—'}
      </span>
    </div>
  );
}

/**
 * 선택지 — 고르면 주황으로 통째 칠하지 않고 옅게 물들이고 체크를 단다.
 * 한 장에 선택지가 스무 개 넘게 깔리는데, 통채움은 고른 것이 몇 개만 돼도 화면이 요란해진다.
 */
function Option({
  selected,
  multi,
  onClick,
  children,
}: {
  selected: boolean;
  multi: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-md border px-3.5 py-2 text-sm transition-all duration-150',
        'focus-visible:outline-none focus-visible:shadow-focus',
        selected
          ? 'border-primary bg-primary/[0.06] font-medium text-primary-deep shadow-[inset_0_0_0_1px_#fa520f]'
          : 'border-grey-300 bg-white text-grey-700 hover:border-grey-500 hover:text-black',
      )}
    >
      {/* 다중 선택은 네모 체크, 단일 선택은 고른 뒤에만 체크 — 모양으로 '여러 개 골라도 되는지' 를 알린다. */}
      {multi ? (
        <span
          className={cn(
            'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors',
            selected ? 'border-primary bg-primary text-white' : 'border-grey-300 bg-white',
          )}
        >
          {selected && <Check size={11} strokeWidth={3} />}
        </span>
      ) : (
        selected && <Check size={14} strokeWidth={2.5} className="-ml-0.5" />
      )}
      {children}
    </button>
  );
}

/** 설문 전용 페이지에서 머리에 띄울 행사 정보. 있으면 '페이지' 모양, 없으면 상세페이지에 박힌 모양이다. */
export interface FeedbackEventHead {
  name: string;
  cover: string | null;
  when: string;
  where: string;
}

export function EventFeedback({
  productId,
  locale,
  dict,
  event,
}: {
  productId: string;
  locale: Locale;
  dict: Dictionary;
  /** 설문 전용 페이지(/feedback/[slug])일 때만 준다. */
  event?: FeedbackEventHead;
}) {
  const t = dict.feedback;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);

  const total = FEEDBACK_SECTIONS.length;
  // step 은 항상 범위 안이지만, 인덱싱 결과가 undefined 일 수 없음을 타입으로도 못 박는다.
  const section = FEEDBACK_SECTIONS[Math.min(step, total - 1)] as (typeof FEEDBACK_SECTIONS)[number];
  const last = step === total - 1;

  // 한 문항이라도 답해야 낼 수 있다 — 빈 응답이 쌓이면 집계가 흐려진다.
  const hasAnyAnswer = useMemo(
    () =>
      Object.entries(answers).some(([code, v]) => {
        if (code === FEEDBACK_NAME_CODE || code === FEEDBACK_EMAIL_CODE) return false;
        return Array.isArray(v) ? v.length > 0 : v !== '' && v != null;
      }),
    [answers],
  );

  /** 장마다 답이 하나라도 있는지 — 단계 목록에서 '다녀간 장' 을 체크로 보여 준다. */
  const answeredSections = useMemo(() => {
    const has = (v: Answer | undefined) =>
      Array.isArray(v) ? v.length > 0 : v !== undefined && v !== '' && v !== 0;
    return new Set(
      FEEDBACK_SECTIONS.map((s, i) => (s.fields.some((f) => has(answers[f.code])) ? i : -1)).filter(
        (i) => i >= 0,
      ),
    );
  }, [answers]);

  function set(code: string, value: Answer) {
    setAnswers((prev) => ({ ...prev, [code]: value }));
  }

  function toggleMulti(code: string, value: string) {
    setAnswers((prev) => {
      const cur = Array.isArray(prev[code]) ? (prev[code] as string[]) : [];
      return { ...prev, [code]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] };
    });
  }

  /**
   * 장 이동. 모바일에서는 '다음' 을 누른 자리가 긴 장의 맨 아래라, 새 장의 첫 문항이 화면 밖에 있다.
   * 카드 머리가 화면 위쪽에 없을 때만 끌어올린다 — 데스크톱에서 매번 튀면 오히려 거슬린다.
   */
  function go(next: number) {
    setError('');
    setStep(Math.max(0, Math.min(total - 1, next)));
    requestAnimationFrame(() => {
      const el = cardRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.4) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  async function submit() {
    if (sending) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId, answers }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setDone(true);
    } catch {
      setError(t.failed);
    } finally {
      setSending(false);
    }
  }

  function renderField(f: FeedbackField) {
    const value = answers[f.code];
    const hint = pickHint(f, locale);
    // 한 줄 입력(이름·이메일)은 설명을 칸 안의 안내 문구로 넣는다 — 선택 항목이라 설명 줄까지
    // 세우면 첫 장이 괜히 길어진다. 서술형의 설명('주최자만 봅니다')은 지워지면 안 되므로 줄로 둔다.
    const inlineHint = f.type === 'text';
    const multi = f.type === 'multi';
    return (
      <fieldset key={f.code} className="min-w-0">
        <legend className={cn('text-[15px] font-semibold leading-snug text-black', KEEP)}>
          {pick(f, locale)}
        </legend>
        {hint && !inlineHint && (
          <p className="mt-1 flex items-center gap-1 text-xs text-grey-500">
            {f.type === 'textarea' && <EyeOff size={12} className="shrink-0" />}
            {hint}
          </p>
        )}
        <div className="mt-3">
          {f.type === 'text' && (
            <input
              type={f.code === FEEDBACK_EMAIL_CODE ? 'email' : 'text'}
              value={(value as string) ?? ''}
              onChange={(e) => set(f.code, e.target.value)}
              placeholder={hint}
              // .input 은 16px — iOS 가 입력칸을 눌렀을 때 화면을 확대하지 않는 최소 크기다.
              className="input"
            />
          )}
          {f.type === 'textarea' && (
            <textarea
              rows={3}
              maxLength={2000}
              value={(value as string) ?? ''}
              onChange={(e) => set(f.code, e.target.value)}
              className="input min-h-[104px] resize-y leading-relaxed"
            />
          )}
          {f.type === 'rating' && (
            <Rating
              value={Number(value) || 0}
              labels={t.ratingLabels}
              onSelect={(n) => set(f.code, n)}
            />
          )}
          {(f.type === 'single' || multi) && (
            <div className="flex flex-wrap gap-2" role={multi ? 'group' : 'radiogroup'}>
              {f.choices?.map((ch) => {
                const selected = multi
                  ? Array.isArray(value) && value.includes(ch.value)
                  : value === ch.value;
                return (
                  <Option
                    key={ch.value}
                    multi={multi}
                    selected={selected}
                    onClick={() =>
                      multi
                        ? toggleMulti(f.code, ch.value)
                        : // 고른 것을 다시 누르면 해제 — 잘못 누르고 되돌릴 길이 없으면 답이 왜곡된다.
                          set(f.code, selected ? '' : ch.value)
                    }
                  >
                    {pick(ch, locale)}
                  </Option>
                );
              })}
            </div>
          )}
        </div>
      </fieldset>
    );
  }

  /**
   * 이어지는 한 줄 입력(이름·이메일)은 넓은 화면에서 두 칸으로 나란히 둔다.
   * 반폭 칸을 세로로 쌓으면 오른쪽이 텅 비어 덜 만든 화면처럼 보인다.
   */
  function renderFields(fields: FeedbackField[]) {
    const groups: FeedbackField[][] = [];
    for (const f of fields) {
      const prev = groups[groups.length - 1];
      if (f.type === 'text' && prev?.[0]?.type === 'text') prev.push(f);
      else groups.push([f]);
    }
    return groups.map((g) =>
      g.length > 1 ? (
        <div key={g[0]!.code} className="grid gap-8 sm:grid-cols-2 sm:gap-4">
          {g.map(renderField)}
        </div>
      ) : (
        renderField(g[0]!)
      ),
    );
  }

  // 상세페이지 안: 위 후기 섹션과 구분선으로 잇는다. 전용 페이지: 구분선 없이 페이지의 주인공으로 선다.
  const standalone = Boolean(event);

  return (
    <section className={standalone ? 'container-band py-8 md:py-14' : 'container-band pb-24 pt-2 md:pb-16'}>
      <div className={standalone ? '' : 'border-t border-grey-200 pt-10'}>
        <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-10">
          {/* ── 소개 패널 ── */}
          <aside className="overflow-hidden rounded-xl border border-beige bg-cream-light lg:sticky lg:top-24">
            {/* 전용 페이지는 행사 포스터로 연다 — 링크를 받은 사람이 '어느 행사 설문인지' 를 한눈에 안다. */}
            {event?.cover && (
              <div className="relative aspect-[16/9] bg-grey-100">
                <Image
                  {...storageImageProps(event.cover, 640)}
                  alt={event.name}
                  fill
                  priority
                  sizes="(min-width: 1024px) 300px, 100vw"
                  className="object-cover"
                />
              </div>
            )}
            {/* 시그니처 선셋 띠 — 푸터를 닫는 그 띠를 여기서도 써서 '123Band가 묻는 설문' 임을 알린다. */}
            <div className="sunset-stripe" aria-hidden />
            <div className="p-5 md:p-6">
              <p className="label-caps !text-primary">{t.eyebrow}</p>
              {/* 전용 페이지는 제목 자리에 행사 이름을 쓴다 — '행사 피드백' 은 눈썹 줄이 이미 말한다. */}
              <h2
                className={cn(
                  'mt-2 font-bold tracking-tight text-black',
                  KEEP,
                  standalone ? 'text-2xl leading-tight md:text-[26px]' : 'text-2xl md:text-[28px]',
                )}
              >
                {event?.name ?? t.title}
              </h2>
              {event && (event.when || event.where) && (
                <ul className="mt-3 space-y-1 text-sm text-grey-700">
                  {event.when && (
                    <li className="flex items-center gap-1.5">
                      <CalendarDays size={14} className="shrink-0 text-grey-500" />
                      {event.when}
                    </li>
                  )}
                  {event.where && (
                    <li className="flex items-start gap-1.5">
                      <MapPin size={14} className="mt-0.5 shrink-0 text-grey-500" />
                      <span className={KEEP}>{event.where}</span>
                    </li>
                  )}
                </ul>
              )}
              <p className={cn('mt-3 text-sm leading-relaxed text-grey-600', KEEP)}>{t.lead}</p>

              <ul className="mt-4 flex flex-wrap gap-1.5">
                {[
                  { icon: Clock, text: t.metaTime },
                  { icon: ListChecks, text: t.metaSteps.replace('{n}', String(total)) },
                  { icon: EyeOff, text: t.metaAnonymous },
                ].map(({ icon: Icon, text }) => (
                  <li
                    key={text}
                    className="inline-flex items-center gap-1.5 rounded-pill border border-beige bg-white/70 px-2.5 py-1 text-xs text-grey-600"
                  >
                    <Icon size={13} className="text-primary" />
                    {text}
                  </li>
                ))}
              </ul>

              {/* 단계 목록 — 데스크톱에서만. 전부 선택 문항이라 아무 장으로나 건너뛸 수 있다. */}
              <ol className="mt-6 hidden space-y-0.5 border-t border-beige pt-4 lg:block">
                {FEEDBACK_SECTIONS.map((s, i) => {
                  const current = !done && i === step;
                  const visited = done || answeredSections.has(i);
                  return (
                    <li key={s.code}>
                      <button
                        type="button"
                        onClick={() => !done && go(i)}
                        disabled={done}
                        aria-current={current ? 'step' : undefined}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                          current ? 'bg-white shadow-1' : 'hover:bg-white/60',
                          'disabled:cursor-default disabled:hover:bg-transparent',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-semibold tabular-nums transition-colors',
                            current
                              ? 'bg-primary text-white'
                              : visited
                                ? 'bg-primary/15 text-primary-deep'
                                : 'bg-white text-grey-400 ring-1 ring-beige',
                          )}
                        >
                          {visited && !current ? <Check size={12} strokeWidth={3} /> : pad(i + 1)}
                        </span>
                        <span
                          className={cn(
                            'truncate',
                            current ? 'font-semibold text-black' : visited ? 'text-grey-700' : 'text-grey-500',
                          )}
                        >
                          {pick(s, locale)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          </aside>

          {/* ── 설문 카드 ── */}
          <div
            ref={cardRef}
            className="scroll-mt-24 overflow-hidden rounded-xl border border-grey-200 bg-white shadow-2"
          >
            {done ? (
              <div className="px-6 py-14 text-center md:py-20">
                <span className="fb-done-pop mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white shadow-3">
                  <Check size={30} strokeWidth={2.5} />
                </span>
                <p className="mt-6 text-xl font-bold tracking-tight text-black">{t.thanksTitle}</p>
                <p className={cn('mx-auto mt-2 max-w-sm text-sm leading-relaxed text-grey-500', KEEP)}>
                  {t.thanksBody}
                </p>
              </div>
            ) : (
              <>
                {/* 머리 — 번호 · 장 이름 · 분절 진행 막대 */}
                <div className="px-5 pt-6 md:px-8 md:pt-8">
                  <p className="font-mono text-xs font-semibold tracking-wider">
                    <span className="text-primary">{pad(step + 1)}</span>
                    <span className="text-grey-300"> / {pad(total)}</span>
                  </p>
                  <h3 className="mt-1.5 text-xl font-bold tracking-tight text-black md:text-2xl">
                    {pick(section, locale)}
                  </h3>
                  {/* 한 줄 막대보다 칸으로 나눈 막대가 '몇 장 남았나' 를 바로 센다. */}
                  <div className="mt-5 flex gap-1.5" aria-hidden>
                    {FEEDBACK_SECTIONS.map((s, i) => (
                      <span
                        key={s.code}
                        className={cn(
                          'h-1 flex-1 rounded-pill transition-colors duration-300',
                          i <= step ? 'bg-primary' : 'bg-grey-100',
                        )}
                      />
                    ))}
                  </div>
                </div>

                {/* 본문 — key 로 장이 바뀔 때마다 새로 들어오는 전환을 건다. */}
                <div key={step} className="fb-step-in space-y-8 px-5 py-7 md:px-8 md:py-9">
                  {renderFields(section.fields)}
                </div>

                {error && (
                  <p className="mx-5 mb-4 rounded-md bg-danger/5 px-3 py-2 text-sm text-danger md:mx-8">
                    {error}
                  </p>
                )}

                {/* 바닥 — 회색 띠로 본문과 나눠 '여기서 넘어간다' 를 분명히 한다. */}
                <div className="flex items-center justify-between gap-3 border-t border-grey-200 bg-grey-50 px-5 py-4 md:px-8">
                  {/* 첫 장에서는 자리만 지킨다 — 버튼이 사라지면 '다음' 이 좌우로 흔들린다. */}
                  <button
                    type="button"
                    onClick={() => go(step - 1)}
                    className={cn(
                      'btn btn-sm -ml-3 gap-1 text-grey-600 hover:text-black',
                      step === 0 && 'invisible',
                    )}
                  >
                    <ChevronLeft size={16} />
                    {t.prev}
                  </button>
                  <button
                    type="button"
                    onClick={last ? submit : () => go(step + 1)}
                    disabled={last && (sending || !hasAnyAnswer)}
                    className="btn btn-primary btn-sm px-5 shadow-1"
                  >
                    {last ? (sending ? t.sending : t.submit) : t.next}
                    {last ? <Send size={15} /> : <ArrowRight size={16} />}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
