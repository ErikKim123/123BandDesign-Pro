// Design Ref: §5.1/§5.3 — 제네릭 목록 페이지 (필터바 + DataTable). config 소비.
'use client';
import { useMemo, useState, type ReactNode } from 'react';
import { Plus, Search } from 'lucide-react';
import { DataTable } from '@/components/data-table/DataTable';
import { DataGrid } from '@/components/data-table/DataGrid';
import { useResourceList, type ListParams } from '@/lib/queries/resource';
import { fmt } from '@/i18n/dict';
import { useLocale, useT } from '@/lib/locale/LocaleContext';
import { trIn } from '@/i18n/tr';
import type { ResourceConfig } from '@/lib/resource/types';

interface Props<T> {
  config: ResourceConfig<T>;
  onRowClick?: (row: T) => void;
  onCreate?: () => void;
  // 선택(체크박스) 기능 — opt-in. selectable을 켜면 체크박스 컬럼이 표시된다.
  selectable?: boolean;
  isRowSelectable?: (row: T) => boolean; // false면 그 행은 체크 불가(예: 관리자)
  renderBulkBar?: (args: { selected: T[]; clear: () => void }) => ReactNode;
  // 제목 우측 '추가' 버튼 왼쪽 슬롯 — 목록 단위 액션(가져오기 등).
  headerActions?: ReactNode;
  /** 주면 표 대신 카드 그리드로 그린다 — 뱃지처럼 이미지가 주인공인 목록용.
   *  필터·검색·페이지네이션은 표 보기와 똑같이 동작한다(선택 체크박스는 표 전용). */
  renderCard?: (row: T) => ReactNode;
}

export function ResourceListPage<T extends { id?: string }>({
  config, onRowClick, onCreate, selectable, isRowSelectable, renderBulkBar, headerActions, renderCard,
}: Props<T>) {
  const t = useT();
  const { locale } = useLocale();
  const tl = (v: string) => trIn(v, locale);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const pageSize = config.pageSize ?? 20;

  const clearSelection = () => setSelectedIds(new Set());

  const searchFilter = config.filters.find((f) => f.kind === 'search');
  const params: ListParams = {
    page, pageSize, search,
    searchColumns: searchFilter?.searchColumns,
    filters,
  };
  const { data, isLoading } = useResourceList(config, params);
  const rows = useMemo(() => data?.rows ?? [], [data]);

  const selectedRows = rows.filter((r) => r.id && selectedIds.has(r.id));
  const selection = selectable
    ? {
        getId: (r: T) => r.id ?? '',
        selectedIds,
        isSelectable: isRowSelectable,
        onToggle: (id: string) =>
          setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          }),
        onToggleAll: (checked: boolean) =>
          setSelectedIds((prev) => {
            const next = new Set(prev);
            for (const r of rows) {
              if (!r.id) continue;
              if (isRowSelectable && !isRowSelectable(r)) continue;
              if (checked) next.add(r.id);
              else next.delete(r.id);
            }
            return next;
          }),
      }
    : undefined;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl uppercase tracking-tight">{tl(config.title)}</h1>
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
                placeholder={tl(f.label)}
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
              <option value="">{tl(f.label)}: {t.common.allSuffix}</option>
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>{tl(o.label)}</option>
              ))}
            </select>
          ),
        )}
      </div>

      {/* 선택 액션 바 — 선택된 항목이 있을 때만 표시 */}
      {renderBulkBar && selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-grey-200 bg-grey-50 px-4 py-3">
          <span className="text-sm text-grey-600">{fmt(t.table.selected, { n: selectedRows.length })}</span>
          {renderBulkBar({ selected: selectedRows, clear: clearSelection })}
        </div>
      )}

      {renderCard ? (
        <DataGrid
          data={rows}
          isLoading={isLoading}
          onRowClick={onRowClick}
          renderCard={renderCard}
          getKey={(r, i) => r.id ?? String(i)}
          page={page}
          pageSize={pageSize}
          total={data?.total ?? 0}
          onPageChange={setPage}
        />
      ) : (
        <DataTable
          columns={config.listColumns}
          data={rows}
          isLoading={isLoading}
          onRowClick={onRowClick}
          selection={selection}
          page={page}
          pageSize={pageSize}
          total={data?.total ?? 0}
          onPageChange={(p) => { clearSelection(); setPage(p); }}
        />
      )}
    </div>
  );
}
