// Design Ref: §5.4 게시판관리 계열 — 상품문의 모더레이션 (목록 + 상세 조회/삭제)
'use client';
import { useState } from 'react';
import { tr } from '@/i18n/tr';
import { ResourceListPage } from '@/components/resource/ResourceListPage';
import { ResourceFormPage } from '@/components/resource/ResourceFormPage';
import { FormDrawer } from '@/components/resource/FormDrawer';
import { productQnaConfig } from '@/lib/resource/configs/product-qna';

export default function ProductQnaPage() {
  const [editing, setEditing] = useState<Record<string, unknown> | null | undefined>(undefined);
  const open = editing !== undefined;

  return (
    <>
      <ResourceListPage
        config={productQnaConfig as never}
        onRowClick={(row) => setEditing(row as Record<string, unknown>)}
      />
      <FormDrawer open={open} title={tr('문의 상세')} onClose={() => setEditing(undefined)}>
        <ResourceFormPage
          config={productQnaConfig as never}
          initial={editing ?? null}
          onDone={() => setEditing(undefined)}
        />
      </FormDrawer>
    </>
  );
}
