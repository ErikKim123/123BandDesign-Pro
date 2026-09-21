// 123Band 는 울프·JNJ 와 같은 Supabase 프로젝트를 쓴다. 데이터는 band123 스키마에만 두고,
// 로그인 계정(auth.users)은 공유하되 app_metadata.services 태그로 123Band 회원을 가려낸다.
// (DB 쪽: migrations/0000_band123_schema.sql · 0123_band123_membership.sql)

/** 123Band 테이블이 있는 Postgres 스키마 — 모든 Supabase 클라이언트의 db.schema. */
export const DB_SCHEMA = 'band123';

/** 가입 시 user_metadata.service 로 넘기는 값. DB 트리거가 이 값을 보고 태그·프로필을 만든다. */
export const SERVICE_TAG = 'band123';

/** 이 계정이 123Band 회원인가 — 울프·JNJ 회원은 같은 계정 풀에 있어도 false. */
export function isBand123Member(user: { app_metadata?: Record<string, unknown> } | null | undefined): boolean {
  const services = user?.app_metadata?.services;
  return Array.isArray(services) && services.includes(SERVICE_TAG);
}

/** 스키마와 무관하게 Supabase 클라이언트를 받는 함수의 인자 타입 — band123 클라이언트도 받는다. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbClient = import('@supabase/supabase-js').SupabaseClient<any, any, any>;
