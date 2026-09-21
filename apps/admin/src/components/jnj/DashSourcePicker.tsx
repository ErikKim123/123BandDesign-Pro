// 가져오기 모달 네 곳(참가자·성적·우승자·심사위원)이 같이 쓰는 '어디서 가져올까' 고르개.
//
// 세 대시보드가 같은 Supabase 프로젝트를 쓰지만 모양이 다르다:
//   · J&J Dash  — 대회 하나가 곧 한 부문이다. 대회만 고르면 된다.
//   · BATTLE·DIV — 대회 아래 부문(divisions)이 또 있고, 명단·결과·심사위원이 전부 부문에 매달린다.
// 그래서 BATTLE·DIV 를 고르면 '대시보드 부문' 칸이 하나 더 뜬다.
'use client';
import { useEffect, useMemo, useState } from 'react';
import { tr } from '@/i18n/tr';
import {
  DASH_SOURCES,
  useDashDivisions,
  useJnjDashContests,
  type DashSource,
} from '@/lib/queries/jnj-import';

export interface DashPicker {
  source: DashSource;
  setSource: (v: DashSource) => void;
  contestId: string;
  setContestId: (v: string) => void;
  divisionId: string;
  setDivisionId: (v: string) => void;
  /** 조회에 넘길 값 — 아직 다 안 골랐으면 null. */
  contestArg: string | null;
  divisionArg: string | null;
  /** 넣을 부문 자동 추정에 쓰는 이름 — J&J 는 대회 이름, BATTLE·DIV 는 대시보드 부문 이름. */
  targetName: string;
  contests: ReturnType<typeof useJnjDashContests>;
  divisions: ReturnType<typeof useDashDivisions>;
  /** 소스·대회·부문 중 무엇이든 바뀌면 값이 달라진다 — 체크 해제를 초기화하는 신호로 쓴다. */
  pickKey: string;
}

/**
 * @param open   모달이 열려 있을 때만 조회한다.
 * @param scope  J&J Dash 대회 목록 범위. 'result' 면 결승 확정 대회만(우승자 가져오기).
 */
export function useDashPicker(open: boolean, scope: 'result' | 'all' = 'all'): DashPicker {
  const [source, setSource] = useState<DashSource>('jnj');
  const [contestId, setContestId] = useState('');
  const [divisionId, setDivisionId] = useState('');

  const contests = useJnjDashContests(open, scope, source);
  const divisions = useDashDivisions(source, open && contestId ? contestId : null);

  // 모달을 열 때마다 처음 상태로 — 직전 선택이 남아 엉뚱한 곳에서 가져오는 사고를 막는다.
  useEffect(() => {
    if (!open) return;
    setSource('jnj');
    setContestId('');
    setDivisionId('');
  }, [open]);

  // 대시보드를 바꾸면 그 아래 선택은 의미가 없다 — 다른 대시보드의 대회 id 가 남으면 빈 목록이 된다.
  useEffect(() => {
    setContestId('');
    setDivisionId('');
  }, [source]);

  // 부문이 하나뿐이면 굳이 고르게 하지 않는다.
  const divisionList = useMemo(() => divisions.data ?? [], [divisions.data]);
  useEffect(() => {
    if (divisionList.length === 1 && divisionList[0]) setDivisionId(divisionList[0].id);
  }, [divisionList]);

  const contestArg = contestId || null;
  const divisionArg = source === 'jnj' ? null : divisionId || null;
  const targetName =
    source === 'jnj'
      ? ((contests.data ?? []).find((c) => c.id === contestId)?.name ?? '')
      : (divisionList.find((d) => d.id === divisionId)?.name ?? '');

  return {
    source,
    setSource,
    contestId,
    setContestId,
    divisionId,
    setDivisionId,
    contestArg,
    divisionArg,
    targetName,
    contests,
    divisions,
    pickKey: `${source}:${contestId}:${divisionId}`,
  };
}

/** 대시보드 · 대회 · (BATTLE·DIV 면) 대시보드 부문 — 모달 맨 앞 세 칸. */
export function DashSourcePicker({ picker }: { picker: DashPicker }) {
  const { source, setSource, contestId, setContestId, divisionId, setDivisionId, contests, divisions } = picker;
  return (
    <>
      <div className="space-y-1.5">
        <label className="label-caps">{tr('대시보드')}</label>
        <select className="input" value={source} onChange={(e) => setSource(e.target.value as DashSource)}>
          {DASH_SOURCES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="label-caps">{tr('대회')}</label>
        <select className="input" value={contestId} onChange={(e) => setContestId(e.target.value)}>
          <option value="">{contests.isLoading ? tr('불러오는 중…') : tr('선택')}</option>
          {(contests.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.id} · {c.name}
              {c.archived ? ` · ${tr('보관됨')}` : ''}
              {c.periodStart ? ` (${c.periodStart})` : ''}
            </option>
          ))}
        </select>
      </div>

      {source !== 'jnj' && (
        <div className="space-y-1.5">
          <label className="label-caps">{tr('대시보드 부문')} *</label>
          <select
            className="input"
            value={divisionId}
            onChange={(e) => setDivisionId(e.target.value)}
            disabled={!contestId}
          >
            <option value="">{divisions.isLoading ? tr('불러오는 중…') : tr('선택')}</option>
            {(divisions.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}
