-- 0077: J&J 부문별 참가 신청 링크.
-- 부문마다 신청 폼(구글폼·티켓 페이지 등)이 다르다. 링크가 있으면 고객몰 대회 개요 카드에
-- '참가 신청' 버튼이 뜨고, 없으면 버튼 자체가 안 보인다.
-- 신청은 회원만 — 버튼은 로그인 상태에서만 링크로 이어진다(화면에서 처리).
-- idempotent.

alter table jnj_divisions
  add column if not exists signup_url text;

comment on column jnj_divisions.signup_url is
  '부문 참가 신청 링크(구글폼·티켓 페이지 등). 비면 고객몰에 신청 버튼이 안 뜬다.';
