// J&J Dash 심사위원 명단 → 심사위원관리 가져오기 모달.
//
// 우승자 가져오기(JnjWinnerImportDialog)와 짝. 다른 점 두 가지:
//   · 심사위원은 결과와 무관하게 대회를 열 때 확정되므로 Result 상태로 거르지 않는다.
//   · 부문을 비우면 '전 부문 공통'(division_id NULL)으로 들어간다 — 심사위원장 등.
'use client';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download } from 'lucide-react';
import { FormDrawer } from '@/components/resource/FormDrawer';
import { fmt } from '@/i18n/dict';
import { tr } from '@/i18n/tr';
import {
  useExistingJudgeCount,
  useImportJnjJudges,
  useJnjDashJudges,
} from '@/lib/queries/jnj-import';
import { DashSourcePicker, useDashPicker } from './DashSourcePicker';

/**
 * 대회 이름 안에 부문 이름의 낱말이 모두 들어 있으면 그 부문으로 본다.
 * 후보가 여럿이면 아무것도 고르지 않는다 — 잘못 넣는 것보다 낫다.
 */
function guessDivision(contestName: string, divisions: { editionId: string; id: string; label: string }[]) {
  const hay = contestName.toLowerCase();
  const hits = divisions.filter((d) => {
    const words = d.label.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 2);
    return words.length > 0 && words.every((w) => hay.includes(w));
  });
  return hits.length === 1 ? hits[0] : null;
}

export function JnjJudgeImportDialog({
  open,
  onClose,
  editionOptions,
  divisionOptions,
}: {
  open: boolean;
  onClose: () => void;
  editionOptions: { value: string; label: string }[];
  /** useJnjDivisionOptions() 결과 — value 는 jnj_divisions.id. */
  divisionOptions: { value: string; editionId: string; kind: string; label: string }[];
}) {
  const pick = useDashPicker(open, 'all');
  const [editionId, setEditionId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [replace, setReplace] = useState(true);

  const judges = useJnjDashJudges(pick.contestArg, pick.source, pick.divisionArg);
  const existing = useExistingJudgeCount(editionId, divisionId);
  const importer = useImportJnjJudges();

  // 열 때마다 초기화 — 직전 선택이 남아 엉뚱한 부문에 넣는 사고를 막는다.
  useEffect(() => {
    if (!open) return;
    setEditionId('');
    setDivisionId('');
    setSkipped(new Set());
    setReplace(true);
  }, [open]);

  // 자동 추천용 — jnj_divisions.id 로 다룬다(폼 값이 id 라서).
  // 가져오는 대시보드와 종류가 같은 부문만 넣을 수 있다 — DIV 심사위원을 J&J 부문에 넣으면
  // 그 부문 탭에서도, 종류 필터에서도 어긋난다(실제로 한 번 어긋났다).
  const divisionList = useMemo(
    () =>
      divisionOptions
        .filter((d) => d.kind === pick.source)
        .map((d) => ({ editionId: d.editionId, id: d.value, label: d.label })),
    [divisionOptions, pick.source],
  );

  // 대회를 고르면 이름이 일치하는 부문을 추천값으로 채운다(운영자가 바꿀 수 있다).
  useEffect(() => {
    if (!pick.targetName) return;
    const guess = guessDivision(pick.targetName, divisionList);
    if (guess) {
      setEditionId(guess.editionId);
      setDivisionId(guess.id);
    }
  }, [pick.targetName, divisionList]);

  const ownDivisions = useMemo(
    () => divisionList.filter((d) => d.editionId === editionId),
    [divisionList, editionId],
  );

  const entries = judges.data ?? [];
  const picked = entries.filter((e) => !skipped.has(e.key));
  const canImport = !!editionId && picked.length > 0 && !importer.isPending;

  function toggle(key: string) {
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function onImport() {
    if (!canImport) return;
    try {
      const res = await importer.mutateAsync({ editionId, divisionId, entries: picked, replace });
      window.alert(
        fmt(tr('심사위원 {n}명을 가져왔습니다.'), { n: res.inserted }) +
          (res.removed ? '\n' + fmt(tr('기존 {n}건은 덮어썼습니다.'), { n: res.removed }) : ''),
      );
      onClose();
    } catch (err) {
      window.alert(`${tr('가져오기에 실패했습니다.')}\n\n${err instanceof Error ? err.message : ''}`);
    }
  }

  return (
    <FormDrawer open={open} size="wide" title={tr('심사위원 가져오기')} onClose={onClose}>
      <div className="space-y-5">
        <p className="text-sm text-grey-500">
          {tr('J&J Dash 의 심사위원 명단을 그대로 가져옵니다. 라운드(예선·본선·결승)로 나뉜 중복은 한 명으로 합칩니다.')}
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
                setDivisionId('');
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
            <label className="label-caps">{tr('넣을 부문')}</label>
            <select
              className="input"
              value={divisionId}
              onChange={(e) => setDivisionId(e.target.value)}
              disabled={!editionId}
            >
              <option value="">{tr('전 부문 공통')}</option>
              {ownDivisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-grey-500">
              {tr('비워 두면 이 대회의 모든 부문 탭에 함께 노출됩니다.')}
            </p>
          </div>
        </div>

        {pick.contests.isError && (
          <p className="text-sm text-danger">
            {tr('대회 목록을 읽지 못했습니다.')} {(pick.contests.error as Error).message}
          </p>
        )}

        {/* 2) 미리보기 */}
        {pick.contestArg && (pick.source === 'jnj' || pick.divisionArg) && (
          <div className="overflow-hidden rounded-lg border border-grey-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm">
                <thead className="border-b border-grey-200 bg-grey-50 text-left">
                  <tr>
                    <th className="w-10 px-4 py-2.5" />
                    <th className="px-4 py-2.5 font-medium">{tr('순서')}</th>
                    <th className="px-4 py-2.5 font-medium">{tr('사진')}</th>
                    <th className="px-4 py-2.5 font-medium">{tr('이름')}</th>
                    <th className="px-4 py-2.5 font-medium">{tr('직함')}</th>
                    <th className="px-4 py-2.5 font-medium">{tr('국가')}</th>
                    <th className="px-4 py-2.5 font-medium">{tr('한두 줄 소개')}</th>
                  </tr>
                </thead>
                <tbody>
                  {judges.isLoading && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-grey-500">
                        {tr('불러오는 중…')}
                      </td>
                    </tr>
                  )}
                  {!judges.isLoading && entries.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-grey-500">
                        {tr('이 대회에는 등록된 심사위원이 없습니다.')}
                      </td>
                    </tr>
                  )}
                  {entries.map((e) => {
                    const on = !skipped.has(e.key);
                    const title = e.titleKo || e.titleEn;
                    return (
                      <tr
                        key={e.key}
                        className={`border-b border-grey-100 last:border-0 ${on ? '' : 'opacity-40'}`}
                      >
                        <td className="px-4 py-2.5">
                          <input type="checkbox" checked={on} onChange={() => toggle(e.key)} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-grey-500">{e.order}</td>
                        <td className="px-4 py-2.5">
                          {e.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={e.photoUrl} alt="" className="h-9 w-7 rounded-sm object-cover" />
                          ) : (
                            <span className="text-grey-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">{e.name || '—'}</td>
                        <td className="px-4 py-2.5">{title || <span className="text-grey-400">—</span>}</td>
                        <td className="whitespace-nowrap px-4 py-2.5">
                          {e.country ?? <span className="text-grey-400">—</span>}
                        </td>
                        <td className="max-w-[20rem] truncate px-4 py-2.5 text-grey-500" title={e.bio}>
                          {e.bio || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3) 덮어쓰기 안내 */}
        {!!editionId && !!existing.data && (
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
                {fmt(tr('이 범위에 이미 심사위원 {n}명이 등록돼 있습니다.'), { n: existing.data })}
              </span>
              <span className="mt-0.5 block text-grey-500">
                {tr('체크하면 기존 심사위원을 지우고 새로 넣습니다. 체크를 풀면 그대로 두고 아래 명단을 더합니다(중복될 수 있습니다).')}
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
            {importer.isPending ? tr('가져오는 중…') : fmt(tr('{n}명 가져오기'), { n: picked.length })}
          </button>
        </div>
      </div>
    </FormDrawer>
  );
}
