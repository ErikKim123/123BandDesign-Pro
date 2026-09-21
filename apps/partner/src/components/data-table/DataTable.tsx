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
import { Fragment, useState } from 'react';
import { ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import { useT } from '@/i18n/useT';

interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  isLoading?: boolean;
  onRowClick?: (row: T) => void;
  // 서버 페이지네이션
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function DataTable<T>({
  columns, data, isLoading, onRowClick, page, pageSize, total, onPageChange,
}: DataTableProps<T>) {
  const t = useT();
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
  });

  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  // 폰에서는 표를 옆으로 밀어 보게 하지 않는다 — 첫 두 열만 보이고 나머지는 있는 줄도 모른다.
  // 행 하나를 카드로 세워 '머리글: 값' 으로 늘어놓는다. 첫 열이 제목, 나머지가 그 아래.
  const mobileRows = table.getRowModel().rows.map((row) => {
    const [first, ...rest] = row.getVisibleCells();
    return (
      <li
        key={row.id}
        onClick={() => onRowClick?.(row.original)}
        className="border-b border-grey-100 px-4 py-3 last:border-0 active:bg-grey-50"
        style={{ cursor: onRowClick ? 'pointer' : 'default' }}
      >
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
      </li>
    );
  });

  return (
    <div className="rounded-lg border border-grey-200">
      {/* 폰: 카드 목록 */}
      <div className="md:hidden">
        {isLoading ? (
          <p className="px-4 py-10 text-center text-sm text-grey-500">{t.common.loading}</p>
        ) : data.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-grey-500">{t.common.noData}</p>
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
              <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-grey-500">{t.common.loading}</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-grey-500">{t.common.noData}</td></tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  className="border-b border-grey-100 transition-colors hover:bg-grey-50"
                  style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="whitespace-nowrap px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-xs text-grey-500">
          {t.table.summary(total, page, lastPage)}
        </span>
        <div className="flex gap-1">
          <button
            className="btn btn-secondary btn-sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page >= lastPage}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
