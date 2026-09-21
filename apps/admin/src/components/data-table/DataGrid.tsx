// Design Ref: §5.3 — 목록의 카드(그리드) 보기. 표 대신 이미지가 주인공인 목록에 쓴다(업적 뱃지 등).
// 데이터·페이지네이션 규약은 DataTable 과 같고, 행 렌더링만 호출한 쪽이 정한다.
'use client';
import type { ReactNode } from 'react';
import { useT } from '@/lib/locale/LocaleContext';
import { TablePagination } from './TablePagination';

interface DataGridProps<T> {
  data: T[];
  isLoading?: boolean;
  onRowClick?: (row: T) => void;
  /** 카드 한 장 — 바깥 테두리·클릭은 여기서 감싸주므로 안쪽 내용만 그리면 된다. */
  renderCard: (row: T) => ReactNode;
  getKey: (row: T, index: number) => string;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function DataGrid<T>({
  data, isLoading, onRowClick, renderCard, getKey, page, pageSize, total, onPageChange,
}: DataGridProps<T>) {
  const t = useT();

  return (
    <div className="rounded-lg border border-grey-200">
      {isLoading ? (
        <p className="px-4 py-10 text-center text-sm text-grey-500">{t.table.loading}</p>
      ) : data.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-grey-500">{t.table.empty}</p>
      ) : (
        // 카드 폭은 뱃지가 또렷하게 보일 만큼만 — 화면이 넓어지면 열이 늘어난다.
        <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {data.map((row, i) => (
            <div
              key={getKey(row, i)}
              onClick={() => onRowClick?.(row)}
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={(e) => {
                if (!onRowClick) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onRowClick(row);
                }
              }}
              className="rounded-lg border border-grey-200 bg-white transition-colors hover:border-grey-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
              style={{ cursor: onRowClick ? 'pointer' : 'default' }}
            >
              {renderCard(row)}
            </div>
          ))}
        </div>
      )}
      <div className="border-t border-grey-100">
        <TablePagination page={page} pageSize={pageSize} total={total} onPageChange={onPageChange} />
      </div>
    </div>
  );
}
