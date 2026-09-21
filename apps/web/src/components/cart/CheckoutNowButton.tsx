// 결제하기(바로 구매) 버튼 — 장바구니에 담고 체크아웃으로 이동. 비로그인이면 로그인 유도.
'use client';
import { usePathname, useRouter } from 'next/navigation';
import { CreditCard } from 'lucide-react';
import { useCart, type CartItem } from '@/lib/cart/CartContext';

export function CheckoutNowButton({
  item,
  label,
  disabled,
}: {
  item: Omit<CartItem, 'qty'>;
  label: string;
  disabled?: boolean;
}) {
  const { add, authed } = useCart();
  const router = useRouter();
  const pathname = usePathname();

  function onClick() {
    const seg = pathname.split('/').filter(Boolean); // [locale, ...rest]
    const locale = seg[0] || 'en';
    // 로그인 전용 장바구니/결제 — 비로그인이면 로그인 후 원래 위치 복귀
    if (authed === false) {
      const next = seg.slice(1).join('/');
      router.push(`/${locale}/login${next ? `?next=${encodeURIComponent(next)}` : ''}`);
      return;
    }
    add(item);
    router.push(`/${locale}/checkout`);
  }

  return (
    <button
      type="button"
      className="btn btn-secondary mt-2 w-full"
      onClick={onClick}
      disabled={disabled}
    >
      <CreditCard size={16} /> {label}
    </button>
  );
}
