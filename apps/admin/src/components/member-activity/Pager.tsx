// 회원활동 화면 공용 페이저 — DataTable 의 페이지네이션과 같은 모양/문구를 쓴다.
// (DataTable 은 표 전용이라 카드 그리드·타임라인에서는 재사용할 수 없다.)
'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fmt } from '@/i18n/dict';
import { useT } from '@/lib/locale/LocaleContext';

export function Pager({
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
    <div className="flex items-center justify-between py-3">
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
