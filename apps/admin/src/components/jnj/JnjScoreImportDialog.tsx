// J&J Dash 전 라운드 성적 → 점수관리 가져오기 모달.
//
// 흐름: 대회를 고르면 예선·본선·결승 성적이 라운드별로 몇 건인지 보여주고,
//       넣을 대회(에디션)·부문을 고른 뒤 체크한 라운드만 jnj_scores 로 넣는다.
// 우승자 가져오기와 달리 사람 단위가 아니라 '라운드 단위' 로 고른다 — 예선만 수십 줄이라
//       한 줄씩 체크하는 건 실수만 늘린다. 개별 수정은 목록에서 하면 된다.
'use client';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download } from 'lucide-react';
import { FormDrawer } from '@/components/resource/FormDrawer';
import { fmt } from '@/i18n/dict';
import { tr } from '@/i18n/tr';
import {
  ROUND_ORDER,
  useExistingScoreCount,
  useImportJnjScores,
  useJnjDashRoundResults,
  useJnjTargetDivisions,
  type JnjRound,
} from '@/lib/queries/jnj-import';
import { DashSourcePicker, useDashPicker } from './DashSourcePicker';
import { DIVISION_OPTS } from '@/lib/resource/configs/jnj-winners';

const ROUND_LABEL: Record<JnjRound, string> = {
  prelim: '예선',
  semi: '본선',
  final: '결승',
};

/**
 * 대회 이름 안에 부문 이름의 낱말이 모두 들어 있으면 그 부문으로 본다(우승자 가져오기와 같은 규칙).
 * 애매하면(후보가 여럿) 아무것도 고르지 않는다.
 */
function guessDivision(contestName: string, divisions: { editionId: string; code: string; label: string }[]) {
  const hay = contestName.toLowerCase();
  const hits = divisions.filter((d) => {
    const words = d.label.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 2);
    return words.length > 0 && words.every((w) => hay.includes(w));
  });
  return hits.length === 1 ? hits[0] : null;
}

export function JnjScoreImportDialog({
  open,
  onClose,
  editionOptions,
}: {
  open: boolean;
  onClose: () => void;
  editionOptions: { value: string; label: string }[];
}) {
  const pick = useDashPicker(open, 'all');
  const [editionId, setEditionId] = useState('');
  const [division, setDivision] = useState('');
  const [skippedRounds, setSkippedRounds] = useState<Set<JnjRound>>(new Set());
  const [replace, setReplace] = useState(true);

  // 성적은 결승 확정 전에도 라운드별로 쌓이므로 대회 목록을 상태로 거르지 않는다('all').
  const rounds = useJnjDashRoundResults(pick.contestArg, pick.source, pick.divisionArg);
  const divisions = useJnjTargetDivisions();
  const existing = useExistingScoreCount(editionId, division);
  const importer = useImportJnjScores();

  useEffect(() => {
    if (!open) return;
    setEditionId('');
    setDivision('');
    setSkippedRounds(new Set());
    setReplace(true);
  }, [open]);

  // 가져오는 대시보드와 종류가 같은 부문만 넣을 수 있다 — DIV 명단을 J&J 부문에 넣으면
  // 그 부문 탭에서도, 종류 필터에서도 어긋난다(실제로 한 번 어긋났다).
  const divisionList = useMemo(
    () => (divisions.data ?? []).filter((d) => d.kind === pick.source),
    [divisions.data, pick.source],
  );

  useEffect(() => {
    if (!pick.targetName) return;
    const guess = guessDivision(pick.targetName, divisionList);
    if (guess) {
      setEditionId(guess.editionId);
      setDivision(guess.code);
    }
  }, [pick.targetName, divisionList]);

  const divisionOptions = useMemo(() => {
    const own = divisionList.filter((d) => d.editionId === editionId);
    if (own.length) return own.map((d) => ({ value: d.code, label: d.label }));
    return DIVISION_OPTS.map((o) => ({ value: o.value, label: tr(o.label) }));
  }, [divisionList, editionId]);

  const entries = rounds.data ?? [];
  // 라운드 × 역할 요약 — 몇 줄이 들어가는지만 보여주고 체크는 라운드 단위로 받는다.
  const summary = useMemo(
    () =>
      ROUND_ORDER.map((round) => {
        const rows = entries.filter((e) => e.round === round);
        return {
          round,
          total: rows.length,
          leaders: rows.filter((e) => e.role === 'leader').length,
          followers: rows.filter((e) => e.role === 'follower').length,
          passed: rows.filter((e) => e.passed).length,
          // 결승 채점 상세가 붙은 줄 수 — 안 붙었으면 아래 안내가 뜨지 않는다.
          criteria: rows.filter((e) => (e.criteria?.judges.length ?? 0) > 0).length,
        };
      }).filter((s) => s.total > 0),
    [entries],
  );
  const picked = entries.filter((e) => !skippedRounds.has(e.round));
  const canImport = !!editionId && !!division && picked.length > 0 && !importer.isPending;

  function toggleRound(round: JnjRound) {
    setSkippedRounds((prev) => {
      const next = new Set(prev);
      if (next.has(round)) next.delete(round);
      else next.add(round);
      return next;
    });
  }

  async function onImport() {
    if (!canImport) return;
    try {
      const res = await importer.mutateAsync({ editionId, division, entries: picked, replace });
      window.alert(
        fmt(tr('성적 {n}건을 가져왔습니다.'), { n: res.inserted }) +
          (res.removed ? '\n' + fmt(tr('기존 {n}건은 덮어썼습니다.'), { n: res.removed }) : ''),
      );
      onClose();
    } catch (err) {
      window.alert(`${tr('가져오기에 실패했습니다.')}\n\n${err instanceof Error ? err.message : ''}`);
    }
  }

  return (
    <FormDrawer open={open} size="wide" title={tr('J&J 전 라운드 성적 가져오기')} onClose={onClose}>
      <div className="space-y-5">
        <p className="text-sm text-grey-500">
          {tr('J&J Dash 의 예선·본선(심사위원 O표)과 결승(총점·평균)을 그대로 가져옵니다. 고객몰 J&J 페이지의 전체 결과 표에 그대로 나옵니다.')}
        </p>

        {/* 1) 어디서 → 어디로 */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DashSourcePicker picker={pick} />
          <div className="space-y-1.5">
            <label className="label-caps">{tr('넣을 대회')} *</label>
            <select
              className="input"
              value={editionId}
              onChange={(e) => {
                setEditionId(e.target.value);
                setDivision('');
              }}
            >
              <option value="">{tr('선택')}</option>
              {editionOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="label-caps">{tr('넣을 부문')} *</label>
            <select
              className="input"
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              disabled={!editionId}
            >
              <option value="">{tr('선택')}</option>
              {divisionOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {pick.contests.isError && (
          <p className="text-sm text-danger">
            {tr('대회 목록을 읽지 못했습니다.')} {(pick.contests.error as Error).message}
          </p>
        )}

        {/* 2) 라운드별 요약 + 선택 */}
        {pick.contestArg && (pick.source === 'jnj' || pick.divisionArg) && (
          <div className="overflow-hidden rounded-lg border border-grey-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead className="border-b border-grey-200 bg-grey-50 text-left">
                  <tr>
                    <th className="w-10 px-4 py-2.5" />
                    <th className="px-4 py-2.5 font-medium">{tr('라운드')}</th>
                    <th className="px-4 py-2.5 font-medium">{tr('리더')}</th>
                    <th className="px-4 py-2.5 font-medium">{tr('팔로워')}</th>
                    <th className="px-4 py-2.5 font-medium">{tr('통과')}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{tr('합계')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rounds.isLoading && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-grey-500">
                        {tr('불러오는 중…')}
                      </td>
                    </tr>
                  )}
                  {!rounds.isLoading && summary.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-grey-500">
                        {tr('이 대회에는 아직 성적 기록이 없습니다.')}
                      </td>
                    </tr>
                  )}
                  {summary.map((s) => {
                    const on = !skippedRounds.has(s.round);
                    return (
                      <tr
                        key={s.round}
                        className={`border-b border-grey-100 last:border-0 ${on ? '' : 'opacity-40'}`}
                      >
                        <td className="px-4 py-2.5">
                          <input type="checkbox" checked={on} onChange={() => toggleRound(s.round)} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 font-medium">
                          {tr(ROUND_LABEL[s.round])}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-grey-500">{s.leaders}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-grey-500">{s.followers}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-grey-500">
                          {s.round === 'final' ? '—' : s.passed}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right">{s.total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* 결승 채점 상세(0084) — 조용히 따라 들어가는 값이라 몇 줄에 붙었는지만 알려준다. */}
            {summary.some((s) => s.criteria > 0) && (
              <p className="border-t border-grey-100 bg-grey-50 px-4 py-2.5 text-xs text-grey-500">
                {fmt(
                  tr('결승 채점 항목 점수(심사위원별)도 {n}건에 함께 들어갑니다 — 고객몰 전체 결과 표에서 결승 줄을 누르면 펼쳐집니다.'),
                  { n: summary.find((s) => s.round === 'final')?.criteria ?? 0 },
                )}
              </p>
            )}
          </div>
        )}

        {/* 3) 덮어쓰기 안내 */}
        {!!editionId && !!division && !!existing.data && (
          <label className="flex items-start gap-2 rounded-lg border border-grey-200 bg-grey-50 px-4 py-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
            />
            <span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <AlertTriangle size={14} />
                {fmt(tr('이 부문에 이미 성적 {n}건이 등록돼 있습니다.'), { n: existing.data })}
              </span>
              <span className="mt-0.5 block text-grey-500">
                {tr('체크하면 가져오는 라운드의 기존 성적만 지우고 새로 넣습니다(고르지 않은 라운드는 그대로 둡니다).')}
              </span>
            </span>
          </label>
        )}

        <div className="flex justify-end gap-2 border-t border-grey-200 pt-4">
          <button className="btn btn-secondary btn-sm" onClick={onClose} disabled={importer.isPending}>
            {tr('취소')}
          </button>
          <button className="btn btn-primary btn-sm" onClick={onImport} disabled={!canImport}>
            <Download size={14} />
            {importer.isPending ? tr('가져오는 중…') : fmt(tr('{n}건 가져오기'), { n: picked.length })}
          </button>
        </div>
      </div>
    </FormDrawer>
  );
}
