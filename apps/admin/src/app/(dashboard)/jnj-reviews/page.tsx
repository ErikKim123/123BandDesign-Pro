// Design Ref: J&J 대회 후기 모더레이션 (목록 + 상세 조회/삭제). 대회 필터로 좁혀 본다.
'use client';
import { useMemo, useState } from 'react';
import { tr } from '@/i18n/tr';
import { ResourceListPage } from '@/components/resource/ResourceListPage';
import { ResourceFormPage } from '@/components/resource/ResourceFormPage';
import { FormDrawer } from '@/components/resource/FormDrawer';
import { useJnjEditionOptions } from '@/lib/queries/options';
import { jnjReviewsConfig } from '@/lib/resource/configs/jnj-reviews';

export default function JnjReviewsPage() {
  const [editing, setEditing] = useState<Record<string, unknown> | null | undefined>(undefined);
  const open = editing !== undefined;
  const { data: editionOptions = [] } = useJnjEditionOptions();
  const config = useMemo(() => jnjReviewsConfig(editionOptions), [editionOptions]);

  return (
    <>
      <ResourceListPage
        config={config as never}
        onRowClick={(row) => setEditing(row as Record<string, unknown>)}
      />
      <FormDrawer open={open} title={tr('후기 상세')} onClose={() => setEditing(undefined)}>
        <ResourceFormPage
          config={config as never}
          initial={editing ?? null}
          onDone={() => setEditing(undefined)}
        />
      </FormDrawer>
    </>
  );
}
