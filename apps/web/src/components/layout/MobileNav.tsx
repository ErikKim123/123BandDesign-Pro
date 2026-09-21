// 모바일 네비 — 햄버거 버튼 + 좌측 슬라이드 드로어. (데스크톱은 md:hidden 으로 숨김)
// 드로어/백드롭은 document.body 로 포털 → 헤더의 backdrop-blur(containing block) 밖에서
// 뷰포트 기준 fixed 로 전체를 덮는다(안 그러면 헤더 높이에 갇혀 뒤가 비침).
'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import type { NavItem } from './Header';
import { AddToHomeScreen, type A2hsLabels } from '@/components/pwa/AddToHomeScreen';

export function MobileNav({
  nav,
  label,
  closeLabel,
  a2hsLabels,
}: {
  nav: NavItem[];
  label: string;
  closeLabel: string;
  a2hsLabels: A2hsLabels;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // 열려 있는 동안 바디 스크롤 잠금 + ESC 로 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        aria-expanded={open}
        className="-ml-1 p-1 text-grey-800 transition-colors hover:text-primary md:hidden"
      >
        <Menu size={22} />
      </button>

      {mounted &&
        createPortal(
          <div className="md:hidden">
            {/* 백드롭 */}
            <div
              aria-hidden
              onClick={() => setOpen(false)}
              className={`fixed inset-0 z-[60] bg-black/50 transition-opacity duration-200 ${
                open ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            />

            {/* 드로어 (좌측에서 슬라이드) */}
            <div
              role="dialog"
              aria-modal="true"
              className={`fixed inset-y-0 left-0 z-[70] flex w-72 max-w-[82%] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${
                open ? 'translate-x-0' : '-translate-x-full'
              }`}
            >
              <div className="flex h-16 items-center justify-between border-b border-grey-100 px-5">
                <span className="font-display text-xl font-extrabold uppercase tracking-tight text-ink">
                  123Band
                </span>
                <div className="flex items-center gap-2">
                  {/* 홈 화면에 추가 — 아이콘만, 닫기 버튼 옆 */}
                  <AddToHomeScreen
                    labels={a2hsLabels}
                    variant="icon"
                    mode="install"
                    onActivate={() => setOpen(false)}
                  />
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label={closeLabel}
                    className="-mr-1 p-1 text-grey-500 transition-colors hover:text-ink"
                  >
                    <X size={22} />
                  </button>
                </div>
              </div>
              <nav className="flex flex-col gap-0.5 p-3">
                {nav.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-4 py-3 text-base font-medium text-grey-800 transition-colors hover:bg-grey-50 hover:text-primary"
                  >
                    {n.label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
