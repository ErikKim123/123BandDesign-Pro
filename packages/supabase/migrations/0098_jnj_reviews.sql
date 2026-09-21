-- 0098_jnj_reviews.sql
-- J&J 대회 후기 — 대회(에디션)의 부문 탭별 별점 후기 + 대회·부문별 후기 사용 스위치.
-- product_reviews(0022) 와 같은 규칙: 조회 공개, 작성은 로그인 사용자(부문당 1개, 재작성 = 수정),
-- 삭제는 본인 또는 관리자. 포인트 지급(0039)은 상품 후기 전용이라 여기엔 걸지 않는다.

-- 1) 후기 사용 스위치 — 대회 전체 / 부문 단위. 둘 다 켜져 있어야 그 부문에 후기 섹션이 뜬다.
alter table jnj_editions
  add column if not exists reviews_enabled boolean not null default true;
alter table jnj_divisions
  add column if not exists reviews_enabled boolean not null default true;

-- 2) 후기 테이블. division = 부문 코드(jnj_divisions.code), 부문이 없는 대회는 '' (대회 공통).
create table if not exists jnj_reviews (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references jnj_editions(id) on delete cascade,
  division text not null default '',
  author_id uuid not null references profiles(id) on delete cascade,
  author_name text,
  rating int not null check (rating between 1 and 5),
  content text not null check (char_length(content) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_id, division, author_id)
);

create index if not exists jnj_reviews_target_idx
  on jnj_reviews (edition_id, division, created_at desc);

-- 3) RLS
alter table jnj_reviews enable row level security;

drop policy if exists jnj_reviews_select on jnj_reviews;
create policy jnj_reviews_select on jnj_reviews
  for select using (true);

-- 본인 명의 + 후기를 켜 둔 대회에만 작성(부문 스위치는 API 가 한 번 더 본다)
drop policy if exists jnj_reviews_insert on jnj_reviews;
create policy jnj_reviews_insert on jnj_reviews
  for insert with check (
    auth.uid() = author_id
    and exists (
      select 1 from jnj_editions e
      where e.id = edition_id and e.is_active and e.reviews_enabled
    )
  );

drop policy if exists jnj_reviews_update on jnj_reviews;
create policy jnj_reviews_update on jnj_reviews
  for update using (auth.uid() = author_id) with check (auth.uid() = author_id);

drop policy if exists jnj_reviews_delete on jnj_reviews;
create policy jnj_reviews_delete on jnj_reviews
  for delete using (
    auth.uid() = author_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists jnj_reviews_admin_all on jnj_reviews;
create policy jnj_reviews_admin_all on jnj_reviews
  for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
