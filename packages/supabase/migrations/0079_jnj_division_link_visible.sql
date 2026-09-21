-- 0079: 참가 신청 · 관객투표 섹션 노출 스위치.
-- 링크(0077 · 0078)를 지우지 않고도 섹션을 켜고 끌 수 있게 한다. 운영자가 주소를 미리 넣어 두고
-- 접수 시작에 맞춰 켜거나, 잠깐 내렸다가 다시 올리는 일이 링크를 지웠다 다시 붙이는 일이 되면 안 된다.
-- 링크가 비어 있으면 켜져 있어도 섹션은 안 뜬다 — 스위치는 '보일 수 있는 것을 보일지'만 정한다.
-- 기본 true: 이미 링크를 넣어 둔 부문은 지금 보이는 그대로 유지된다.
-- idempotent.

alter table jnj_divisions
  add column if not exists signup_visible boolean not null default true,
  add column if not exists vote_visible boolean not null default true;

comment on column jnj_divisions.signup_visible is
  '참가 신청 섹션 노출 스위치. 끄면 signup_url 이 있어도 고객몰에 안 뜬다.';
comment on column jnj_divisions.vote_visible is
  '관객투표 섹션 노출 스위치. 끄면 vote_url 이 있어도 고객몰에 안 뜬다.';
