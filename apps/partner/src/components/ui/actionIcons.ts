// 목록 액션(상태 전이)별 아이콘 매핑 — 오거나이저 상품/행사패스.
import { Send, Undo2, PackageX, PlayCircle, CheckCircle2, type LucideIcon } from 'lucide-react';

// 오거나이저 전이 labelKey → 아이콘
export const TRANSITION_ICON: Record<string, LucideIcon> = {
  requestApproval: Send, // 승인요청
  cancelRequest: Undo2, // 요청취소
  soldout: PackageX, // 품절
  resume: PlayCircle, // 재개
};

export const FALLBACK_TRANSITION_ICON = CheckCircle2;
