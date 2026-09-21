// Design Ref: §5.4 카테고리관리 — 대/중 트리 + 생성/수정(parent select 커스텀)
'use client';
import { useState } from 'react';
import { Plus, FolderTree, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { ResourceFormPage } from '@/components/resource/ResourceFormPage';
import { FormDrawer } from '@/components/resource/FormDrawer';
import { StatusBadge } from '@/components/form/StatusBadge';
import { IconButton } from '@/components/ui/IconButton';
import { useResourceDelete } from '@/lib/queries/resource';
import { useT, useLocale } from '@/lib/locale/LocaleContext';
import { fmt } from '@/i18n/dict';
import { pickI18n, type I18n } from '@123band/shared';
import type { FieldDef, ResourceConfig } from '@/lib/resource/types';

interface CatRow {
  id: string;
  code: string | null;
  parent_id: string | null;
  name_i18n: I18n;
  sort_order: number;
  is_visible: boolean;
}

function buildCategoriesConfig(t: ReturnType<typeof useT>): ResourceConfig<CatRow> {
  const f = t.categories.field;
  return {
    key: 'categories',
    table: 'categories',
    title: t.categories.title,
    listColumns: [],
    filters: [],
    formFields: [
      { name: 'code', label: f.code, kind: 'text' },
      { name: 'name_i18n', label: f.name, kind: 'i18n', required: true },
      { name: 'parent_id', label: f.parent, kind: 'custom' },
      { name: 'sort_order', label: f.sortOrder, kind: 'number' },
      { name: 'is_visible', label: f.visible, kind: 'toggle' },
    ],
  };
}

function useCategories() {
  return useQuery({
    queryKey: ['categories', 'tree'],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('categories')
        .select('id, code, parent_id, name_i18n, sort_order, is_visible')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as CatRow[];
    },
  });
}

export default function CategoriesPage() {
  const t = useT();
  const { locale } = useLocale();
  const categoriesConfig = buildCategoriesConfig(t);
  const { data: cats = [], isLoading } = useCategories();
  const del = useResourceDelete('categories', 'categories');
  const [editing, setEditing] = useState<Record<string, unknown> | null | undefined>(undefined);

  const parents = cats.filter((c) => !c.parent_id);
  const childrenOf = (id: string) => cats.filter((c) => c.parent_id === id);
  const parentOptions = parents.map((p) => ({ value: p.id, label: pickI18n(p.name_i18n, locale) }));

  function renderCustom(field: FieldDef, value: unknown, set: (v: unknown) => void) {
    if (field.name === 'parent_id') {
      return (
        <div className="space-y-1.5">
          <label className="label-caps">{field.label}</label>
          <select className="input" value={(value as string) ?? ''} onChange={(e) => set(e.target.value || null)}>
            <option value="">{t.categories.topLevel}</option>
            {parentOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      );
    }
    return null;
  }

  function Row({ c, depth }: { c: CatRow; depth: number }) {
    const name = pickI18n(c.name_i18n, locale);
    return (
      <div className="flex items-center border-b border-grey-100 hover:bg-grey-50">
        <button
          onClick={() => setEditing(c as unknown as Record<string, unknown>)}
          className="flex flex-1 items-center gap-2 px-3 py-2.5 text-left text-sm"
          style={{ paddingLeft: `${12 + depth * 20}px` }}
        >
          {depth === 0 && <FolderTree size={16} className="text-grey-400" />}
          <span className="font-medium">{name}</span>
          <span className="text-xs text-grey-400">{c.code}</span>
          {!c.is_visible && <span className="ml-auto"><StatusBadge status={t.categories.hidden} /></span>}
        </button>
        <div className="mr-3 shrink-0">
          <IconButton
            icon={Trash2}
            label={t.common.delete}
            danger
            disabled={del.isPending}
            onClick={() => {
              if (window.confirm(fmt(t.common.deleteConfirm, { name: name || c.code || '' })))
                del.mutate(c.id);
            }}
          />
        </div>
      </div>
    );
  }

  const open = editing !== undefined;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl uppercase tracking-tight">{t.categories.title}</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing(null)}>
          <Plus size={16} /> {t.common.add}
        </button>
      </div>

      <div className="rounded-lg border border-grey-200">
        {isLoading ? (
          <p className="px-4 py-10 text-center text-grey-500">{t.table.loading}</p>
        ) : parents.length === 0 ? (
          <p className="px-4 py-10 text-center text-grey-500">{t.categories.empty}</p>
        ) : (
          parents.map((p) => (
            <div key={p.id}>
              <Row c={p} depth={0} />
              {childrenOf(p.id).map((ch) => <Row key={ch.id} c={ch} depth={1} />)}
            </div>
          ))
        )}
      </div>

      <FormDrawer open={open} title={editing ? t.categories.drawerEdit : t.categories.drawerCreate} onClose={() => setEditing(undefined)}>
        <ResourceFormPage
          config={categoriesConfig as never}
          initial={editing ?? null}
          onDone={() => setEditing(undefined)}
          renderCustom={renderCustom as never}
        />
      </FormDrawer>
    </div>
  );
}
