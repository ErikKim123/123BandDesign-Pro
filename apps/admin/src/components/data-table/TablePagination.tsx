// Design Ref: §5.3 — 목록 하단 페이지네이션. 표(DataTable)와 카드 그리드(DataGrid)가 같이 쓴다.
'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fmt } from '@/i18n/dict';
import { useT } from '@/lib/locale/LocaleContext';

export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const t = useT();
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-xs text-grey-500">
        {fmt(t.table.total, { n: total })} · {page}/{lastPage}
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
  );
}
