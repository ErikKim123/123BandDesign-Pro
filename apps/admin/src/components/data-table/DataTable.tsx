// Design Ref: §5.3 — 공통 DataTable (정렬·페이지네이션). 백오피스: flat, 1px divider, no shadow
'use client';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { Fragment, useMemo, useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { trIn } from '@/i18n/tr';
import { useLocale, useT } from '@/lib/locale/LocaleContext';
import { TablePagination } from './TablePagination';

// 선택(체크박스) 기능 — opt-in. 미전달 시 기존 동작 그대로.
export interface SelectionConfig<T> {
  getId: (row: T) => string;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  isSelectable?: (row: T) => boolean; // false면 그 행은 체크 불가
}

interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  isLoading?: boolean;
  onRowClick?: (row: T) => void;
  selection?: SelectionConfig<T>;
  // 서버 페이지네이션
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function DataTable<T>({
  columns, data, isLoading, onRowClick, selection, page, pageSize, total, onPageChange,
}: DataTableProps<T>) {
  const t = useT();
  const { locale } = useLocale();
  const [sorting, setSorting] = useState<SortingState>([]);

  // 리소스 설정은 모듈 상수라 한국어로 고정돼 있다. 렌더 시점에 헤더 문자열과
  // 셀이 돌려준 문자열을 카탈로그로 치환한다(카탈로그에 없으면 원문 유지 → 실제 데이터는 그대로).
  const localizedColumns = useMemo(
    () =>
      columns.map((col) => {
        const next = { ...col } as ColumnDef<T, unknown>;
        if (typeof col.header === 'string') next.header = trIn(col.header, locale);
        if (typeof col.cell === 'function') {
          const orig = col.cell;
          next.cell = (ctx) => {
            const out = orig(ctx);
            return typeof out === 'string' ? trIn(out, locale) : out;
          };
        }
        return next;
      }),
    [columns, locale],
  );

  const table = useReactTable({
    data,
    columns: localizedColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
  });

  // 선택 파생값 — 현재 페이지에서 선택 가능한 행 기준으로 전체선택 상태 계산
  const selectableRows = selection
    ? data.filter((r) => selection.isSelectable?.(r) ?? true)
    : [];
  const selectedOnPage = selection
    ? selectableRows.filter((r) => selection.selectedIds.has(selection.getId(r))).length
    : 0;
  const allChecked = selectableRows.length > 0 && selectedOnPage === selectableRows.length;
  const someChecked = selectedOnPage > 0 && !allChecked;
  const colCount = columns.length + (selection ? 1 : 0);

  // 폰에서는 표를 옆으로 밀어 보게 하지 않는다 — 열이 8개면 첫 두 열만 보이고 나머지는 있는 줄도 모른다.
  // 행 하나를 카드로 세워 '머리글: 값' 으로 늘어놓는다. 첫 열이 제목, 나머지가 그 아래.
  const mobileRows = table.getRowModel().rows.map((row) => {
    const cells = row.getVisibleCells();
    // 아바타 열은 '값'이 아니라 얼굴이다 — 목록에서처럼 카드 왼쪽에 붙이고, 제목은 그다음 열이 맡는다.
    const avatar = cells.find((c) => c.column.id === 'avatar');
    const [first, ...rest] = cells.filter((c) => c.column.id !== 'avatar');
    const rowSelectable = selection ? (selection.isSelectable?.(row.original) ?? true) : false;
    const rowId = selection ? selection.getId(row.original) : '';
    return (
      <li
        key={row.id}
        onClick={() => onRowClick?.(row.original)}
        className="flex gap-3 border-b border-grey-100 px-4 py-3 last:border-0 active:bg-grey-50"
        style={{ cursor: onRowClick ? 'pointer' : 'default' }}
      >
        {selection && (
          <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
            {rowSelectable && (
              <input
                type="checkbox"
                className="h-5 w-5 accent-black"
                checked={selection.selectedIds.has(rowId)}
                onChange={() => selection.onToggle(rowId)}
                aria-label={trIn('행 선택', locale)}
              />
            )}
          </div>
        )}
        {avatar && <div className="shrink-0">{flexRender(avatar.column.columnDef.cell, avatar.getContext())}</div>}
        <div className="min-w-0 flex-1">
          {first && (
            <div className="break-words font-medium">
              {flexRender(first.column.columnDef.cell, first.getContext())}
            </div>
          )}
          <dl className="mt-1.5 grid grid-cols-[minmax(4.5rem,auto)_1fr] gap-x-3 gap-y-1 text-xs">
            {rest.map((cell) => (
              <Fragment key={cell.id}>
                <dt className="label-caps truncate pt-0.5 !text-[10px]">
                  {flexRender(cell.column.columnDef.header, cell.getContext() as never)}
                </dt>
                <dd className="min-w-0 break-words text-grey-700">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </dd>
              </Fragment>
            ))}
          </dl>
        </div>
      </li>
    );
  });

  return (
    <div className="rounded-lg border border-grey-200">
      {/* 폰: 카드 목록 */}
      <div className="md:hidden">
        {selection && selectableRows.length > 0 && (
          <label className="flex items-center gap-2 border-b border-grey-200 bg-grey-50 px-4 py-2 text-xs text-grey-600">
            <input
              type="checkbox"
              className="h-4 w-4 accent-black"
              checked={allChecked}
              ref={(el) => { if (el) el.indeterminate = someChecked; }}
              onChange={(e) => selection.onToggleAll(e.target.checked)}
            />
            {trIn('전체 선택', locale)}
          </label>
        )}
        {isLoading ? (
          <p className="px-4 py-10 text-center text-sm text-grey-500">{t.table.loading}</p>
        ) : data.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-grey-500">{t.table.empty}</p>
        ) : (
          <ul>{mobileRows}</ul>
        )}
      </div>

      {/* 태블릿 이상: 표 */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-grey-200 bg-grey-50">
                {selection && (
                  <th className="w-10 px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer accent-black"
                      checked={allChecked}
                      ref={(el) => { if (el) el.indeterminate = someChecked; }}
                      disabled={selectableRows.length === 0}
                      onChange={(e) => selection.onToggleAll(e.target.checked)}
                      aria-label={trIn('전체 선택', locale)}
                    />
                  </th>
                )}
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    onClick={h.column.getToggleSortingHandler()}
                    className="whitespace-nowrap px-4 py-3 text-left label-caps select-none"
                    style={{ cursor: h.column.getCanSort() ? 'pointer' : 'default' }}
                  >
                    <span className="inline-flex items-center gap-1">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {h.column.getCanSort() && <ArrowUpDown size={12} className="text-grey-400" />}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={colCount} className="px-4 py-10 text-center text-grey-500">{t.table.loading}</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={colCount} className="px-4 py-10 text-center text-grey-500">{t.table.empty}</td></tr>
            ) : (
              table.getRowModel().rows.map((row) => {
                const rowSelectable = selection ? (selection.isSelectable?.(row.original) ?? true) : false;
                const rowId = selection ? selection.getId(row.original) : '';
                return (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  className="border-b border-grey-100 transition-colors hover:bg-grey-50"
                  style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                >
                  {selection && (
                    <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {rowSelectable && (
                        <input
                          type="checkbox"
                          className="h-4 w-4 cursor-pointer accent-black"
                          checked={selection.selectedIds.has(rowId)}
                          onChange={() => selection.onToggle(rowId)}
                          aria-label={trIn('행 선택', locale)}
                        />
                      )}
                    </td>
                  )}
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="whitespace-nowrap px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 — 카드 그리드(DataGrid)와 같은 컴포넌트를 쓴다. */}
      <TablePagination page={page} pageSize={pageSize} total={total} onPageChange={onPageChange} />
    </div>
  );
}
