// 상세페이지 '항공' / '숙박' 섹션 — 여행 어필리에이트.
// 항공: Travelpayouts(Aviasales) 프리셋 검색 링크. 출발지만 고르면 목적지·날짜는 행사 정보로 채워진다.
// 숙박: Stay22 지도 임베드 — 베뉴 좌표 주변 숙소를 행사 기간으로 조회.
// 제휴 링크는 rel="sponsored nofollow" + 고지문을 함께 노출한다(광고 표기 의무).
'use client';
import { useMemo, useState } from 'react';
import { Plane, BedDouble, ExternalLink } from 'lucide-react';
import type { EventAddress, Locale } from '@123band/shared';
import {
  ORIGIN_OPTIONS,
  TRAVELPAYOUTS_MARKER,
  addDays,
  flightSearchUrl,
  originGroups,
  stayEmbedUrl,
  travelDates,
} from '@/lib/travel';

export interface TravelLabels {
  flightsTitle: string;
  flightsDesc: string;
  from: string;
  to: string;
  nearestAirport: string;
  depart: string;
  return: string;
  oneWayHint: string;
  searchFlights: string;
  stayTitle: string;
  stayDesc: string;
  viewStays: string;
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="mb-4 flex items-center gap-2 border-l-4 border-primary pl-3 font-display text-2xl font-bold">
      {icon}
      {children}
    </h2>
  );
}

export function FlightSection({
  destination,
  destinationLabel,
  destinationNote,
  startAt,
  endAt,
  locale,
  campaign,
  labels,
}: {
  destination: string; // 목적지 IATA
  destinationLabel: string; // 화면 표기용 — 실제로 검색하는 공항의 도시명
  destinationNote?: string; // 행사 도시가 공항 도시와 다를 때만 (예: 붕따우)
  startAt?: string;
  endAt?: string;
  locale: Locale;
  campaign?: string;
  labels: TravelLabels;
}) {
  // 기본 출발지 — 한국어 화면이면 서울, 그 외엔 목록 첫 항목. 목적지와 같으면 다음 후보로.
  const [origin, setOrigin] = useState(() => {
    const pref = locale === 'ko' ? 'SEL' : (ORIGIN_OPTIONS[0]?.iata ?? 'SEL');
    return pref === destination ? (ORIGIN_OPTIONS.find((o) => o.iata !== destination)?.iata ?? pref) : pref;
  });
  // 기본 일정 = 행사 기간(출국=시작일, 귀국=종료일). 여기서부터 사용자가 직접 조절한다.
  const { checkin, checkout } = travelDates(startAt, endAt);
  const [departDate, setDepartDate] = useState(checkin);
  const [returnDate, setReturnDate] = useState(checkout);

  const groups = useMemo(() => originGroups(locale, destination), [locale, destination]);
  const url = useMemo(
    () => flightSearchUrl({ origin, destination, departDate, returnDate, locale, campaign }),
    [origin, destination, departDate, returnDate, locale, campaign],
  );
  // 제휴 마커·목적지가 없으면 섹션 자체가 의미 없다. (날짜를 비운 상태는 버튼만 잠근다)
  if (!TRAVELPAYOUTS_MARKER || !destination) return null;

  // 출국일을 귀국일 뒤로 밀면 귀국일도 같이 밀어 준다(귀국 < 출국 조합 방지).
  const onDepartChange = (v: string) => {
    setDepartDate(v);
    if (v && returnDate && returnDate <= v) setReturnDate(addDays(v, 1));
  };

  // 한 줄에 다 밀어 넣으면 답답해서 3줄(출발/도착 → 날짜 → 검색)로 나눈다.
  const fieldClass =
    'block w-full rounded-lg border border-grey-300 bg-white px-4 py-3 text-sm text-grey-900 transition-colors focus:border-primary focus:outline-none';
  // iOS Safari의 date 입력은 고유 폭이 커서 w-full만으로는 카드 밖으로 삐져나온다.
  // appearance 초기화 + min-w-0/max-w-full로 컨테이너 안에 묶어 둔다.
  const dateFieldClass = `${fieldClass} min-w-0 max-w-full appearance-none text-left [&::-webkit-date-and-time-value]:text-left`;
  const legendClass = 'block text-[11px] font-semibold uppercase tracking-wide text-grey-500';
  const ctaClass =
    'flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3.5 text-sm font-semibold transition-colors';

  return (
    <section id="flights" className="scroll-mt-24">
      <SectionTitle icon={<Plane size={22} className="text-primary" />}>{labels.flightsTitle}</SectionTitle>
      <div className="rounded-xl border border-grey-200 p-5 sm:p-6">
        <p className="text-sm leading-relaxed text-grey-700">{labels.flightsDesc}</p>
        <div className="mt-6 space-y-5">
          {/* 1줄 — 출발지 / 도착지 */}
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
            <label className="block min-w-0 space-y-2">
              <span className={legendClass}>{labels.from}</span>
              <select
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className={`${fieldClass} min-w-0 max-w-full truncate`}
              >
                {groups.map((g) => (
                  <optgroup key={g.key} label={g.label}>
                    {g.options.map((o) => (
                      <option key={o.iata} value={o.iata}>
                        {locale === 'ko' ? o.ko : o.en} ({o.iata})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <div className="min-w-0 space-y-2">
              <span className={legendClass}>{labels.to}</span>
              <p className="break-words rounded-lg border border-grey-200 bg-grey-50 px-4 py-3 text-sm font-semibold text-grey-900">
                {destinationLabel} ({destination})
              </p>
              {destinationNote && (
                <span className="block text-[11px] text-grey-500">
                  {labels.nearestAirport.replace('{city}', destinationNote)}
                </span>
              )}
            </div>
          </div>
          {/* 2줄 — 가는 날 / 오는 날 */}
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
            <label className="block min-w-0 space-y-2">
              <span className={legendClass}>{labels.depart}</span>
              <input
                type="date"
                value={departDate}
                onChange={(e) => onDepartChange(e.target.value)}
                className={dateFieldClass}
              />
            </label>
            <label className="block min-w-0 space-y-2">
              <span className={legendClass}>{labels.return}</span>
              <input
                type="date"
                value={returnDate}
                min={departDate || undefined}
                onChange={(e) => setReturnDate(e.target.value)}
                className={dateFieldClass}
              />
            </label>
          </div>
          {/* 3줄 — 검색 */}
          <div className="space-y-2 pt-1">
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer sponsored nofollow"
                className={`${ctaClass} bg-primary text-white hover:bg-primary-deep`}
              >
                <Plane size={16} />
                {labels.searchFlights}
              </a>
            ) : (
              <button type="button" disabled className={`${ctaClass} cursor-not-allowed bg-grey-200 text-grey-500`}>
                <Plane size={16} />
                {labels.searchFlights}
              </button>
            )}
            <p className="text-center text-xs text-grey-500">{labels.oneWayHint}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function StaySection({
  address,
  addressText,
  startAt,
  endAt,
  locale,
  campaign,
  labels,
}: {
  address?: EventAddress;
  addressText?: string;
  startAt?: string;
  endAt?: string;
  locale: Locale;
  campaign?: string;
  labels: TravelLabels;
}) {
  const { checkin, checkout } = travelDates(startAt, endAt);
  const url = stayEmbedUrl({ address, addressText, checkin, checkout, locale, campaign });
  if (!url) return null;

  return (
    <section id="stay" className="scroll-mt-24">
      <SectionTitle icon={<BedDouble size={22} className="text-primary" />}>{labels.stayTitle}</SectionTitle>
      <p className="mb-3 text-sm leading-relaxed text-grey-700">{labels.stayDesc}</p>
      {/* 지도 임베드 — 데스크톱/태블릿 권장 최소높이 450px (Stay22 문서) */}
      <div className="overflow-hidden rounded-xl border border-grey-200">
        <iframe
          src={url}
          title={labels.stayTitle}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="block h-[480px] w-full border-0"
        />
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer sponsored nofollow"
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
      >
        {labels.viewStays}
        <ExternalLink size={14} />
      </a>
    </section>
  );
}
