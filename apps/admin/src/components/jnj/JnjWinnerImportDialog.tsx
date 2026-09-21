// J&J Dash 결승 결과 → 우승자관리 가져오기 모달.
//
// 흐름: 결승이 Result 인 대회를 고르면 1~3위(리더·팔로워 각각)를 미리 보여주고,
//       넣을 대회(에디션)·부문을 고른 뒤 체크한 것만 jnj_winners 로 넣는다(점수·참가번호도 같이 저장).
//       4위 이하를 포함한 전 라운드 성적표는 'J&J 점수관리' 화면이 맡는다(jnj_scores).
// 국가는 J&J Dash 참가신청의 국가(영문 이름)를 ISO2 로 바꿔 채운다. 못 알아본 값은 비워 두고 표에 원문을 남긴다.
'use client';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download } from 'lucide-react';
import { FormDrawer } from '@/components/resource/FormDrawer';
import { fmt } from '@/i18n/dict';
import { tr } from '@/i18n/tr';
import {
  NO_IMAGE_URL,
  useExistingWinnerCount,
  useImportJnjWinners,
  useJnjDashPodium,
  useJnjTargetDivisions,
} from '@/lib/queries/jnj-import';
import { DashSourcePicker, useDashPicker } from './DashSourcePicker';
import { DIVISION_OPTS } from '@/lib/resource/configs/jnj-winners';

const ROLE_LABEL: Record<'leader' | 'follower', string> = {
  leader: '리더',
  follower: '팔로워',
};

/**
 * 대회 이름 안에 부문 이름의 낱말이 모두 들어 있으면 그 부문으로 본다.
 * 예) 부문 'JLCF Bachata PRO' ⊂ 대회 'JLCF Bachata PRO Jack and Jill 2026'.
 * 애매하면(후보가 여럿) 아무것도 고르지 않는다 — 잘못 넣는 것보다 낫다.
 */
function guessDivision(contestName: string, divisions: { editionId: string; code: string; label: string }[]) {
  const hay = contestName.toLowerCase();
  const hits = divisions.filter((d) => {
    const words = d.label.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 2);
    return words.length > 0 && words.every((w) => hay.includes(w));
  });
  return hits.length === 1 ? hits[0] : null;
}

export function JnjWinnerImportDialog({
  open,
  onClose,
  editionOptions,
}: {
  open: boolean;
  onClose: () => void;
  editionOptions: { value: string; label: string }[];
}) {
  const pick = useDashPicker(open, 'result');
  const [editionId, setEditionId] = useState('');
  const [division, setDivision] = useState('');
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [replace, setReplace] = useState(true);

  const podium = useJnjDashPodium(pick.contestArg, pick.source, pick.divisionArg);
  const divisions = useJnjTargetDivisions();
  const existing = useExistingWinnerCount(editionId, division);
  const importer = useImportJnjWinners();

  // 열 때마다 초기화 — 직전 선택이 남아 엉뚱한 부문에 넣는 사고를 막는다.
  useEffect(() => {
    if (!open) return;
    setEditionId('');
    setDivision('');
    setSkipped(new Set());
    setReplace(true);
  }, [open]);

  // useEffect 의존성으로 쓰이므로 참조가 매 렌더 바뀌지 않게 고정한다.
  // 가져오는 대시보드와 종류가 같은 부문만 넣을 수 있다 — DIV 명단을 J&J 부문에 넣으면
  // 그 부문 탭에서도, 종류 필터에서도 어긋난다(실제로 한 번 어긋났다).
  const divisionList = useMemo(
    () => (divisions.data ?? []).filter((d) => d.kind === pick.source),
    [divisions.data, pick.source],
  );

  // 대회를 고르면 이름이 일치하는 부문을 추천값으로 채운다(운영자가 바꿀 수 있다).
  useEffect(() => {
    if (!pick.targetName) return;
    const guess = guessDivision(pick.targetName, divisionList);
    if (guess) {
      setEditionId(guess.editionId);
      setDivision(guess.code);
    }
  }, [pick.targetName, divisionList]);

  // 부문 목록은 선택한 대회(에디션)의 것만. 부문을 안 만든 대회면 기본 부문으로 폴백한다.
  const divisionOptions = useMemo(() => {
    const own = divisionList.filter((d) => d.editionId === editionId);
    if (own.length) return own.map((d) => ({ value: d.code, label: d.label }));
    return DIVISION_OPTS.map((o) => ({ value: o.value, label: tr(o.label) }));
  }, [divisionList, editionId]);

  const entries = podium.data ?? [];
  const picked = entries.filter((e) => !skipped.has(e.key));
  const canImport = !!editionId && !!division && picked.length > 0 && !importer.isPending;

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
      const res = await importer.mutateAsync({ editionId, division, entries: picked, replace });
      window.alert(
        fmt(tr('{n}명을 가져왔습니다.'), { n: res.inserted }) +
          (res.removed ? '\n' + fmt(tr('기존 {n}건은 덮어썼습니다.'), { n: res.removed }) : ''),
      );
      onClose();
    } catch (err) {
      window.alert(`${tr('가져오기에 실패했습니다.')}\n\n${err instanceof Error ? err.message : ''}`);
    }
  }

  return (
    <FormDrawer open={open} size="wide" title={tr('J&J 결승 결과 가져오기')} onClose={onClose}>
      <div className="space-y-5">
        <p className="text-sm text-grey-500">
          {tr('J&J Dash 에서 결승(FINAL)이 Result 인 대회만 보입니다. 1~3위를 리더·팔로워 각각 시상대로 넣습니다(점수도 같이 저장).')}
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
        {/* 결승 확정(final_status=result)으로 거르는 건 J&J Dash 뿐이다 — 그 안내도 거기서만. */}
        {pick.source === 'jnj' &&
          !pick.contests.isLoading &&
          !pick.contests.isError &&
          (pick.contests.data ?? []).length === 0 && (
            <p className="text-sm text-grey-500">
              {tr('결승이 Result 인 대회가 아직 없습니다. J&J Dash 의 ROUND CONTROL 에서 FINAL 을 Result 로 바꾼 뒤 다시 열어 주세요.')}
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
                    <th className="px-4 py-2.5 font-medium">{tr('역할')}</th>
                    <th className="px-4 py-2.5 font-medium">{tr('순위')}</th>
                    <th className="px-4 py-2.5 font-medium">{tr('번호')}</th>
                    <th className="px-4 py-2.5 font-medium">{tr('이름')}</th>
                    <th className="px-4 py-2.5 font-medium">{tr('국가')}</th>
                    <th className="px-4 py-2.5 font-medium">{tr('사진')}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{tr('점수')}</th>
                  </tr>
                </thead>
                <tbody>
                  {podium.isLoading && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-grey-500">
                        {tr('불러오는 중…')}
                      </td>
                    </tr>
                  )}
                  {!podium.isLoading && entries.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-grey-500">
                        {tr('이 대회에는 아직 결승 1~3위 기록이 없습니다.')}
                      </td>
                    </tr>
                  )}
                  {entries.map((e) => {
                    const on = !skipped.has(e.key);
                    return (
                      <tr
                        key={e.key}
                        className={`border-b border-grey-100 last:border-0 ${on ? '' : 'opacity-40'}`}
                      >
                        <td className="px-4 py-2.5">
                          <input type="checkbox" checked={on} onChange={() => toggle(e.key)} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5">{tr(ROLE_LABEL[e.role])}</td>
                        <td className="whitespace-nowrap px-4 py-2.5">{fmt(tr('{n}위'), { n: e.rank })}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-grey-500">{e.num}</td>
                        <td className="px-4 py-2.5">{e.name}</td>
                        <td className="whitespace-nowrap px-4 py-2.5">
                          {e.country ?? (
                            <span className="text-grey-400" title={e.countryRaw}>
                              {e.countryRaw ? `? ${e.countryRaw}` : '—'}
                            </span>
                          )}
                        </td>
                        {/* 사진이 없으면 실제로 들어갈 NO IMAGE 플레이스홀더를 그대로 보여준다. */}
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={e.photoUrl || NO_IMAGE_URL}
                              alt=""
                              className="h-9 w-7 rounded-sm object-cover"
                            />
                            {!e.photoUrl && (
                              <span className="text-xs text-grey-400">{tr('사진 없음')}</span>
                            )}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right text-grey-500">
                          {e.score || '—'}
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
                {fmt(tr('이 부문에 이미 {n}건이 등록돼 있습니다.'), { n: existing.data })}
              </span>
              <span className="mt-0.5 block text-grey-500">
                {tr('체크하면 기존 1~3위를 지우고 새로 넣습니다. 체크를 풀면 그대로 두고 아래 항목을 더합니다(중복될 수 있습니다).')}
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
            {importer.isPending
              ? tr('가져오는 중…')
              : fmt(tr('{n}명 가져오기'), { n: picked.length })}
          </button>
        </div>
      </div>
    </FormDrawer>
  );
}
