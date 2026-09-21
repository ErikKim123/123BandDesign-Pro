// Design Ref: §5 Phase 4 — 결제 완료 페이지 진입 시 장바구니 비우기 (localStorage).
'use client';
import { useEffect } from 'react';
import { useCart } from '@/lib/cart/CartContext';

export function ClearCart() {
  const { purge } = useCart();
  // 마운트 시 1회만. 하드 내비게이션 후 CartProvider 가 저장소에서 재복원하며 방금 결제한 항목을
  // 되살리지 않도록, purge 로 메모리와 저장소를 함께 비운다.
  // purge 는 멱등 — 의존성에 넣으면 루프라 의도적으로 비움.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    purge();
  }, []);
  return null;
}
