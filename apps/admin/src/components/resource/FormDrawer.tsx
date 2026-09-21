// Design Ref: §5.1 — 폼 모달 (화면 가운데). 반응형: 모바일 전체폭, PC 중앙 카드.
'use client';
import { X } from 'lucide-react';

// 모달 폭 — 일반 폼은 default, 단계형 마법사(행사패스 등)는 wide,
// 원문·번역을 좌우로 길게 쓰는 폼(게시판 등)은 full(화면 거의 전체).
const SIZE_CLASS = {
  default: 'max-w-2xl',
  wide: 'max-w-5xl',
  full: 'max-w-[1800px]',
} as const;

export function FormDrawer({
  open, title, onClose, children, size = 'default', headerRight,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'default' | 'wide' | 'full';
  headerRight?: React.ReactNode; // 헤더 우측(닫기 왼쪽) 슬롯 — 입력 언어 토글 등
}) {
  if (!open) return null;
  return (
    // 폰에서는 여백 없이 화면을 다 쓴다 — 좁은 카드 안에서 긴 폼을 스크롤하면 어디까지 왔는지 모른다.
    // 제목 줄은 위에 붙여 두어 스크롤해도 닫기 버튼이 손에 닿게 한다.
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-0 md:p-4">
      {/* 바깥(백드롭) 클릭으로는 닫지 않음 — X 버튼/취소로만 닫기 (입력 중 실수 방지) */}
      <div
        className={`min-h-full w-full ${SIZE_CLASS[size]} bg-white p-4 pb-8 shadow-xl md:min-h-0 md:rounded-xl ${
          size === 'full' ? 'md:my-4 md:p-8' : 'md:my-8 md:p-6'
        }`}
      >
        <div className="sticky -top-4 z-10 -mx-4 mb-5 flex items-center justify-between border-b border-grey-100 bg-white px-4 py-3 md:static md:mx-0 md:border-0 md:px-0 md:py-0">
          <h2 className="text-xl uppercase tracking-tight">{title}</h2>
          <div className="flex items-center gap-3">
            {headerRight}
            <button onClick={onClose} aria-label="닫기" className="-m-2 p-2"><X size={22} /></button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
