-- Design Ref: 설명.txt 쿠폰관리 — 할인 쿠폰 테이블 + RLS
-- ⚠️ SQL Editor 에서 0001~0003 적용 후 실행. is_admin() 은 0003 에 정의됨.

create table if not exists coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  discount_type text not null default 'percent'
    check (discount_type in ('percent', 'fixed')),
  -- percent: 0~100 (%) · fixed: 통화 최소단위 정수 (예: USD 1000 = $10.00)
  discount_value int not null default 0,
  -- 최소 주문 금액(최소단위). 0 = 제한 없음
  min_amount int not null default 0,
  currency text not null default 'USD' check (currency in ('USD', 'KRW')),
  starts_at date,
  ends_at date,
  -- 총 사용 가능 횟수 (null = 무제한)
  usage_limit int,
  used_count int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_coupons_code on coupons (code);

alter table coupons enable row level security;

-- 공개 읽기: 고객이 체크아웃에서 코드 유효성 검증
drop policy if exists "coupons_public_read" on coupons;
create policy "coupons_public_read" on coupons
  for select using (true);

-- 쓰기: admin 전용
drop policy if exists "coupons_admin_write" on coupons;
create policy "coupons_admin_write" on coupons
  for all using (is_admin()) with check (is_admin());
