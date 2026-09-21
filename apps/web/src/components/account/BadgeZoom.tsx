// 뱃지 확대 보기 — 목록의 뱃지를 누르면 원본 크기로 띄운다.
//
// 뱃지는 잘 만든 그림이라 목록의 작은 칸으로는 디테일이 안 보인다. 특히 잠긴 뱃지는
// 64px 흑백이라 무엇을 노리는 건지조차 알기 어렵다. 누르면 크게 보게 한다.
//
// 목록 자체는 서버 컴포넌트다 — 이 파일만 클라이언트로 떼어 이미지를 감싼다.
'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { storageThumb } from '@/lib/image';

export function BadgeZoom({
  imageUrl,
  name,
  description,
  earnedText,
  closeLabel,
  /** 목록에 이미 그려 둔 뱃지(잠긴 뱃지는 흑백 처리 등 모양이 다르다) */
  children,
}: {
  imageUrl: string | null;
  name: string;
  description?: string | null;
  earnedText?: string | null;
  closeLabel: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    // 뒤 배경이 같이 스크롤되면 확대해 놓고도 목록이 움직인다.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // 이미지가 없는 뱃지(기본 아이콘)는 확대해도 보여 줄 게 없다 — 누르는 시늉을 하지 않는다.
  if (!imageUrl) return <>{children}</>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={name}
        className="block w-full cursor-zoom-in rounded-lg transition-transform hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {children}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={name}
        >
          {/* 배경을 눌러도 닫힌다 — 확대해서 보고 나면 아무 데나 누르는 게 자연스럽다 */}
          <button
            type="button"
            aria-label={closeLabel}
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-zoom-out bg-ink/70 backdrop-blur-sm"
          />
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-sm flex-col items-center overflow-y-auto rounded-2xl bg-white p-6 text-center shadow-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={closeLabel}
              className="absolute right-3 top-3 rounded-full p-1.5 text-grey-500 transition-colors hover:bg-grey-100 hover:text-ink"
            >
              <X size={18} />
            </button>
            {/* 원본 배경이 투명한 정사각 PNG 기준 — 잘리지 않게 contain */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={storageThumb(imageUrl, 1024)}
              alt={name}
              className="h-auto w-full max-w-[20rem] object-contain"
            />
            <p className="mt-4 text-xl font-semibold">{name}</p>
            {description && <p className="mt-1 text-sm text-grey-600">{description}</p>}
            {earnedText && <p className="mt-1 text-sm text-grey-500">{earnedText}</p>}
          </div>
        </div>
      )}
    </>
  );
}
