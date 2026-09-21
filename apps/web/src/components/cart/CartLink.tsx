// Design Ref: §5 Phase 4 — 헤더 장바구니 링크 (담긴 수량 배지 + 담기 애니메이션)
'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '@/lib/cart/CartContext';

export function CartLink({ locale }: { locale: string }) {
  const { count } = useCart();
  // 담을 때마다 증가시켜 key 로 사용 → 매 담기마다 애니메이션을 다시 재생(연속 담기 대응).
  const [bump, setBump] = useState(0);
  const prevCount = useRef(count);

  // 담긴 수량이 늘어나면(=상품 담기) 아이콘을 한 번 튕긴다.
  useEffect(() => {
    if (count > prevCount.current) setBump((b) => b + 1);
    prevCount.current = count;
  }, [count]);

  const filled = count > 0;
  return (
    <Link
      href={`/${locale}/cart`}
      className="relative inline-flex items-center justify-center"
      aria-label="Cart"
    >
      {/* 원형 배경 칩 — 담기면 오렌지 원+흰 아이콘, 비면 연회색 테두리 원+회색 아이콘 */}
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-200 ${
          filled
            ? 'bg-primary text-white shadow-1 hover:bg-primary-deep'
            : 'border border-grey-300 text-grey-400 hover:border-grey-400 hover:text-grey-500'
        }`}
      >
        {/* key 를 바꿔 remount → 담기 애니메이션 재생. bump>0 일 때만 애니메이션 클래스 적용. */}
        <ShoppingBag
          key={bump}
          size={18}
          className={bump > 0 ? 'cart-bounce' : undefined}
        />
      </span>
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-pill bg-black px-1 text-[10px] font-medium text-white ring-2 ring-white">
          {count}
        </span>
      )}
    </Link>
  );
}
