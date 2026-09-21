// Design Ref: 행사 캘린더 — 월/주 보기 토글 + 날짜 셀에 행사 칩 + 티켓 판매형 카드 목록.
// 날짜 기준 = event_content.startAt (타임존 영향 없도록 ISO 앞 10자리로 키 생성).
'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, MapPin, Clock, Ticket, ArrowRight, Globe } from 'lucide-react';
import {
  baseCurrency,
  pickI18n,
  formatPrice,
  discountPercent,
  productPath,
  type Locale,
} from '@123band/shared';
import { currencyForLocale, intlLocale } from '@/lib/locale';
import { priceLabel } from '@/lib/price';
import type { EventListItem } from '@/lib/queries/events';
import type { Dictionary } from '@/i18n/dictionaries';
import { storageImageProps } from '@/lib/image';

const pad = (n: number) => String(n).padStart(2, '0');
const dateKey = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
/** ISO(예: 2026-06-03T18:00) → YYYY-MM-DD (로컬 파싱 없이 안전) */
const isoDateKey = (iso?: string) => (iso ? iso.slice(0, 10) : '');
/** ISO2 국가코드 여부 */
const isIso2 = (s: string) => /^[A-Za-z]{2}$/.test(s);
/** 국기 이미지 — OS(특히 Windows)가 이모지 국기를 글자로 표시하는 문제 회피용 (flagcdn). */
function CountryFlag({ code, className }: { code: string; className?: string }) {
  const cc = code.toLowerCase();
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/32x24/${cc}.png`}
      srcSet={`https://flagcdn.com/64x48/${cc}.png 2x`}
      alt=""
      loading="lazy"
      className={className}
    />
  );
}
/** ISO2 → 로케일 국가명 (실패 시 원본) */
const countryName = (code: string, intl: string) => {
  if (!isIso2(code)) return code;
  try {
    return new Intl.DisplayNames([intl], { type: 'region' }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
};
/** 'YYYY-MM-DD' → [년, 월(1-12), 일] (noUncheckedIndexedAccess 안전) */
const parseKey = (k: string): [number, number, number] => {
  const [y, m, d] = k.split('-');
  return [Number(y), Number(m), Number(d)];
};
/** 시작~종료 사이의 모든 날짜키(YYYY-MM-DD) — 기간이 여러 날인 패스권을 캘린더 전 구간에 노출 */
const eachDateKey = (startIso?: string, endIso?: string): string[] => {
  const sk = isoDateKey(startIso);
  if (!sk) return [];
  const ek = isoDateKey(endIso) || sk;
  const [sy, sm, sd] = parseKey(sk);
  const d = new Date(sy, sm - 1, sd);
  const keys: string[] = [];
  for (let i = 0; i < 366; i++) {
    const k = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
    keys.push(k);
    if (k >= ek) break; // 종료일 도달(또는 역전 데이터 방어)
    d.setDate(d.getDate() + 1);
  }
  return keys;
};

type Mode = 'month' | 'week';

export function EventCalendar({
  events,
  locale,
  dict,
  initialKey,
}: {
  events: EventListItem[];
  locale: Locale;
  dict: Dictionary;
  initialKey: string; // 서버에서 계산한 '오늘' (YYYY-MM-DD)
}) {
  const [iyS, imS] = initialKey.split('-');
  const iy = Number(iyS);
  const im = Number(imS);
  const [view, setView] = useState({ y: iy, m: im - 1 }); // m: 0-11
  const [selected, setSelected] = useState(initialKey);
  const [mode, setMode] = useState<Mode>('week');

  const intl = intlLocale(locale);
  const currency = currencyForLocale(locale);

  // 날짜키 → 행사 목록
  const byDate = useMemo(() => {
    const map = new Map<string, EventListItem[]>();
    for (const e of events) {
      for (const k of eachDateKey(e.event_content.startAt, e.event_content.endAt)) {
        (map.get(k) ?? map.set(k, []).get(k)!).push(e);
      }
    }
    return map;
  }, [events]);

  // 월 보기: 6주(42칸) 그리드 — 해당 월 1일이 포함된 주의 일요일부터
  const monthCells = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const gridStart = new Date(view.y, view.m, 1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return d;
    });
  }, [view]);

  // 주 보기: 선택일이 포함된 주(일~토) 7칸
  const weekCells = useMemo(() => {
    const [sy, sm, sd] = parseKey(selected);
    const anchor = new Date(sy, sm - 1, sd);
    const weekStart = new Date(sy, sm - 1, sd - anchor.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [selected]);

  // 요일/월 라벨은 timeZone 고정(UTC)으로 서버=클라이언트 일치 (hydration 안전)
  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(intl, { weekday: 'short', timeZone: 'UTC' });
    // 2024-01-07(UTC) = 일요일
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 7 + i))));
  }, [intl]);

  const monthLabel = new Intl.DateTimeFormat(intl, {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(view.y, view.m, 1)));

  // 주 라벨 (예: Jun 22 – 28)
  const weekLabel = useMemo(() => {
    const fmt = (d: Date) =>
      new Intl.DateTimeFormat(intl, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
        new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())),
      );
    return `${fmt(weekCells[0]!)} – ${fmt(weekCells[6]!)}`;
  }, [weekCells, intl]);

  const countLabel = (n: number) => dict.events.count.replace('{n}', String(n));

  const selectedEvents = byDate.get(selected) ?? [];

  // 표시할 주(週) 배열 — 월: 6주, 주: 1주
  const weeks = useMemo<Date[][]>(
    () =>
      mode === 'month'
        ? Array.from({ length: 6 }, (_, w) => monthCells.slice(w * 7, w * 7 + 7))
        : [weekCells],
    [mode, monthCells, weekCells],
  );

  // 한 주(7일) 안에서 행사 막대(연속 구간) 계산 + 레인 패킹(겹치면 아래 줄로)
  const buildBars = (week: Date[]) => {
    const keys = week.map((d) => dateKey(d.getFullYear(), d.getMonth(), d.getDate()));
    const wStart = keys[0]!;
    const wEnd = keys[6]!;
    const segs = events.flatMap((ev) => {
      const s = isoDateKey(ev.event_content.startAt);
      if (!s) return [];
      const e = isoDateKey(ev.event_content.endAt) || s;
      if (e < wStart || s > wEnd) return []; // 이 주와 겹치지 않음
      let startCol = 0;
      while (startCol < 6 && keys[startCol]! < s) startCol++;
      let endCol = 6;
      while (endCol > 0 && keys[endCol]! > e) endCol--;
      if (startCol > endCol) return [];
      return [{ ev, startCol, endCol, contLeft: s < wStart, contRight: e > wEnd }];
    });
    segs.sort(
      (a, b) =>
        a.startCol - b.startCol ||
        ((a.ev.event_content.startAt ?? '') < (b.ev.event_content.startAt ?? '') ? -1 : 1),
    );
    const laneEnds: number[] = []; // 레인별 마지막 점유 endCol
    const bars = segs.map((seg) => {
      let lane = 0;
      while (lane < laneEnds.length && laneEnds[lane]! >= seg.startCol) lane++;
      laneEnds[lane] = seg.endCol;
      return { ...seg, lane };
    });
    return { keys, bars, laneCount: laneEnds.length };
  };

  // 주 보기 하단: 이번 주 행사 — 기간이 겹치는 행사를 중복 없이 1개씩(시작일 순)
  const weekUnique = useMemo(() => {
    const keys = weekCells.map((d) => dateKey(d.getFullYear(), d.getMonth(), d.getDate()));
    const wStart = keys[0]!;
    const wEnd = keys[6]!;
    return events
      .filter((ev) => {
        const s = isoDateKey(ev.event_content.startAt);
        if (!s) return false;
        const e = isoDateKey(ev.event_content.endAt) || s;
        return !(e < wStart || s > wEnd);
      })
      .sort((a, b) =>
        (a.event_content.startAt ?? '') < (b.event_content.startAt ?? '') ? -1 : 1,
      );
  }, [events, weekCells]);

  const move = (delta: number) => {
    if (mode === 'month') {
      setView((v) => {
        const d = new Date(v.y, v.m + delta, 1);
        return { y: d.getFullYear(), m: d.getMonth() };
      });
    } else {
      // 주 단위 이동: 선택일을 ±7일 이동하고 뷰 월도 맞춤
      const [sy, sm, sd] = parseKey(selected);
      const d = new Date(sy, sm - 1, sd + delta * 7);
      setSelected(dateKey(d.getFullYear(), d.getMonth(), d.getDate()));
      setView({ y: d.getFullYear(), m: d.getMonth() });
    }
  };
  const goToday = () => {
    setView({ y: iy, m: im - 1 });
    setSelected(initialKey);
  };

  const title = mode === 'month' ? monthLabel : weekLabel;

  return (
    <div className="space-y-6">
      {/* 툴바: 제목 + 보기전환 + 네비 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-2xl font-bold md:text-3xl">{title}</h2>
        <div className="flex items-center gap-2">
          {/* 월/주 세그먼트 토글 */}
          <div className="inline-flex rounded-pill border border-grey-200 p-0.5">
            {(['month', 'week'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  mode === m ? 'bg-black text-white' : 'text-grey-500 hover:text-black'
                }`}
              >
                {dict.events[m]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => move(-1)} className="rounded-lg border border-grey-200 p-2 hover:bg-grey-50" aria-label="prev">
              <ChevronLeft size={18} />
            </button>
            <button onClick={goToday} className="rounded-lg border border-grey-200 px-3 py-2 text-sm font-medium hover:bg-grey-50">
              {dict.events.today}
            </button>
            <button onClick={() => move(1)} className="rounded-lg border border-grey-200 p-2 hover:bg-grey-50" aria-label="next">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* 그리드 */}
      <div className="overflow-hidden rounded-xl border border-grey-200">
        <div className="grid grid-cols-7 border-b border-grey-200 bg-grey-50">
          {weekdays.map((w, i) => (
            <div key={w} className={`px-3 py-2.5 text-xs font-medium ${i === 0 ? 'text-danger' : 'text-grey-500'}`}>
              {w}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => {
          const { keys, bars, laneCount } = buildBars(week);
          const headerH = 30; // 날짜 숫자 영역 높이(px)
          const barH = 24; // 막대 1줄 높이(px)
          const baseMin = mode === 'week' ? 220 : 104;
          const rowMin = Math.max(baseMin, headerH + laneCount * barH + 8);
          return (
            <div key={wi} className="relative border-b border-grey-100 last:border-b-0">
              {/* 날짜 셀(배경 + 클릭 선택) */}
              <div className="grid grid-cols-7" style={{ minHeight: rowMin }}>
                {week.map((d, i) => {
                  const k = keys[i]!;
                  const inMonth = mode === 'week' || d.getMonth() === view.m;
                  const isToday = k === initialKey;
                  const isSel = k === selected;
                  return (
                    <div
                      key={k}
                      onClick={() => inMonth && setSelected(k)}
                      className={`border-r border-grey-100 p-1.5 transition-colors ${
                        !inMonth
                          ? 'bg-grey-50/50'
                          : `cursor-pointer ${isSel ? 'bg-primary/5 ring-1 ring-inset ring-primary' : 'hover:bg-grey-50'}`
                      }`}
                    >
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center text-sm ${
                          !inMonth
                            ? 'text-grey-300'
                            : isToday
                              ? 'rounded-full bg-primary font-semibold text-white'
                              : d.getDay() === 0
                                ? 'text-danger'
                                : ''
                        }`}
                      >
                        {d.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* 행사 막대(기간 연속 구간) 오버레이 — 셀 클릭은 통과 */}
              {bars.length > 0 && (
                <div
                  className="pointer-events-none absolute inset-x-0 grid grid-cols-7 gap-y-1"
                  style={{ top: headerH, gridAutoRows: `${barH - 4}px` }}
                >
                  {bars.map((b) => {
                    const cc = b.ev.event_content.country || b.ev.event_content.address?.country || '';
                    return (
                      <Link
                        key={`${b.ev.id}:${wi}`}
                        href={productPath(locale, b.ev)}
                        onClick={(e) => e.stopPropagation()}
                        title={pickI18n(b.ev.name_i18n, locale)}
                        style={{
                          gridColumn: `${b.startCol + 1} / span ${b.endCol - b.startCol + 1}`,
                          gridRow: b.lane + 1,
                        }}
                        className={`pointer-events-auto flex items-center gap-1 truncate bg-black px-2 py-1 text-[11px] font-medium leading-tight text-white hover:bg-grey-700 ${
                          b.contLeft ? 'ml-0' : 'ml-1 rounded-l'
                        } ${b.contRight ? 'mr-0' : 'mr-1 rounded-r'}`}
                      >
                        {isIso2(cc) && (
                          <CountryFlag code={cc} className="h-2.5 w-auto shrink-0 rounded-[1px]" />
                        )}
                        <span className="truncate">{pickI18n(b.ev.name_i18n, locale) || '—'}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 하단 목록 — 월: 선택일 행사 / 주: 이번 주 전체(날짜별 그룹) */}
      {mode === 'month' ? (
        <section className="space-y-4">
          <h3 className="flex items-center gap-2 font-display text-xl font-bold">
            <Ticket size={20} /> {countLabel(selectedEvents.length)}
          </h3>
          {selectedEvents.length === 0 ? (
            <p className="py-12 text-center text-grey-400">{dict.events.none}</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {selectedEvents.map((e) => (
                <EventCard key={e.id} ev={e} locale={locale} dict={dict} intl={intl} currency={currency} today={initialKey} />
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-4">
          <h3 className="flex items-center gap-2 font-display text-xl font-bold">
            <Ticket size={20} /> {countLabel(weekUnique.length)}
          </h3>
          {weekUnique.length === 0 ? (
            <p className="py-12 text-center text-grey-400">{dict.events.weekNone}</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {weekUnique.map((e) => (
                <EventCard key={e.id} ev={e} locale={locale} dict={dict} intl={intl} currency={currency} today={initialKey} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function EventCard({
  ev,
  locale,
  dict,
  intl,
  currency,
  today,
}: {
  ev: EventListItem;
  locale: Locale;
  dict: Dictionary;
  intl: string;
  currency: ReturnType<typeof currencyForLocale>;
  today: string;
}) {
  const c = ev.event_content;
  const name = pickI18n(ev.name_i18n, locale) || '—';
  // 썸네일: 행사 전용 배너 우선, 없으면 상품 대표 이미지
  const banner = pickI18n(c.banner, locale) || ev.image_url || '';
  const location = pickI18n(c.location, locale);
  // 국가: 기본정보 country 우선, 없으면 구조화 주소의 country → 국기 + 로케일 국가명
  const countryCode = c.country || c.address?.country || '';
  const countryLabel = countryName(countryCode, intl);
  // 가격 텍스트: 해당 로케일 값만 사용(타 언어로 폴백 금지) — KO 원화 표기가 EN 으로 새지 않도록
  const priceText = c.priceText?.[locale]?.trim() || '';
  // 표시 통화: 결제 통화 가격이 있으면 그대로, 없으면 행사 국가 통화 → 상세와 같은 기준(환산가 노출 방지).
  const cur = baseCurrency(
    ev.passes.length > 0 ? ev.passes.map((p) => p.prices) : [ev.prices],
    currency,
    countryCode,
  );
  const cost = priceLabel(ev.prices, cur, intl, dict.event.free, priceText);
  const isFree = cost === dict.event.free;
  // 판매 패스(Full/Party 등) — 가격이 매겨진 것만. priceText(직접표기)가 있으면 그걸 우선하므로 목록은 생략.
  const passes = priceText ? [] : ev.passes.filter((p) => formatPrice(p.prices, cur, intl));
  // 신청 마감 = applyEnd 날짜가 오늘(KST) 이전이면 마감 (날짜 단위 비교, hydration 안전)
  const applyEndKey = isoDateKey(c.applyEnd);
  const closed = Boolean(applyEndKey) && applyEndKey < today;
  // datetime-local(TZ 없음)을 KST 절대시각으로 고정 → 서버=클라 일치
  const toKst = (iso: string) => new Date(/[+Z]/.test(iso) ? iso : iso + '+09:00');
  const dfDate = new Intl.DateTimeFormat(intl, {
    month: 'short', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul',
  });
  const dfTime = new Intl.DateTimeFormat(intl, {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul',
  });
  // 행사 기간: 여러 날이면 '시작일 ~ 종료일', 하루면 '날짜 · 시작시각'
  const sKey = isoDateKey(c.startAt);
  const eKey = isoDateKey(c.endAt);
  const period = !c.startAt
    ? ''
    : eKey && eKey !== sKey
      ? `${dfDate.format(toKst(c.startAt))} ~ ${dfDate.format(toKst(c.endAt!))}`
      : `${dfDate.format(toKst(c.startAt))} · ${dfTime.format(toKst(c.startAt))}`;

  return (
    <Link
      href={productPath(locale, ev)}
      className="group flex flex-col overflow-hidden rounded-xl border border-grey-200 transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-grey-100">
        {banner ? (
          // 세로 포스터가 가운데만 잘리지 않도록 초점을 상단(원본 위에서 ~10%)으로 고정
          <Image
            {...storageImageProps(banner, 1080)}
            alt={name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform group-hover:scale-105"
            style={{ objectPosition: 'center 10%' }}
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-grey-800 to-black" />
        )}
        {/* 모집 상태 배지 */}
        <span
          className={`absolute left-3 top-3 rounded-pill px-2.5 py-1 text-[11px] font-semibold uppercase tracking-tight ${
            closed ? 'bg-grey-900/80 text-grey-200' : 'bg-success text-white'
          }`}
        >
          {closed ? dict.event.closed : dict.event.open}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        {period && (
          <p className="inline-flex items-center gap-1 text-xs font-medium text-grey-600">
            <Clock size={12} /> {period}
          </p>
        )}
        <h4 className="mt-1.5 line-clamp-2 font-medium leading-snug text-grey-900">{name}</h4>
        {countryCode && (
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-grey-600">
            {isIso2(countryCode) ? (
              <CountryFlag code={countryCode} className="h-3 w-auto rounded-[1px]" />
            ) : (
              <Globe size={12} />
            )}
            {countryLabel}
          </p>
        )}
        {location && (
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-grey-500">
            <MapPin size={12} /> {location}
          </p>
        )}

        {/* 가격 + CTA — 판매 패스가 있으면 전 패스의 가격·할인율을, 없으면 대표가 단일 표기. */}
        <div className="mt-3 border-t border-grey-100 pt-3">
          {passes.length > 0 ? (
            <>
              <ul className="space-y-1">
                {passes.map((p, i) => {
                  const passName = pickI18n(p.name, locale);
                  const pct = discountPercent(p.prices, p.listPrices, cur);
                  const listP = formatPrice(p.listPrices, cur, intl);
                  return (
                    <li key={i} className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate text-grey-600">{passName || '—'}</span>
                      <span className="flex shrink-0 items-baseline gap-1.5">
                        {pct > 0 && listP && (
                          <span className="text-[11px] text-grey-400 line-through">{listP}</span>
                        )}
                        {pct > 0 && (
                          <span className="text-[11px] font-bold text-primary">{pct}% OFF</span>
                        )}
                        <span className="font-display font-bold text-grey-900">
                          {formatPrice(p.prices, cur, intl)}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-2 flex justify-end">
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-transform group-hover:translate-x-0.5">
                  {dict.events.viewTickets} <ArrowRight size={14} />
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-end justify-between">
              <div>
                {!isFree && !priceText && (
                  <span className="block text-[11px] uppercase tracking-tight text-grey-400">{dict.events.from}</span>
                )}
                <span className="font-display text-lg font-bold text-grey-900">{cost}</span>
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-transform group-hover:translate-x-0.5">
                {dict.events.viewTickets} <ArrowRight size={14} />
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
