// Design Ref: §5.1 — 폼 모달 (화면 가운데). 반응형: 모바일 전체폭, PC 중앙 카드.
'use client';
import { X } from 'lucide-react';

// 폭 프리셋: 기본(폼) vs 넓게(마법사/리치 에디터 편집)
const SIZE_CLASS: Record<'default' | 'wide', string> = {
  default: 'max-w-2xl',
  wide: 'max-w-5xl',
};

export function FormDrawer({
  open, title, onClose, children, size = 'default', headerRight,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'default' | 'wide';
  headerRight?: React.ReactNode; // 헤더 우측(닫기 왼쪽) 슬롯 — 입력 언어 토글 등
}) {
  if (!open) return null;
  return (
    // 폰에서는 여백 없이 화면을 다 쓴다 — 좁은 카드 안에서 긴 폼을 스크롤하면 어디까지 왔는지 모른다.
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-0 md:p-4">
      {/* 바깥(백드롭) 클릭으로는 닫지 않음 — X/취소로만 닫기 (입력 중 실수 방지) */}
      <div className={`min-h-full w-full ${SIZE_CLASS[size]} bg-white shadow-xl md:my-8 md:min-h-0 md:rounded-xl`}>
        {/* sticky 헤더 — 길어진 마법사에서도 제목/닫기 항상 노출 */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-grey-100 bg-white/95 px-4 py-3 backdrop-blur md:rounded-t-xl md:px-6 md:py-4">
          <h2 className="text-xl uppercase tracking-tight">{title}</h2>
          <div className="flex items-center gap-3">
            {headerRight}
            <button onClick={onClose} aria-label="닫기" className="-m-2 p-2 text-grey-500 hover:text-black"><X size={22} /></button>
          </div>
        </div>
        <div className="p-4 pb-8 md:p-6">{children}</div>
      </div>
    </div>
  );
}
