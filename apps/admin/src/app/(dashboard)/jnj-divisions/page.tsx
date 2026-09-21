// Design Ref: J&J 부문관리 — 대회 안의 부문(JLCF Bachata PRO / AMA / Salsa OPEN).
// 여기 등록한 순서·이름이 고객몰 /jnj 상단 부문 탭이 된다.
'use client';
import { useMemo, useState } from 'react';
import { tr } from '@/i18n/tr';
import { fmt } from '@/i18n/dict';
import { Copy, Trash2 } from 'lucide-react';
import { ResourceListPage } from '@/components/resource/ResourceListPage';
import { ResourceFormPage } from '@/components/resource/ResourceFormPage';
import { FormDrawer } from '@/components/resource/FormDrawer';
import { useResourceBulkDelete, useResourceBulkDuplicate } from '@/lib/queries/resource';
import {
  useDivisionCodeOptionsByKind,
  useJnjDivisionCodeOptions,
  useJnjEditionOptions,
} from '@/lib/queries/options';
import type { FieldDef } from '@/lib/resource/types';
import { jnjDivisionsConfig, type JnjDivisionRow } from '@/lib/resource/configs/jnj-divisions';

function BulkBar({ selected, clear }: { selected: JnjDivisionRow[]; clear: () => void }) {
  const bulk = useResourceBulkDelete('jnj_divisions', 'jnj_divisions');
  const dup = useResourceBulkDuplicate('jnj_divisions', 'jnj_divisions');
  async function onDelete() {
    if (!selected.length) return;
    if (
      !window.confirm(
        fmt(tr('선택한 {n}개 부문을 삭제하시겠어요? 해당 부문의 심사위원도 함께 삭제됩니다.'), {
          n: selected.length,
        }),
      )
    )
      return;
    await bulk.mutateAsync(selected.map((d) => d.id));
    clear();
  }
  async function onCopy() {
    if (!selected.length) return;
    await dup.mutateAsync(selected.map((d) => d.id));
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

/**
 * 부문 코드 — 목록에서 고르거나 새로 만든다.
 *
 * 한 대회에 오픈이 둘(바차타 오픈 · 키좀바 오픈)인 경우가 있어서 표준 코드 넷으로는 모자란다.
 * 코드는 우승자·점수·참가자를 이 탭에 붙이는 열쇠라 같은 대회 안에서 겹칠 수 없다(DB 제약).
 * 그래서 '직접 입력' 으로 open-kizomba 처럼 구분되는 코드를 만들게 한다.
 */
function CodeField({
  value,
  set,
  options,
}: {
  value: string;
  set: (v: unknown) => void;
  options: { value: string; label: string }[];
}) {
  const known = options.some((o) => o.value === value);
  // 값이 목록에 없으면(새로 만드는 중) 입력칸을 계속 열어 둔다.
  const [custom, setCustom] = useState(!!value && !known);
  return (
    <div className="space-y-1.5">
      <label className="label-caps">{tr('부문 코드')} *</label>
      <select
        className="input"
        value={custom ? '__custom__' : value}
        onChange={(e) => {
          if (e.target.value === '__custom__') {
            setCustom(true);
            set('');
          } else {
            setCustom(false);
            set(e.target.value);
          }
        }}
      >
        <option value="">{tr('선택')}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        <option value="__custom__">{tr('직접 입력 (새 코드)')}</option>
      </select>
      {custom && (
        <input
          className="input"
          value={value}
          onChange={(e) => set(e.target.value.trim().toLowerCase())}
          placeholder="open-kizomba"
          autoFocus
        />
      )}
      <p className="text-xs text-grey-500">
        {tr('같은 대회 안에서는 코드가 겹칠 수 없습니다. 오픈이 둘이면 open-bachata · open-kizomba 처럼 나눠 주세요. 영문 소문자·숫자·하이픈만 됩니다.')}
      </p>
    </div>
  );
}

export default function JnjDivisionsPage() {
  const [editing, setEditing] = useState<Record<string, unknown> | null | undefined>(undefined);
  const open = editing !== undefined;
  const { data: editionOptions = [] } = useJnjEditionOptions();
  const { data: codeOptions = [] } = useJnjDivisionCodeOptions();
  // 폼에서는 고른 종류의 코드만 — 필터(codeOptions)는 종류 상관없이 전부 보여 준다.
  const { data: codesByKind } = useDivisionCodeOptionsByKind();
  const config = useMemo(
    () => jnjDivisionsConfig(editionOptions, codeOptions.length ? codeOptions : undefined),
    [editionOptions, codeOptions],
  );

  // 소속 대회 select + 부문 코드 콤보박스 — 둘 다 옵션이 DB 에서 오므로 여기서 렌더한다.
  function renderCustom(
    field: FieldDef,
    value: unknown,
    set: (v: unknown) => void,
    allValues: Record<string, unknown>,
  ) {
    if (field.name === 'code') {
      const kind = (allValues.kind as string) || 'jnj';
      return (
        <CodeField
          key={kind}
          value={(value as string) ?? ''}
          set={set}
          options={codesByKind?.[kind] ?? codeOptions}
        />
      );
    }
    if (field.name !== 'edition_id') return null;
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
        <p className="text-xs text-grey-500">
          {tr('부문 코드는 우승자관리의 “부문” 과 같은 값이어야 시상대가 이 탭에 붙습니다.')}
        </p>
      </div>
    );
  }

  return (
    <>
      <ResourceListPage
        config={config as never}
        onRowClick={(row) => setEditing(row as unknown as Record<string, unknown>)}
        onCreate={() => setEditing(null)}
        selectable
        renderBulkBar={({ selected, clear }: { selected: JnjDivisionRow[]; clear: () => void }) => (
          <BulkBar selected={selected} clear={clear} />
        )}
      />
      {/* EN·KO 를 좌우로 나란히 놓고 비교하며 쓰는 화면이라 모달을 최대로 키운다 */}
      <FormDrawer
        open={open}
        size="full"
        title={editing ? tr('부문 수정') : tr('부문 추가')}
        onClose={() => setEditing(undefined)}
      >
        <ResourceFormPage
          config={config as never}
          initial={editing ?? null}
          onDone={() => setEditing(undefined)}
          renderCustom={renderCustom as never}
        />
      </FormDrawer>
    </>
  );
}
