-- 0000: 123Band 전용 스키마.
--
-- 123Band 는 울프·JNJ(public)·BATTLE(battle)·DIV(div)·AI심사(ai_judge) 와 같은 Supabase 프로젝트를 쓴다.
-- 123Band 의 테이블·함수·타입은 전부 band123 스키마에만 둔다 — 나중에 별도 프로젝트로 옮길 때
-- 이 스키마만 통째로 덤프하면 되도록.
--
-- 권한은 Supabase 가 public 에 주는 기본값과 같게 맞춘다(행 단위 접근은 RLS 가 막는다).
-- API 로 쓰려면 대시보드 > Settings > API > Exposed schemas 에 band123 을 추가해야 한다.

create schema if not exists band123;

grant usage on schema band123 to anon, authenticated, service_role;

alter default privileges in schema band123 grant all on tables to anon, authenticated, service_role;
alter default privileges in schema band123 grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema band123 grant all on functions to anon, authenticated, service_role;
