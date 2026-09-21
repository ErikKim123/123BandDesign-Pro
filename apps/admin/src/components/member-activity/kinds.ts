// 회원활동 — 활동 종류 표기(라벨/아이콘). 필터 칩과 피드가 같은 정의를 쓴다.
// 백오피스는 모노크롬이라 색으로 구분하지 않는다 → 아이콘 + 라벨이 유일한 구분자다.
// 라벨은 한국어 원문(msgid)이고 화면에서 tr() 로 번역한다.
import {
  Coins,
  Stamp,
  Heart,
  Send,
  ShoppingCart,
  Star,
  HelpCircle,
  MessageSquare,
  Award,
  Ticket,
  UserPlus,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { reasonLabel } from '@/lib/resource/configs/point-ledger';
import { stampReasonLabel } from '@/lib/resource/configs/stamp-ledger';
import type { ActivityFeedRow, ActivityKind } from '@/lib/queries/member-activity';

export const KIND_META: Record<ActivityKind, { label: string; icon: LucideIcon }> = {
  point: { label: '포인트', icon: Coins },
  stamp: { label: '스탬프', icon: Stamp },
  heart_in: { label: '하트 받음', icon: Heart },
  heart_out: { label: '하트 보냄', icon: Send },
  order: { label: '주문', icon: ShoppingCart },
  review: { label: '후기', icon: Star },
  qna: { label: '상품문의', icon: HelpCircle },
  board: { label: '게시글', icon: MessageSquare },
  achievement: { label: '업적', icon: Award },
  coupon: { label: '쿠폰', icon: Ticket },
  referral: { label: '친구 추천', icon: UserPlus },
  signup: { label: '가입', icon: Sparkles },
};

// 소셜 반응 5종 — web 의 REACTION_EMOJI · 소셜관리 목록과 같은 표기를 쓴다.
const HEART_KIND_LABEL: Record<string, string> = {
  heart: '❤️ 고마워요',
  thumbs: '👍 최고예요',
  dance: '💃 춤 최고',
  fire: '🔥 에너지',
  clap: '👏 멋져요',
};

// 주문관리 목록(orders.ts STATUS_OPTS)과 같은 라벨 — 화면마다 다른 말이 나오지 않게.
const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: '결제대기',
  awaiting_payment: '입금확인대기',
  paid: '결제완료',
  shipped: '발송',
  done: '완료',
  cancelled: '취소',
  refunded: '환불',
};

const BOARD_TYPE_LABEL: Record<string, string> = {
  notice: '공지',
  qna: '문의',
  review: '후기',
  faq: 'FAQ',
};

const COUPON_SOURCE_LABEL: Record<string, string> = {
  point_exchange: '포인트 교환',
  stamp_reward: '스탬프 카드 완성',
  admin_grant: '관리자 지급',
};

/**
 * 활동 한 줄의 '구분' 문구 — 종류마다 의미가 다른 reason 컬럼을 사람 말로 바꾼다.
 * 사전에 없는 값은 원문 그대로 나온다(깨지지 않는다).
 */
export function kindDetail(row: ActivityFeedRow): string {
  const raw = row.reason ?? '';
  switch (row.kind) {
    case 'point':
      return reasonLabel(raw);
    case 'stamp':
      return stampReasonLabel(raw);
    case 'heart_in':
    case 'heart_out':
      return HEART_KIND_LABEL[raw] ?? raw;
    case 'order':
      return ORDER_STATUS_LABEL[raw] ?? raw;
    case 'qna':
      return raw === 'answered' ? '답변 완료' : '답변 대기';
    case 'board':
      return BOARD_TYPE_LABEL[raw] ?? raw;
    case 'coupon':
      return COUPON_SOURCE_LABEL[raw] ?? raw;
    case 'review':
      return row.rating ? `${'★'.repeat(row.rating)}${'☆'.repeat(Math.max(0, 5 - row.rating))}` : '';
    case 'referral':
      return '친구가 내 QR로 가입';
    case 'signup':
      return '회원가입';
    default:
      return raw;
  }
}
