// 목록 액션(상태 전이)별 아이콘 매핑 — 상품/행사패스 · 주문 공용.
import {
  Send,
  CheckCircle2,
  XCircle,
  PackageX,
  EyeOff,
  PlayCircle,
  Truck,
  Undo2,
  CheckCheck,
  type LucideIcon,
} from 'lucide-react';

// 상품/행사패스 전이 labelKey → 아이콘
export const TRANSITION_ICON: Record<string, LucideIcon> = {
  requestApproval: Send, // 승인요청
  approve: CheckCircle2, // 승인
  reject: XCircle, // 반려
  soldout: PackageX, // 품절
  inactive: EyeOff, // 비활성
  resume: PlayCircle, // 재개
};

// 주문 전이 to(status) → 아이콘
export const ORDER_TRANSITION_ICON: Record<string, LucideIcon> = {
  paid: CheckCircle2, // 결제확인
  cancelled: XCircle, // 취소
  shipped: Truck, // 발송
  refunded: Undo2, // 환불
  done: CheckCheck, // 완료
};
