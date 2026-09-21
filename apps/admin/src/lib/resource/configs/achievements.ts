// Design Ref: 업적관리 — achievements CRUD. 임무(조건) 달성 시 뱃지 + (선택) 포인트 지급.
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import type { ResourceConfig } from '@/lib/resource/types';
import { StatusBadge } from '@/components/form/StatusBadge';
import { tr } from '@/i18n/tr';

export interface AchievementRow {
  id: string;
  code: string;
  name_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  badge_image_url: string | null;
  conditions: { type: string; count?: number }[];
  point_reward: number;
  is_active: boolean;
  sort_order: number;
  /** 업적 묶음(0101) — 배지 페이지가 이 단위로 묶어 보여 준다. */
  track: string | null;
  /** 행사 전용 업적이면 그 행사(패스 상품) id(0103). null = 모든 행사 공통. */
  product_id: string | null;
}

/** 트랙 — 기획서(온라인/오프라인 업적 종류)의 묶음 그대로. 순서가 곧 노출 순서 단위(×100)다. */
export const TRACK_OPTS = [
  { value: 'onboarding', label: '온라인 · 시작하기' },
  { value: 'purchaser', label: '온라인 · 구매' },
  { value: 'critic', label: '온라인 · 리뷰' },
  { value: 'den', label: '온라인 · 아지트' },
  { value: 'hustler', label: '온라인 · 홍보·추천' },
  { value: 'explorer', label: '온라인 · 여행' },
  { value: 'diehard', label: '온라인 · 꾸준함' },
  { value: 'logistics', label: '현장 · 운영' },
  { value: 'party', label: '현장 · 소셜' },
  { value: 'grind', label: '현장 · 워크숍' },
  { value: 'arena', label: '현장 · 대회·커뮤니티' },
];

export function trackLabel(track: string | null | undefined): string {
  const hit = TRACK_OPTS.find((t) => t.value === track);
  return hit ? tr(hit.label) : tr('트랙 미지정');
}

// 조건 타입 → 한국어 요약 (목록 컬럼용). 편집기는 AchievementConditions 컴포넌트.
const COND_LABEL: Record<string, string> = {
  newsletter_subscribed: '뉴스레터 구독',
  ticket_purchase: '패스 구매',
  order_count: '주문',
  review_count: '후기',
  qna_count: '문의',
  point_total: '보유 포인트',
  audience_judge_count: '관객 심사위원',
  profile_complete: '프로필 완성',
  ticket_order_count: '패스 주문',
  ticket_country_count: '방문 국가',
  early_bird_purchase: '얼리버드 구매',
  referral_signup_count: '추천 가입(프로필 완성)',
  referral_purchase_count: '추천 구매',
  ticket_checkin_count: '입장 체크인',
  feedback_submitted: '피드백 설문',
  manual: '운영진 수동 지급',
  station_scan: '현장 QR 스캔',
};

// 라벨 하나하나를 번역한다 — '주문 3+' 처럼 조립된 문장은 카탈로그에 통째로 담을 수 없다.
export function conditionsSummary(conds: AchievementRow['conditions']): string {
  if (!Array.isArray(conds) || conds.length === 0) return tr('조건 없음');
  return conds
    .map((c) => {
      const label = COND_LABEL[c.type] ? tr(COND_LABEL[c.type]) : c.type;
      return c.count != null ? `${label} ${c.count}+` : label;
    })
    .join(' + ');
}

const columns: ColumnDef<AchievementRow, unknown>[] = [
  { accessorKey: 'sort_order', header: '순서' },
  { id: 'track', header: '트랙', cell: (c) => trackLabel(c.row.original.track) },
  { id: 'name', header: '업적', cell: (c) => c.row.original.name_i18n?.ko || c.row.original.code },
  { id: 'conditions', header: '달성 조건', cell: (c) => conditionsSummary(c.row.original.conditions) },
  {
    id: 'badge',
    header: '뱃지',
    cell: (c) => (c.row.original.badge_image_url ? '등록됨' : '미등록'),
  },
  {
    accessorKey: 'point_reward',
    header: '보상 포인트',
    cell: (c) => (Number(c.getValue() ?? 0) > 0 ? `${Number(c.getValue()).toLocaleString()} P` : '—'),
  },
  {
    accessorKey: 'is_active',
    header: '상태',
    cell: (c) => StatusBadge({ status: c.getValue() ? '활성' : '비활성' }),
  },
];

export const achievementsConfig: ResourceConfig<AchievementRow> = {
  key: 'achievements',
  table: 'achievements',
  title: '업적 목록',
  canCreate: true,
  selectColumns:
    'id, code, name_i18n, description_i18n, badge_image_url, conditions, point_reward, is_active, sort_order, track, product_id',
  defaultSort: { column: 'sort_order', asc: true },
  listColumns: columns,
  filters: [
    { name: 'q', label: '코드 검색', kind: 'search', searchColumns: ['code'] },
    { name: 'track', label: '트랙', kind: 'select', options: TRACK_OPTS },
  ],
  formFields: [
    { name: 'code', label: '업적 코드 (영문/숫자, 저장 후 변경 금지)', kind: 'text', required: true, placeholder: 'first_purchase' },
    { name: 'name_i18n', label: '업적 이름 (고객 노출)', kind: 'i18n', required: true },
    { name: 'description_i18n', label: '달성 조건 설명 (고객 노출)', kind: 'i18n-multiline' },
    { name: 'track', label: '트랙 (배지 페이지 묶음)', kind: 'select', options: TRACK_OPTS },
    { name: 'product_id', label: '적용 행사', kind: 'custom' }, // EventScopeField — 비우면 공통
    { name: 'badge_image_url', label: '뱃지 이미지', kind: 'custom' }, // BadgeImageField
    { name: 'conditions', label: '달성 조건', kind: 'custom' }, // AchievementConditions
    { name: 'point_reward', label: '달성 보상 포인트 (0 = 없음)', kind: 'number' },
    { name: 'sort_order', label: '노출 순서 (작을수록 먼저)', kind: 'number' },
    { name: 'is_active', label: '활성', kind: 'toggle' },
  ],
  schema: z
    .object({
      code: z
        .string()
        .min(1, '코드를 입력해 주세요.')
        .regex(/^[a-z0-9_]+$/, '영문 소문자·숫자·밑줄(_)만 사용할 수 있습니다.')
        .optional(),
      point_reward: z.number().int('정수').nonnegative('0 이상').optional(),
      sort_order: z.number().int('정수').optional(),
    })
    .passthrough(),
};
