// Design Ref: J&J 점수관리 — 대회 × 부문 × 라운드(예선·본선·결승) 성적표.
// 고객몰 /jnj 의 '전체 결과' 섹션에 그대로 반영된다. 시상대(1~3위)는 J&J 우승자관리가 맡는다.
'use client';
import { useMemo, useState } from 'react';
import { tr } from '@/i18n/tr';
import { fmt } from '@/i18n/dict';
import { Download, Trash2 } from 'lucide-react';
import { ResourceListPage } from '@/components/resource/ResourceListPage';
import { ResourceFormPage } from '@/components/resource/ResourceFormPage';
import { FormDrawer } from '@/components/resource/FormDrawer';
import { CountrySelect } from '@/components/form/CountrySelect';
import { JnjScoreImportDialog } from '@/components/jnj/JnjScoreImportDialog';
import { useResourceBulkDelete } from '@/lib/queries/resource';
import { useJnjDivisionCodeOptions, useJnjEditionOptions } from '@/lib/queries/options';
import type { FieldDef } from '@/lib/resource/types';
import { jnjScoresConfig, type JnjScoreRow } from '@/lib/resource/configs/jnj-scores';

function BulkBar({ selected, clear }: { selected: JnjScoreRow[]; clear: () => void }) {
  const bulk = useResourceBulkDelete('jnj_scores', 'jnj_scores');
  async function onDelete() {
    if (!selected.length) return;
    if (!window.confirm(fmt(tr('선택한 {n}건을 삭제하시겠어요? 되돌릴 수 없습니다.'), { n: selected.length })))
      return;
    await bulk.mutateAsync(selected.map((s) => s.id));
    clear();
  }
  return (
    <div className="flex gap-2">
      <button className="btn btn-primary btn-sm" disabled={bulk.isPending || !selected.length} onClick={onDelete}>
        <Trash2 size={14} /> {bulk.isPending ? tr('삭제 중…') : `${tr('선택 삭제')} (${selected.length})`}
      </button>
    </div>
  );
}

export default function JnjScoresPage() {
  const [editing, setEditing] = useState<Record<string, unknown> | null | undefined>(undefined);
  const [importing, setImporting] = useState(false);
  const open = editing !== undefined;
  const { data: editionOptions = [] } = useJnjEditionOptions();
  // 대회·부문 옵션이 DB 에서 오므로 config 를 옵션과 함께 만든다.
  // 부문은 표준 코드 + 부문관리에서 직접 만든 코드(open-kizomba 등)까지 포함한다.
  const { data: divisionOptions = [] } = useJnjDivisionCodeOptions();
  const config = useMemo(
    () => jnjScoresConfig(editionOptions, divisionOptions.length ? divisionOptions : undefined),
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
            <Download size={16} /> {tr('성적 가져오기')}
          </button>
        }
        selectable
        renderBulkBar={({ selected, clear }: { selected: JnjScoreRow[]; clear: () => void }) => (
          <BulkBar selected={selected} clear={clear} />
        )}
      />
      <FormDrawer
        open={open}
        size="wide"
        title={editing ? tr('성적 수정') : tr('성적 추가')}
        onClose={() => setEditing(undefined)}
      >
        <ResourceFormPage
          config={config as never}
          initial={editing ?? null}
          onDone={() => setEditing(undefined)}
          renderCustom={renderCustom as never}
        />
      </FormDrawer>
      <JnjScoreImportDialog
        open={importing}
        onClose={() => setImporting(false)}
        editionOptions={editionOptions}
      />
    </>
  );
}
