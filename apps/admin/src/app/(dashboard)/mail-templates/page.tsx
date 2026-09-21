// Design Ref: 메일링 관리 — 목록 + 생성/수정 드로어(미리보기·테스트 발송 포함)
'use client';
import { useState } from 'react';
import { tr } from '@/i18n/tr';
import { ResourceListPage } from '@/components/resource/ResourceListPage';
import { ResourceFormPage } from '@/components/resource/ResourceFormPage';
import { FormDrawer } from '@/components/resource/FormDrawer';
import { MailPreviewPanel } from '@/components/mail/MailPreviewPanel';
import { mailTemplatesConfig } from '@/lib/resource/configs/mail-templates';
import type { FieldDef } from '@/lib/resource/types';

export default function MailTemplatesPage() {
  const [editing, setEditing] = useState<Record<string, unknown> | null | undefined>(undefined);
  const open = editing !== undefined;

  // 미리보기는 '지금 입력 중인 값' 전체가 필요하다 — allValues 를 그대로 넘긴다.
  function renderCustom(
    field: FieldDef,
    _value: unknown,
    _set: (v: unknown) => void,
    allValues: Record<string, unknown>,
  ) {
    if (field.name === '__preview') return <MailPreviewPanel values={allValues} />;
    return null;
  }

  return (
    <>
      <ResourceListPage
        config={mailTemplatesConfig as never}
        onRowClick={(row) => setEditing(row as Record<string, unknown>)}
        onCreate={() => setEditing(null)}
      />
      {/* 본문 HTML 과 미리보기를 나란히 놓고 고치는 화면이라 모달을 최대로 키운다 */}
      <FormDrawer
        open={open}
        size="full"
        title={editing ? tr('메일 문구 수정') : tr('메일 문구 추가')}
        onClose={() => setEditing(undefined)}
      >
        <ResourceFormPage
          config={mailTemplatesConfig as never}
          initial={editing ?? null}
          onDone={() => setEditing(undefined)}
          renderCustom={renderCustom as never}
        />
      </FormDrawer>
    </>
  );
}
