// Design Ref: §5 Phase 4 — 장바구니 담기 버튼 (클라이언트, 피드백 표시)
'use client';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ShoppingBag, Check } from 'lucide-react';
import { useCart, type CartItem } from '@/lib/cart/CartContext';

export function AddToCartButton({
  item,
  label,
  addedLabel,
  disabled,
}: {
  item: Omit<CartItem, 'qty'>;
  label: string;
  addedLabel: string;
  disabled?: boolean;
}) {
  const { add, authed } = useCart();
  const router = useRouter();
  const pathname = usePathname();
  const [added, setAdded] = useState(false);

  function onClick() {
    // 로그인 전용 장바구니 — 비로그인이면 로그인 페이지로 유도(로그인 후 원래 위치 복귀)
    if (authed === false) {
      const seg = pathname.split('/').filter(Boolean); // [locale, ...rest]
      const locale = seg[0] || 'en';
      const next = seg.slice(1).join('/');
      router.push(`/${locale}/login${next ? `?next=${encodeURIComponent(next)}` : ''}`);
      return;
    }
    add(item);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <button type="button" className="btn btn-primary mt-2 w-full" onClick={onClick} disabled={disabled}>
      {added ? (
        <>
          <Check size={16} /> {addedLabel}
        </>
      ) : (
        <>
          <ShoppingBag size={16} /> {label}
        </>
      )}
    </button>
  );
}
