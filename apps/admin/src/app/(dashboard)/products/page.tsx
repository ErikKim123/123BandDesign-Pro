// Design Ref: §5.4 상품관리 — 목록 + 생성/수정(커스텀 카테고리 select) + 승인 전이
'use client';
import { useState } from 'react';
import { tr } from '@/i18n/tr';
import type { ColumnDef } from '@tanstack/react-table';
import { ResourceListPage } from '@/components/resource/ResourceListPage';
import { ResourceFormPage } from '@/components/resource/ResourceFormPage';
import { FormDrawer } from '@/components/resource/FormDrawer';
import {
  useStatusTransition,
  useResourceDelete,
  useResourceDuplicate,
  useResourceBulkDelete,
} from '@/lib/queries/resource';
import { useCategoryOptions } from '@/lib/queries/options';
import {
  productsConfig,
  PRODUCT_TRANSITIONS,
  type ProductRow,
} from '@/lib/resource/configs/products';
import type { FieldDef } from '@/lib/resource/types';
import { AiProductGenerator } from '@/components/product/AiProductGenerator';
import { ProductImageField } from '@/components/product/ProductImageField';
import { useT, useLocale } from '@/lib/locale/LocaleContext';
import { fmt } from '@/i18n/dict';
import { IconButton } from '@/components/ui/IconButton';
import { TRANSITION_ICON } from '@/components/ui/actionIcons';
import { Copy, Trash2, CheckCircle2 } from 'lucide-react';
import { pickI18n, type I18n } from '@123band/shared';

function ProductActions({ row }: { row: ProductRow }) {
  const { locale } = useLocale();
  const t = useT();
  const transition = useStatusTransition('products', 'products');
  const del = useResourceDelete('products', 'products');
  const dup = useResourceDuplicate('products', 'products');
  const allowed = PRODUCT_TRANSITIONS[row.status] ?? [];
  const busy = transition.isPending || del.isPending || dup.isPending;
  const name =
    pickI18n(row.name_i18n, locale) ||
    pickI18n(row.name_i18n, 'en') ||
    row.code ||
    t.actions.fallbackProduct;

  return (
    <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
      {allowed.map((tr) => (
        <IconButton
          key={tr.to}
          icon={TRANSITION_ICON[tr.labelKey] ?? CheckCircle2}
          label={t.transitions[tr.labelKey] ?? tr.label}
          disabled={busy}
          onClick={() => transition.mutate({ id: row.id, status: tr.to })}
        />
      ))}
      <IconButton
        icon={Copy}
        label={t.common.copy}
        disabled={busy}
        onClick={() => dup.mutate(row.id)}
      />
      <IconButton
        icon={Trash2}
        label={t.common.delete}
        danger
        disabled={busy}
        onClick={() => {
          if (window.confirm(fmt(t.actions.confirmDeleteProduct, { name }))) del.mutate(row.id);
        }}
      />
    </div>
  );
}

// 선택 삭제 바 — 선택된 상품들을 일괄 삭제(주문/참조가 있으면 삭제 불가 안내).
function ProductsBulkBar({ selected, clear }: { selected: ProductRow[]; clear: () => void }) {
  const { locale } = useLocale();
  const t = useT();
  const bulk = useResourceBulkDelete('products', 'products');
  const nameOf = (p: ProductRow) =>
    pickI18n(p.name_i18n, locale) || pickI18n(p.name_i18n, 'en') || p.code || t.actions.fallbackProduct;

  async function onDelete() {
    if (!selected.length) return;
    if (!window.confirm(fmt(tr('선택한 {n}개 상품을 삭제하시겠어요? 되돌릴 수 없습니다.'), { n: selected.length })))
      return;
    const res = await bulk.mutateAsync(selected.map((p) => p.id));
    clear();
    const msgs: string[] = [];
    if (res.deleted) msgs.push(fmt(tr('{n}개 삭제됨'), { n: res.deleted }));
    if (res.blocked.length) {
      const names = selected.filter((p) => res.blocked.includes(p.id)).map(nameOf);
      msgs.push(
        fmt(tr('주문/참조가 있어 삭제 불가 ({names})\n→ 대신 "품절" 또는 비활성 처리하세요.'), {
          names: names.join(', '),
        }),
      );
    }
    if (res.failed.length) {
      const names = selected.filter((p) => res.failed.includes(p.id)).map(nameOf);
      msgs.push(fmt(tr('삭제 실패 ({names})'), { names: names.join(', ') }));
    }
    if (msgs.length) window.alert(msgs.join('\n\n'));
  }

  return (
    <button className="btn btn-primary btn-sm" disabled={bulk.isPending || !selected.length} onClick={onDelete}>
      <Trash2 size={14} /> {bulk.isPending ? tr('삭제 중…') : `${tr('선택 삭제')} (${selected.length})`}
    </button>
  );
}

export default function ProductsPage() {
  const [editing, setEditing] = useState<Record<string, unknown> | null | undefined>(undefined);
  const { data: categoryOptions = [] } = useCategoryOptions();

  const actionCol: ColumnDef<ProductRow, unknown> = {
    id: 'actions',
    header: '승인/상태',
    cell: (c) => <ProductActions row={c.row.original} />,
  };
  const config = { ...productsConfig, listColumns: [...productsConfig.listColumns, actionCol] };

  // custom 필드 렌더 (Design §3.1 custom 슬롯): 카테고리 select + AI 상세 생성
  function renderCustom(
    field: FieldDef,
    value: unknown,
    set: (v: unknown) => void,
    allValues: Record<string, unknown>,
  ) {
    if (field.name === 'category_id') {
      return (
        <div className="space-y-1.5">
          <label className="label-caps">{field.label}</label>
          <select className="input" value={(value as string) ?? ''} onChange={(e) => set(e.target.value || null)}>
            <option value="">선택</option>
            {categoryOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      );
    }
    if (field.name === 'image_url') {
      return (
        <div className="space-y-1.5">
          <label className="label-caps">{field.label}</label>
          <ProductImageField
            value={value as string | undefined}
            set={set as (v: string | null) => void}
            allValues={allValues}
          />
        </div>
      );
    }
    if (field.name === 'detail_html_i18n') {
      return (
        <div className="space-y-1.5">
          <label className="label-caps">{field.label}</label>
          <AiProductGenerator
            value={value as I18n | undefined}
            set={set as (v: I18n) => void}
            allValues={allValues}
          />
        </div>
      );
    }
    return null;
  }

  const open = editing !== undefined;
  return (
    <>
      <ResourceListPage
        config={config as never}
        onRowClick={(row) => setEditing(row as unknown as Record<string, unknown>)}
        onCreate={() => setEditing(null)}
        selectable
        renderBulkBar={({ selected, clear }: { selected: ProductRow[]; clear: () => void }) => (
          <ProductsBulkBar selected={selected} clear={clear} />
        )}
      />
      <FormDrawer open={open} title={editing ? tr('상품 수정') : tr('상품 등록')} onClose={() => setEditing(undefined)}>
        <ResourceFormPage
          config={productsConfig as never}
          initial={editing ?? null}
          onDone={() => setEditing(undefined)}
          renderCustom={renderCustom as never}
        />
      </FormDrawer>
    </>
  );
}
