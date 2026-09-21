-- Design Ref: §3.2 상품 상태 전이 — '비활성(inactive)' 상태 추가
-- 품절/판매 종료와 별개로, 노출에서 완전히 내리는 상태(공개 읽기 RLS 는 active 만 노출하므로 자동 숨김).
-- idempotent: 기존 CHECK 제약 drop 후 재생성.
alter table products drop constraint if exists products_status_check;
alter table products add constraint products_status_check
  check (status in ('draft','pending','active','soldout','inactive'));
