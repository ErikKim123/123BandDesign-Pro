-- 0022_product_reviews.sql
-- 상품별 별점 후기(product_reviews) + 상품에 후기 게시판 사용 여부(reviews_enabled).
-- 조회는 공개, 작성은 로그인 사용자(본인 1개), 삭제는 본인 또는 관리자(모더레이션).

-- 1) 상품별 후기 사용 여부 (오거나이저가 상세페이지 생성 시 설정)
alter table products
  add column if not exists reviews_enabled boolean not null default true;

-- 2) 후기 테이블
create table if not exists product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  author_name text,                      -- 표시용 이름 비정규화(프로필 RLS 우회, 조회 단순화)
  rating int not null check (rating between 1 and 5),
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, author_id)         -- 사용자당 상품 1개(재작성 = 수정)
);

create index if not exists product_reviews_product_idx
  on product_reviews (product_id, created_at desc);

-- 3) RLS
alter table product_reviews enable row level security;

-- 공개 조회 (고객·오거나이저·관리자 모두 열람)
drop policy if exists product_reviews_select on product_reviews;
create policy product_reviews_select on product_reviews
  for select using (true);

-- 로그인 사용자가 본인 명의로만 작성
drop policy if exists product_reviews_insert on product_reviews;
create policy product_reviews_insert on product_reviews
  for insert with check (auth.uid() = author_id);

-- 본인 글 수정
drop policy if exists product_reviews_update on product_reviews;
create policy product_reviews_update on product_reviews
  for update using (auth.uid() = author_id) with check (auth.uid() = author_id);

-- 삭제: 본인 또는 관리자(모더레이션)
drop policy if exists product_reviews_delete on product_reviews;
create policy product_reviews_delete on product_reviews
  for delete using (
    auth.uid() = author_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- 관리자 전체 접근(모더레이션 목록/수정 등)
drop policy if exists product_reviews_admin_all on product_reviews;
create policy product_reviews_admin_all on product_reviews
  for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
