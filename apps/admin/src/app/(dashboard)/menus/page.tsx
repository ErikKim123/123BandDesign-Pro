// Design Ref: §5.4 메뉴관리 — 목록 + 생성/수정 드로어 + 선택 삭제
'use client';
import { useState } from 'react';
import { tr } from '@/i18n/tr';
import { fmt } from '@/i18n/dict';
import { Trash2 } from 'lucide-react';
import { ResourceListPage } from '@/components/resource/ResourceListPage';
import { ResourceFormPage } from '@/components/resource/ResourceFormPage';
import { FormDrawer } from '@/components/resource/FormDrawer';
import { useResourceBulkDelete } from '@/lib/queries/resource';
import { menusConfig, type MenuRow } from '@/lib/resource/configs/menus';

function MenusBulkBar({ selected, clear }: { selected: MenuRow[]; clear: () => void }) {
  const bulk = useResourceBulkDelete('menus', 'menus');
  async function onDelete() {
    if (!selected.length) return;
    if (!window.confirm(fmt(tr('선택한 {n}개 메뉴를 삭제하시겠어요? 되돌릴 수 없습니다.'), { n: selected.length })))
      return;
    await bulk.mutateAsync(selected.map((m) => m.id));
    clear();
  }
  return (
    <button className="btn btn-primary btn-sm" disabled={bulk.isPending || !selected.length} onClick={onDelete}>
      <Trash2 size={14} /> {bulk.isPending ? tr('삭제 중…') : `${tr('선택 삭제')} (${selected.length})`}
    </button>
  );
}

export default function MenusPage() {
  const [editing, setEditing] = useState<Record<string, unknown> | null | undefined>(undefined);
  const open = editing !== undefined;

  return (
    <>
      <ResourceListPage
        config={menusConfig as never}
        onRowClick={(row) => setEditing(row as unknown as Record<string, unknown>)}
        onCreate={() => setEditing(null)}
        selectable
        renderBulkBar={({ selected, clear }: { selected: MenuRow[]; clear: () => void }) => (
          <MenusBulkBar selected={selected} clear={clear} />
        )}
      />
      <FormDrawer open={open} title={editing ? tr('메뉴 수정') : tr('메뉴 추가')} onClose={() => setEditing(undefined)}>
        <ResourceFormPage
          config={menusConfig as never}
          initial={editing ?? null}
          onDone={() => setEditing(undefined)}
        />
      </FormDrawer>
    </>
  );
}
