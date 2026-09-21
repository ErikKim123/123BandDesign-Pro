// Design Ref: J&J 심사위원관리 — 고객몰 /jnj 각 부문 탭의 '심사위원' 사진 카드로 나온다.
// 부문을 비워 두면 그 대회의 모든 부문에 공통으로 노출된다(심사위원장 등).
'use client';
import { useMemo, useState } from 'react';
import { tr } from '@/i18n/tr';
import { fmt } from '@/i18n/dict';
import { Copy, Download, Trash2 } from 'lucide-react';
import { ResourceListPage } from '@/components/resource/ResourceListPage';
import { ResourceFormPage } from '@/components/resource/ResourceFormPage';
import { FormDrawer } from '@/components/resource/FormDrawer';
import { CountrySelect } from '@/components/form/CountrySelect';
import { JnjJudgeImportDialog } from '@/components/jnj/JnjJudgeImportDialog';
import { useResourceBulkDelete, useResourceBulkDuplicate } from '@/lib/queries/resource';
import { useJnjEditionOptions, useJnjDivisionOptions } from '@/lib/queries/options';
import { KIND_OPTS } from '@/lib/resource/configs/jnj-divisions';
import type { FieldDef } from '@/lib/resource/types';
import { jnjJudgesConfig, type JnjJudgeRow } from '@/lib/resource/configs/jnj-judges';

function BulkBar({ selected, clear }: { selected: JnjJudgeRow[]; clear: () => void }) {
  const bulk = useResourceBulkDelete('jnj_judges', 'jnj_judges');
  const dup = useResourceBulkDuplicate('jnj_judges', 'jnj_judges');
  async function onDelete() {
    if (!selected.length) return;
    if (!window.confirm(fmt(tr('선택한 {n}명을 삭제하시겠어요? 되돌릴 수 없습니다.'), { n: selected.length })))
      return;
    await bulk.mutateAsync(selected.map((j) => j.id));
    clear();
  }
  async function onCopy() {
    if (!selected.length) return;
    await dup.mutateAsync(selected.map((j) => j.id));
    clear();
  }
  return (
    <div className="flex gap-2">
      <button className="btn btn-secondary btn-sm" disabled={dup.isPending || !selected.length} onClick={onCopy}>
        <Copy size={14} /> {dup.isPending ? tr('복사 중…') : `${tr('선택 복사')} (${selected.length})`}
      </button>
      <button className="btn btn-primary btn-sm" disabled={bulk.isPending || !selected.length} onClick={onDelete}>
        <Trash2 size={14} /> {bulk.isPending ? tr('삭제 중…') : `${tr('선택 삭제')} (${selected.length})`}
      </button>
    </div>
  );
}

export default function JnjJudgesPage() {
  const [editing, setEditing] = useState<Record<string, unknown> | null | undefined>(undefined);
  const [importing, setImporting] = useState(false);
  const open = editing !== undefined;
  const { data: editionOptions = [] } = useJnjEditionOptions();
  const { data: divisionOptions = [] } = useJnjDivisionOptions();
  const config = useMemo(
    () =>
      jnjJudgesConfig(
        editionOptions,
        divisionOptions.map((d) => ({ value: d.value, label: d.label })),
      ),
    [editionOptions, divisionOptions],
  );

  function renderCustom(
    field: FieldDef,
    value: unknown,
    set: (v: unknown) => void,
    allValues: Record<string, unknown>,
    setField: (name: string, v: unknown) => void,
  ) {
    if (field.name === 'kind') {
      return (
        <div className="space-y-1.5">
          <label className="label-caps">{tr('종류')} *</label>
          <select
            className="input"
            value={(value as string) || 'jnj'}
            onChange={(e) => {
              set(e.target.value);
              // 종류를 바꾸면 이전 종류의 부문이 남지 않게 비운다.
              setField('division_id', null);
            }}
          >
            {KIND_OPTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      );
    }
    if (field.name === 'edition_id') {
      return (
        <div className="space-y-1.5">
          <label className="label-caps">{tr('대회')} *</label>
          <select
            className="input"
            value={(value as string) ?? ''}
            onChange={(e) => {
              set(e.target.value || null);
              // 대회를 바꾸면 이전 대회의 부문이 남지 않게 초기화한다.
              setField('division_id', null);
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
      );
    }
    if (field.name === 'division_id') {
      // 선택한 대회 + 선택한 종류의 부문만 고를 수 있게 좁힌다(0110) — BATTLE 심사위원에게
      // J&J 부문이 딸려 나오면 잘못 붙는다.
      const editionId = (allValues.edition_id as string) ?? '';
      const kind = (allValues.kind as string) || 'jnj';
      const opts = divisionOptions.filter((d) => d.editionId === editionId && d.kind === kind);
      return (
        <div className="space-y-1.5">
          <label className="label-caps">{tr('부문')}</label>
          <select
            className="input"
            value={(value as string) ?? ''}
            disabled={!editionId}
            onChange={(e) => set(e.target.value || null)}
          >
            <option value="">{tr('전 부문 공통')}</option>
            {opts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-grey-500">
            {editionId
              ? tr('비워 두면 이 대회의 모든 부문 탭에 함께 노출됩니다.')
              : tr('대회를 먼저 선택하세요.')}
          </p>
        </div>
      );
    }
    if (field.name === 'country') {
      return (
        <div className="space-y-1.5">
          <label className="label-caps">{tr(field.label)}</label>
          <CountrySelect value={(value as string) ?? undefined} onChange={(cc) => set(cc ?? null)} />
        </div>
      );
    }
    return null;
  }

  return (
    <>
      <ResourceListPage
        config={config as never}
        onRowClick={(row) => setEditing(row as unknown as Record<string, unknown>)}
        onCreate={() => setEditing(null)}
        headerActions={
          <button className="btn btn-secondary btn-sm" onClick={() => setImporting(true)}>
            <Download size={16} /> {tr('심사위원 가져오기')}
          </button>
        }
        selectable
        renderBulkBar={({ selected, clear }: { selected: JnjJudgeRow[]; clear: () => void }) => (
          <BulkBar selected={selected} clear={clear} />
        )}
      />
      {/* EN·KO 를 좌우로 나란히 놓고 비교하며 쓰는 화면이라 모달을 최대로 키운다 */}
      <FormDrawer
        open={open}
        size="full"
        title={editing ? tr('심사위원 수정') : tr('심사위원 추가')}
        onClose={() => setEditing(undefined)}
      >
        <ResourceFormPage
          config={config as never}
          initial={editing ?? null}
          onDone={() => setEditing(undefined)}
          renderCustom={renderCustom as never}
        />
      </FormDrawer>
      <JnjJudgeImportDialog
        open={importing}
        onClose={() => setImporting(false)}
        editionOptions={editionOptions}
        divisionOptions={divisionOptions}
      />
    </>
  );
}
