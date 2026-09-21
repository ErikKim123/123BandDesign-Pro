// 상품관리 (오거나이저) — 내 상품만(seller_id 범위) + 생성/수정(카테고리 select + AI 상세) + 승인요청 전이
'use client';
import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { ResourceListPage } from '@/components/resource/ResourceListPage';
import { ResourceFormPage } from '@/components/resource/ResourceFormPage';
import { FormDrawer } from '@/components/resource/FormDrawer';
import {
  useStatusTransition,
  useResourceDelete,
  useResourceDuplicate,
} from '@/lib/queries/resource';
import { useCategoryOptions } from '@/lib/queries/options';
import {
  productsConfig,
  PARTNER_PRODUCT_TRANSITIONS,
  makeProductColumns,
  makeProductFormFields,
  typeOpts,
  statusOpts,
  type ProductRow,
} from '@/lib/resource/configs/products';
import type { FieldDef } from '@/lib/resource/types';
import { AiProductGenerator } from '@/components/product/AiProductGenerator';
import { ProductImageField } from '@/components/product/ProductImageField';
import { usePartner } from '@/lib/partner/context';
import { useT } from '@/i18n/useT';
import { useGlobalLocale, useI18nText } from '@/lib/i18n/locale-context';
import { IconButton } from '@/components/ui/IconButton';
import { TRANSITION_ICON, FALLBACK_TRANSITION_ICON } from '@/components/ui/actionIcons';
import { Copy, Trash2 } from 'lucide-react';
import type { I18n } from '@123band/shared';

function ProductActions({ row }: { row: ProductRow }) {
  const t = useT();
  const i18nText = useI18nText();
  const transition = useStatusTransition('products', 'products');
  const del = useResourceDelete('products', 'products');
  const dup = useResourceDuplicate('products', 'products');
  const allowed = PARTNER_PRODUCT_TRANSITIONS[row.status] ?? [];
  const busy = transition.isPending || del.isPending || dup.isPending;
  const name = i18nText(row.name_i18n) || row.code || t.rowActions.fallbackProduct;

  return (
    <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
      {allowed.map((tr) => (
        <IconButton
          key={tr.to}
          icon={TRANSITION_ICON[tr.labelKey] ?? FALLBACK_TRANSITION_ICON}
          label={t.transitions[tr.labelKey]}
          disabled={busy}
          onClick={() => {
            transition.mutate({ id: row.id, status: tr.to });
            if (tr.to === 'pending') {
              fetch('/api/notify/approval', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ productId: row.id, kind: 'product' }),
              }).catch(() => {});
            }
          }}
        />
      ))}
      <IconButton
        icon={Copy}
        label={t.rowActions.duplicateProduct}
        disabled={busy}
        onClick={() => dup.mutate(row.id)}
      />
      <IconButton
        icon={Trash2}
        label={t.common.delete}
        danger
        disabled={busy}
        onClick={() => {
          if (window.confirm(t.rowActions.confirmDeleteProduct(name))) del.mutate(row.id);
        }}
      />
    </div>
  );
}

export default function ProductsPage() {
  const t = useT();
  const locale = useGlobalLocale().locale ?? 'en';
  const { userId } = usePartner();
  const [editing, setEditing] = useState<Record<string, unknown> | null | undefined>(undefined);
  const { data: categoryOptions = [] } = useCategoryOptions();

  const actionCol: ColumnDef<ProductRow, unknown> = {
    id: 'actions',
    header: t.columns.status,
    cell: (c) => <ProductActions row={c.row.original} />,
  };

  // 신규 생성 시 seller_id 를 현재 오거나이저로 주입 (RLS with check 통과 + 정산 귀속).
  const config = useMemo(
    () => ({
      ...productsConfig,
      formFields: makeProductFormFields(t),
      createDefaults: { ...productsConfig.createDefaults, seller_id: userId },
    }),
    [userId, t],
  );
  const listConfig = useMemo(
    () => ({
      ...config,
      title: t.nav.products,
      listColumns: [...makeProductColumns(t, locale), actionCol],
      filters: [
        { name: 'q', label: t.list.codeSearch, kind: 'search', searchColumns: ['code'] },
        { name: 'product_type', label: t.columns.type, kind: 'select', options: typeOpts(t) },
        { name: 'status', label: t.columns.status, kind: 'select', options: statusOpts(t) },
      ],
    }),
    [config, t, locale], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // custom 필드 렌더: 카테고리 select + 대표 이미지 + AI 상세 생성
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
            <option value="">{t.common.select}</option>
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
        config={listConfig as never}
        scope={{ seller_id: userId }}
        onRowClick={(row) => setEditing(row as Record<string, unknown>)}
        onCreate={() => setEditing(null)}
      />
      <FormDrawer open={open} title={editing ? t.drawer.productEdit : t.drawer.productCreate} onClose={() => setEditing(undefined)}>
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
