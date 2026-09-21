// Design Ref: §5.4 게시판관리 — 목록 + 생성/수정 드로어
'use client';
import { useState } from 'react';
import { tr } from '@/i18n/tr';
import { ResourceListPage } from '@/components/resource/ResourceListPage';
import { ResourceFormPage } from '@/components/resource/ResourceFormPage';
import { FormDrawer } from '@/components/resource/FormDrawer';
import { boardsConfig } from '@/lib/resource/configs/boards';

export default function BoardsPage() {
  const [editing, setEditing] = useState<Record<string, unknown> | null | undefined>(undefined);
  const open = editing !== undefined;

  return (
    <>
      <ResourceListPage
        config={boardsConfig as never}
        onRowClick={(row) => setEditing(row as Record<string, unknown>)}
        onCreate={() => setEditing(null)}
      />
      {/* 영문·한글 본문을 좌우로 길게 놓고 비교하며 쓰는 화면이라 모달을 최대로 키운다 */}
      <FormDrawer
        open={open}
        size="full"
        title={editing ? tr('게시글 수정') : tr('게시글 작성')}
        onClose={() => setEditing(undefined)}
      >
        <ResourceFormPage
          config={boardsConfig as never}
          initial={editing ?? null}
          onDone={() => setEditing(undefined)}
        />
      </FormDrawer>
    </>
  );
}
