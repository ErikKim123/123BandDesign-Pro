// Design Ref: 설명.txt 쿠폰관리 — 목록 + 생성/수정 드로어
'use client';
import { useState } from 'react';
import { tr } from '@/i18n/tr';
import { ResourceListPage } from '@/components/resource/ResourceListPage';
import { ResourceFormPage } from '@/components/resource/ResourceFormPage';
import { FormDrawer } from '@/components/resource/FormDrawer';
import { couponsConfig } from '@/lib/resource/configs/coupons';

export default function CouponsPage() {
  const [editing, setEditing] = useState<Record<string, unknown> | null | undefined>(undefined);
  const open = editing !== undefined;

  return (
    <>
      <ResourceListPage
        config={couponsConfig as never}
        onRowClick={(row) => setEditing(row as Record<string, unknown>)}
        onCreate={() => setEditing(null)}
      />
      <FormDrawer open={open} title={editing ? tr('쿠폰 수정') : tr('쿠폰 등록')} onClose={() => setEditing(undefined)}>
        <ResourceFormPage
          config={couponsConfig as never}
          initial={editing ?? null}
          onDone={() => setEditing(undefined)}
        />
      </FormDrawer>
    </>
  );
}
