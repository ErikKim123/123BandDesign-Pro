// Design Ref: §5.1/§5.3 — 제네릭 목록 페이지 (필터바 + DataTable). config 소비.
'use client';
import { useState, type ReactNode } from 'react';
import { Plus, Search } from 'lucide-react';
import { DataTable } from '@/components/data-table/DataTable';
import { useResourceList, type ListParams } from '@/lib/queries/resource';
import { useT } from '@/i18n/useT';
import type { ResourceConfig } from '@/lib/resource/types';

interface Props<T> {
  config: ResourceConfig<T>;
  onRowClick?: (row: T) => void;
  onCreate?: () => void;
  /** 항상 적용되는 동적 범위 eq 필터 (예: seller_id = 현재 오거나이저). */
  scope?: Record<string, string>;
  /** 제목 줄 우측, '추가' 버튼 왼쪽에 놓이는 부가 액션 (예: 엑셀 내려받기). */
  headerActions?: ReactNode;
}

export function ResourceListPage<T extends { id?: string }>({
  config, onRowClick, onCreate, scope, headerActions,
}: Props<T>) {
  const t = useT();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const pageSize = config.pageSize ?? 20;

  const searchFilter = config.filters.find((f) => f.kind === 'search');
  const params: ListParams = {
    page, pageSize, search,
    searchColumns: searchFilter?.searchColumns,
    filters,
    scope,
  };
  const { data, isLoading } = useResourceList(config, params);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl uppercase tracking-tight">{config.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {headerActions}
          {config.canCreate !== false && (
            <button className="btn btn-primary btn-sm" onClick={onCreate}>
              <Plus size={16} /> {t.common.add}
            </button>
          )}
        </div>
      </div>

      {/* 필터 바 — 반응형 */}
      <div className="flex flex-wrap items-center gap-2">
        {config.filters.map((f) =>
          f.kind === 'search' ? (
            <div key={f.name} className="relative min-w-48 flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-400" />
              <input
                className="input pl-9"
                placeholder={f.label}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
          ) : (
            <select
              key={f.name}
              className="input w-auto max-w-full"
              value={filters[f.name] ?? ''}
              onChange={(e) => {
                setFilters((p) => ({ ...p, [f.name]: e.target.value }));
                setPage(1);
              }}
            >
              <option value="">{f.label}: {t.common.all}</option>
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ),
        )}
      </div>

      <DataTable
        columns={config.listColumns}
        data={data?.rows ?? []}
        isLoading={isLoading}
        onRowClick={onRowClick}
        page={page}
        pageSize={pageSize}
        total={data?.total ?? 0}
        onPageChange={setPage}
      />
    </div>
  );
}
