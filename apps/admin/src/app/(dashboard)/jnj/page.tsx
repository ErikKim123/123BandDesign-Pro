// Design Ref: J&J 대회관리 — 목록 + 생성/수정 드로어. 고객몰 상단 'J&J'(/jnj) 가 읽는 데이터.
'use client';
import { useState } from 'react';
import { tr } from '@/i18n/tr';
import { fmt } from '@/i18n/dict';
import { Copy, Trash2 } from 'lucide-react';
import { ResourceListPage } from '@/components/resource/ResourceListPage';
import { ResourceFormPage } from '@/components/resource/ResourceFormPage';
import { FormDrawer } from '@/components/resource/FormDrawer';
import { useResourceBulkDelete, useResourceBulkDuplicate } from '@/lib/queries/resource';
import { useEventProductOptions } from '@/lib/queries/options';
import type { FieldDef } from '@/lib/resource/types';
import { jnjEditionsConfig, type JnjEditionRow } from '@/lib/resource/configs/jnj-editions';

function BulkBar({ selected, clear }: { selected: JnjEditionRow[]; clear: () => void }) {
  const bulk = useResourceBulkDelete('jnj_editions', 'jnj_editions');
  const dup = useResourceBulkDuplicate('jnj_editions', 'jnj_editions');
  async function onDelete() {
    if (!selected.length) return;
    if (
      !window.confirm(
        fmt(tr('선택한 {n}개 대회를 삭제하시겠어요? 등록된 우승자도 함께 삭제됩니다.'), {
          n: selected.length,
        }),
      )
    )
      return;
    await bulk.mutateAsync(selected.map((e) => e.id));
    clear();
  }
  async function onCopy() {
    if (!selected.length) return;
    await dup.mutateAsync(selected.map((e) => e.id));
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

export default function JnjEditionsPage() {
  const [editing, setEditing] = useState<Record<string, unknown> | null | undefined>(undefined);
  const open = editing !== undefined;
  const { data: eventOptions = [] } = useEventProductOptions();

  // 연결 행사 select — 옵션이 DB 에서 오므로 config 가 아니라 여기서 렌더한다.
  function renderCustom(field: FieldDef, value: unknown, set: (v: unknown) => void) {
    if (field.name !== 'event_product_id') return null;
    return (
      <div className="space-y-1.5">
        <label className="label-caps">{tr('연결 행사')}</label>
        <select
          className="input"
          value={(value as string) ?? ''}
          onChange={(e) => set(e.target.value || null)}
        >
          <option value="">{tr('연결 안 함')}</option>
          {eventOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-grey-500">
          {tr('선택하면 고객몰 대회 페이지에 행사 상세로 가는 버튼이 붙습니다.')}
        </p>
      </div>
    );
  }

  return (
    <>
      <ResourceListPage
        config={jnjEditionsConfig as never}
        onRowClick={(row) => setEditing(row as unknown as Record<string, unknown>)}
        onCreate={() => setEditing(null)}
        selectable
        renderBulkBar={({ selected, clear }: { selected: JnjEditionRow[]; clear: () => void }) => (
          <BulkBar selected={selected} clear={clear} />
        )}
      />
      {/* EN·KO 를 좌우로 나란히 놓고 비교하며 쓰는 화면이라 모달을 최대로 키운다 */}
      <FormDrawer
        open={open}
        size="full"
        title={editing ? tr('대회 수정') : tr('대회 추가')}
        onClose={() => setEditing(undefined)}
      >
        <ResourceFormPage
          config={jnjEditionsConfig as never}
          initial={editing ?? null}
          onDone={() => setEditing(undefined)}
          renderCustom={renderCustom as never}
        />
      </FormDrawer>
    </>
  );
}
