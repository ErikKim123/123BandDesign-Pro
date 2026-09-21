-- 파트너 가입 입력에 국가(나라) 추가 — partners.country
-- idempotent: 이미 있으면 무시
alter table partners add column if not exists country text;
