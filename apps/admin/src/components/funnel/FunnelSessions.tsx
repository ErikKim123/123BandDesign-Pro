// 방문 기록 — "누가 언제 와서 어느 화면을 몇 분 봤나".
//
// 목록은 서버에서 받아 그대로 그린다. 줄을 누르면 그 방문의 화면 순서(여정)를 그때 불러온다 —
// 방문 50건의 여정을 미리 다 받으면 수백 행이 되고, 대부분은 펼쳐 보지도 않는다.
//
// 여정 조회는 0085 admin_funnel_session_detail(SECURITY DEFINER + is_admin 가드)이라
// 브라우저 anon 클라이언트로 불러도 어드민 세션이 아니면 빈 결과가 온다.
'use client';
import { Fragment, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ChevronUp, ChevronDown, Clock, MonitorSmartphone, Timer, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { tr } from '@/i18n/tr';
import { cn } from '@/lib/utils';
import type { FunnelStep } from '@/lib/queries/funnel';
import type { SessionRow, SessionSort, SortDir } from '@/lib/queries/funnel-depth';
import { STEP_LABEL, formatKst, formatKstTime, formatDur } from './format';

interface DetailRow {
  seq: number;
  path: string;
  step: FunnelStep | null;
  viewed_at: string;
  dwell_sec: number | null;
  measured: boolean;
  is_exit: boolean;
}

/** 도달 단계 배지 — 결제까지 간 방문만 색을 준다. 목록을 훑을 때 눈에 걸리는 게 그거라서. */
const STEP_TONE: Record<FunnelStep, string> = {
  visit: 'bg-grey-100 text-grey-500',
  product_view: 'bg-info/10 text-info',
  cart: 'bg-warning/10 text-warning',
  checkout: 'bg-primary/10 text-primary',
  purchase: 'bg-success/10 text-success',
};

/**
 * 정렬 가능한 표 머리. 링크라서 새로고침·공유해도 같은 정렬이 나오고, JS 없이도 동작한다.
 * 정렬은 DB 가 한다(0086) — 목록이 전체 중 일부만 내려오므로 화면에서 정렬하면 답이 틀린다.
 */
function SortHeader({
  col,
  label,
  sort,
  dir,
  days,
  end,
  align = 'left',
}: {
  col: SessionSort;
  label: string;
  sort: SessionSort;
  dir: SortDir;
  days: number;
  end?: string | null;
  align?: 'left' | 'right';
}) {
  const on = sort === col;
  // 처음 누르면 큰 값부터 — '가장 오래 머문 방문'을 찾는 게 이 표를 정렬하는 이유다.
  // 이름만 예외로 가나다순이 먼저다.
  const first: SortDir = col === 'visitor' ? 'asc' : 'desc';
  const next: SortDir = on ? (dir === 'asc' ? 'desc' : 'asc') : first;
  const Arrow = on && dir === 'asc' ? ChevronUp : ChevronDown;
  return (
    <th className={cn('px-4 py-2.5 font-medium', align === 'right' && 'text-right')}>
      <Link
        href={`/funnel?days=${days}${end ? `&end=${end}` : ''}&sort=${col}&dir=${next}#sessions`}
        scroll={false}
        aria-sort={on ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={cn(
          'inline-flex items-center gap-1 transition-colors hover:text-primary',
          align === 'right' && 'flex-row-reverse',
          on ? 'text-primary' : 'text-ink',
        )}
      >
        {tr(label)}
        {/* 정렬 중이 아닌 열도 화살표를 흐리게 남긴다 — 누를 수 있는 열이라는 표시가 없으면
            아무도 누르지 않는다. 완전히 감추면 정렬 기능이 있는 줄 모른다. */}
        <Arrow size={13} className={cn(!on && 'opacity-25')} />
      </Link>
    </th>
  );
}

/** 성별 표기 — profiles.gender 값(female/male/other)을 그대로 보여 줄 수는 없다. */
const GENDER_LABEL: Record<string, string> = { female: '여성', male: '남성', other: '기타' };

function VisitorLabel({ row }: { row: SessionRow }) {
  if (row.userName || row.userEmail) {
    return (
      <span className="flex flex-col">
        <span className="font-medium">
          {row.userName || row.userEmail}
          {row.gender && GENDER_LABEL[row.gender] && (
            <span className="ml-1.5 rounded-pill bg-grey-100 px-1.5 py-px align-middle text-[10px] font-normal text-grey-600">
              {tr(GENDER_LABEL[row.gender])}
            </span>
          )}
        </span>
        {row.userName && row.userEmail && (
          <span className="text-[11px] text-grey-400">{row.userEmail}</span>
        )}
      </span>
    );
  }
  // 로그인한 적 없는 방문자 — 쿠키 id 앞 8자리로만 부른다(같은 사람인지 구분은 되게).
  return (
    <span className="flex flex-col">
      <span className="text-grey-500">{tr('익명 방문자')}</span>
      <span className="font-mono text-[11px] text-grey-400">{row.visitorId.slice(0, 8)}</span>
    </span>
  );
}

function SessionJourney({
  visitorId,
  sessionNo,
  days,
  end,
}: {
  visitorId: string;
  sessionNo: number;
  days: number;
  end?: string | null;
}) {
  const supabase = createClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['funnel-session-detail', visitorId, sessionNo, days, end],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_funnel_session_detail', {
        p_visitor: visitorId,
        p_session_no: sessionNo,
        p_days: days,
        p_end: end ?? null,
      });
      if (error) throw error;
      return (data ?? []) as DetailRow[];
    },
    staleTime: 60_000,
  });

  if (isLoading) return <p className="px-4 py-4 text-xs text-grey-400">{tr('불러오는 중…')}</p>;
  if (isError) return <p className="px-4 py-4 text-xs text-danger">{tr('불러오지 못했습니다.')}</p>;
  if (!data || data.length === 0)
    return <p className="px-4 py-4 text-xs text-grey-400">{tr('데이터 없음.')}</p>;

  // 막대 길이 기준 — 이 방문 안에서 가장 오래 본 화면을 100% 로 둔다.
  const max = Math.max(...data.map((d) => Number(d.dwell_sec ?? 0)), 1);

  return (
    <ol className="space-y-1.5 px-4 py-3">
      {data.map((d) => {
        const sec = Number(d.dwell_sec ?? 0);
        return (
          <li key={d.seq} className="flex items-center gap-3 text-xs">
            <span className="w-6 shrink-0 text-right font-mono text-grey-400">{d.seq}</span>
            <span className="w-10 shrink-0 whitespace-nowrap font-mono text-grey-400">
              {formatKstTime(d.viewed_at)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate font-mono">{d.path}</span>
                {d.step && (
                  <span
                    className={cn(
                      'shrink-0 rounded-pill px-1.5 py-0.5 text-[10px]',
                      STEP_TONE[d.step],
                    )}
                  >
                    {tr(STEP_LABEL[d.step])}
                  </span>
                )}
                {d.is_exit && (
                  <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-grey-400">
                    <LogOut size={10} /> {tr('여기서 나감')}
                  </span>
                )}
              </span>
              <span className="mt-1 block h-1.5 w-full overflow-hidden rounded bg-grey-50">
                <span
                  className={cn('block h-full rounded', d.measured ? 'bg-info' : 'bg-grey-300')}
                  style={{ width: `${Math.max(2, (sec / max) * 100)}%` }}
                />
              </span>
            </span>
            <span className="w-16 shrink-0 text-right">
              {/* 추정값은 회색으로 — 브라우저가 잰 값과 섞여 있다는 걸 눈으로 알 수 있게 */}
              <span className={cn('font-medium', !d.measured && 'text-grey-400')}>
                {sec > 0 ? formatDur(sec) : '—'}
              </span>
            </span>
          </li>
        );
      })}
      <li className="flex items-center gap-2 pt-1 text-[11px] text-grey-400">
        <span className="inline-block h-1.5 w-4 rounded bg-info" /> {tr('측정된 체류시간')}
        <span className="ml-2 inline-block h-1.5 w-4 rounded bg-grey-300" />{' '}
        {tr('다음 조회까지의 간격으로 추정')}
      </li>
    </ol>
  );
}

export function FunnelSessions({
  sessions,
  days,
  end,
  total,
  sort,
  dir,
}: {
  sessions: SessionRow[];
  days: number;
  /** 창의 끝 날짜(YYYY-MM-DD). 방문자수 막대에서 넘어온 하루 보기(0104). */
  end?: string | null;
  total: number;
  sort: SessionSort;
  dir: SortDir;
}) {
  // 한 번에 한 줄만 펼친다 — 여러 여정을 동시에 펼치면 어느 방문의 화면인지 헷갈린다.
  const [open, setOpen] = useState<string | null>(null);
  const ctl = { sort, dir, days, end } as const;

  if (sessions.length === 0) {
    return (
      <div className="rounded-lg border border-grey-200">
        <p className="px-4 py-10 text-center text-grey-500">{tr('데이터 없음.')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-grey-200">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-grey-200 bg-grey-50 text-left">
            <tr>
              <th className="w-8 px-2 py-2.5" />
              <SortHeader col="visitor" label="방문자" {...ctl} />
              <SortHeader col="started" label="방문 시각" {...ctl} />
              <SortHeader col="duration" label="머문 시간" align="right" {...ctl} />
              <SortHeader col="pageviews" label="화면" align="right" {...ctl} />
              {/* 경로는 정렬해도 읽을 값이 없다 — 이 칸만 그냥 머리글이다. */}
              <th className="px-4 py-2.5 font-medium">{tr('진입 → 이탈')}</th>
              <SortHeader col="step" label="도달 단계" {...ctl} />
              <SortHeader col="revenue" label="매출" align="right" {...ctl} />
            </tr>
          </thead>
          <tbody>
            {sessions.map((row) => {
              const key = `${row.visitorId}:${row.sessionNo}`;
              const isOpen = open === key;
              return (
                <Fragment key={key}>
                  <tr
                    onClick={() => setOpen(isOpen ? null : key)}
                    className={cn(
                      'cursor-pointer border-b border-grey-100 transition-colors last:border-0',
                      isOpen ? 'bg-grey-50' : 'hover:bg-grey-50',
                    )}
                  >
                    <td className="px-2 py-2.5 text-grey-400">
                      <ChevronRight
                        size={14}
                        className={cn('transition-transform', isOpen && 'rotate-90')}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <VisitorLabel row={row} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-grey-500">
                      {formatKst(row.startedAt)}
                      <span className="ml-2 inline-flex items-center gap-1 text-grey-400">
                        <MonitorSmartphone size={11} />
                        {row.device ?? '—'}
                        {row.country ? ` · ${row.country}` : ''}
                        {row.city ? ` · ${row.city}` : ''}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium">
                      {formatDur(row.durationSec)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-grey-500">{row.pageviews}</td>
                    <td className="max-w-0 px-4 py-2.5">
                      <span className="flex items-center gap-1.5 font-mono text-[11px] text-grey-500">
                        <span className="max-w-[9rem] truncate">{row.entryPath}</span>
                        <span className="text-grey-300">→</span>
                        <span className="max-w-[9rem] truncate">{row.exitPath}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'whitespace-nowrap rounded-pill px-2 py-0.5 text-[11px] font-medium',
                          STEP_TONE[row.maxStep],
                        )}
                      >
                        {tr(STEP_LABEL[row.maxStep])}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {row.revenue > 0 ? row.revenue.toLocaleString() : '—'}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-grey-100 bg-grey-50/60">
                      <td colSpan={8} className="p-0">
                        <SessionJourney
                          visitorId={row.visitorId}
                          sessionNo={row.sessionNo}
                          days={days}
                          end={end}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="flex items-center gap-1.5 border-t border-grey-200 bg-grey-50 px-4 py-2 text-[11px] text-grey-500">
        <Clock size={11} />
        {tr('30분 이상 끊기면 다른 방문으로 셉니다.')}
        {total > sessions.length && (
          <span className="ml-auto flex items-center gap-1">
            <Timer size={11} />
            {tr('최근')} {sessions.length.toLocaleString()} / {total.toLocaleString()}
            {tr('건')}
          </span>
        )}
      </p>
    </div>
  );
}
