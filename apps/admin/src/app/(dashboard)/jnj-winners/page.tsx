// Design Ref: J&J 우승자관리 — 대회 × 부문 × 역할 × 순위. 고객몰 명예의 전당(/jnj)에 그대로 반영된다.
'use client';
import { useMemo, useState } from 'react';
import { tr } from '@/i18n/tr';
import { fmt } from '@/i18n/dict';
import { Copy, Download, Trash2 } from 'lucide-react';
import { ResourceListPage } from '@/components/resource/ResourceListPage';
import { ResourceFormPage } from '@/components/resource/ResourceFormPage';
import { FormDrawer } from '@/components/resource/FormDrawer';
import { CountrySelect } from '@/components/form/CountrySelect';
import { JnjWinnerImportDialog } from '@/components/jnj/JnjWinnerImportDialog';
import { useResourceBulkDelete, useResourceBulkDuplicate } from '@/lib/queries/resource';
import { useJnjDivisionCodeOptions, useJnjEditionOptions } from '@/lib/queries/options';
import type { FieldDef } from '@/lib/resource/types';
import { jnjWinnersConfig, type JnjWinnerRow } from '@/lib/resource/configs/jnj-winners';

function BulkBar({ selected, clear }: { selected: JnjWinnerRow[]; clear: () => void }) {
  const bulk = useResourceBulkDelete('jnj_winners', 'jnj_winners');
  const dup = useResourceBulkDuplicate('jnj_winners', 'jnj_winners');
  async function onDelete() {
    if (!selected.length) return;
    if (!window.confirm(fmt(tr('선택한 {n}명을 삭제하시겠어요? 되돌릴 수 없습니다.'), { n: selected.length })))
      return;
    await bulk.mutateAsync(selected.map((w) => w.id));
    clear();
  }
  async function onCopy() {
    if (!selected.length) return;
    await dup.mutateAsync(selected.map((w) => w.id));
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

export default function JnjWinnersPage() {
  const [editing, setEditing] = useState<Record<string, unknown> | null | undefined>(undefined);
  const [importing, setImporting] = useState(false);
  const open = editing !== undefined;
  const { data: editionOptions = [] } = useJnjEditionOptions();
  // 대회·부문 옵션이 DB 에서 오므로 config 를 옵션과 함께 만든다.
  // 부문은 표준 코드 + 부문관리에서 직접 만든 코드(open-kizomba 등)까지 포함한다.
  const { data: divisionOptions = [] } = useJnjDivisionCodeOptions();
  const config = useMemo(
    () => jnjWinnersConfig(editionOptions, divisionOptions.length ? divisionOptions : undefined),
    [editionOptions, divisionOptions],
  );

  // 대회 select(옵션이 DB 에서 옴) + 국가 선택기는 config 로 못 넣어 여기서 렌더한다.
  function renderCustom(field: FieldDef, value: unknown, set: (v: unknown) => void) {
    if (field.name === 'edition_id') {
      return (
        <div className="space-y-1.5">
          <label className="label-caps">{tr('대회')} *</label>
          <select
            className="input"
            value={(value as string) ?? ''}
            onChange={(e) => set(e.target.value || null)}
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
    if (field.name === 'country' || field.name === 'partner_country') {
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
            <Download size={16} /> {tr('결과 가져오기')}
          </button>
        }
        selectable
        renderBulkBar={({ selected, clear }: { selected: JnjWinnerRow[]; clear: () => void }) => (
          <BulkBar selected={selected} clear={clear} />
        )}
      />
      {/* EN·KO 를 좌우로 나란히 놓고 비교하며 쓰는 화면이라 모달을 최대로 키운다 */}
      <FormDrawer
        open={open}
        size="full"
        title={editing ? tr('우승자 수정') : tr('우승자 추가')}
        onClose={() => setEditing(undefined)}
      >
        <ResourceFormPage
          config={config as never}
          initial={editing ?? null}
          onDone={() => setEditing(undefined)}
          renderCustom={renderCustom as never}
        />
      </FormDrawer>
      <JnjWinnerImportDialog
        open={importing}
        onClose={() => setImporting(false)}
        editionOptions={editionOptions}
      />
    </>
  );
}
