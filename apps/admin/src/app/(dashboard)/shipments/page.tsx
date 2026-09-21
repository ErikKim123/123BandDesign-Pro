// Design Ref: §5.4 배송관리 — 목록 + 생성/수정 드로어
'use client';
import { useState } from 'react';
import { tr } from '@/i18n/tr';
import { ResourceListPage } from '@/components/resource/ResourceListPage';
import { ResourceFormPage } from '@/components/resource/ResourceFormPage';
import { FormDrawer } from '@/components/resource/FormDrawer';
import { shipmentsConfig } from '@/lib/resource/configs/shipments';

export default function ShipmentsPage() {
  const [editing, setEditing] = useState<Record<string, unknown> | null | undefined>(undefined);
  const open = editing !== undefined;

  return (
    <>
      <ResourceListPage
        config={shipmentsConfig as never}
        onRowClick={(row) => setEditing(row as Record<string, unknown>)}
        onCreate={() => setEditing(null)}
      />
      <FormDrawer open={open} title={editing ? tr('배송 수정') : tr('배송 등록')} onClose={() => setEditing(undefined)}>
        <ResourceFormPage
          config={shipmentsConfig as never}
          initial={editing ?? null}
          onDone={() => setEditing(undefined)}
        />
      </FormDrawer>
    </>
  );
}
