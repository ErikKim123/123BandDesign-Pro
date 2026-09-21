// 주최자 약관의 '판'. 신청할 때 이 값을 함께 저장해 두면(partners.terms_version)
// 나중에 "이 사람은 어느 판에 동의했나"를 확인할 수 있다.
// 약관 본문(/[locale]/organizer-terms)을 고치면 이 값을 올린다 — 그래야 재동의를 받을 수 있다.
export const ORGANIZER_TERMS_VERSION = '2026-09';

/** partners.status — 신청 전(null) · 심사 중 · 승인 · 반려 · 정지 */
export type OrganizerStatus = 'pending' | 'active' | 'rejected' | 'suspended' | null;
