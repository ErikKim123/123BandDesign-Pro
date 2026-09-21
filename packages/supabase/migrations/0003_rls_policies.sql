-- Design Ref: §4.2 / §7 — RLS 정책 (고객/파트너/관리자 권한 경계를 DB에서 강제)
-- Plan SC: 파트너는 자기 상품/정산만, 고객은 자기 주문/구독만, 관리자는 전체
-- idempotent: drop policy if exists 후 create

-- ── 관리자 판별 헬퍼 ─────────────────────────────────────────
-- security definer: profiles 를 RLS 우회로 조회해 무한 재귀 방지
create or replace function is_admin() returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable set search_path = band123;

-- ── RLS 활성화 ───────────────────────────────────────────────
alter table profiles       enable row level security;
alter table partners        enable row level security;
alter table categories      enable row level security;
alter table products        enable row level security;
alter table orders          enable row level security;
alter table order_items     enable row level security;
alter table shipments       enable row level security;
alter table subscriptions   enable row level security;
alter table banners         enable row level security;
alter table boards          enable row level security;
alter table main_sections   enable row level security;
alter table ai_product_jobs enable row level security;

-- ── profiles: 본인 또는 admin ────────────────────────────────
drop policy if exists "profiles_self" on profiles;
create policy "profiles_self" on profiles
  for all using (id = auth.uid() or is_admin())
  with check (id = auth.uid() or is_admin());

-- ── partners: 본인(연결된 profile) 또는 admin ────────────────
drop policy if exists "partners_own" on partners;
create policy "partners_own" on partners
  for all using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());

-- ── categories: 공개 읽기(노출), 쓰기는 admin ────────────────
drop policy if exists "categories_public_read" on categories;
create policy "categories_public_read" on categories
  for select using (is_visible = true or is_admin());
drop policy if exists "categories_admin_write" on categories;
create policy "categories_admin_write" on categories
  for all using (is_admin()) with check (is_admin());

-- ── products: 공개 읽기(active) + 파트너 자기 상품(전체 CRUD) + admin ──
drop policy if exists "products_public_read" on products;
create policy "products_public_read" on products
  for select using (status = 'active' or seller_id = auth.uid() or is_admin());
drop policy if exists "products_seller_write" on products;
create policy "products_seller_write" on products
  for all using (seller_id = auth.uid() or is_admin())
  with check (seller_id = auth.uid() or is_admin());

-- ── orders: 구매자 본인 또는 admin ───────────────────────────
drop policy if exists "orders_buyer_own" on orders;
create policy "orders_buyer_own" on orders
  for all using (buyer_id = auth.uid() or is_admin())
  with check (buyer_id = auth.uid() or is_admin());

-- ── order_items: 구매자(주문 소유) · 판매자(정산 조회) · admin ──
drop policy if exists "order_items_visibility" on order_items;
create policy "order_items_visibility" on order_items
  for select using (
    seller_id = auth.uid()
    or is_admin()
    or exists (select 1 from orders o where o.id = order_id and o.buyer_id = auth.uid())
  );
-- 쓰기는 admin/서버(서버는 service_role 로 RLS 우회)
drop policy if exists "order_items_admin_write" on order_items;
create policy "order_items_admin_write" on order_items
  for all using (is_admin()) with check (is_admin());
-- 구매자: 본인 주문(order)에 속한 항목만 insert (체크아웃 시 고객 주문 생성)
drop policy if exists "order_items_buyer_insert" on order_items;
create policy "order_items_buyer_insert" on order_items
  for insert with check (
    exists (select 1 from orders o where o.id = order_id and o.buyer_id = auth.uid())
  );

-- ── shipments: 주문 소유자(구매자) · admin ───────────────────
drop policy if exists "shipments_visibility" on shipments;
create policy "shipments_visibility" on shipments
  for select using (
    is_admin()
    or exists (select 1 from orders o where o.id = order_id and o.buyer_id = auth.uid())
  );
drop policy if exists "shipments_admin_write" on shipments;
create policy "shipments_admin_write" on shipments
  for all using (is_admin()) with check (is_admin());

-- ── subscriptions: 본인 또는 admin ───────────────────────────
drop policy if exists "subs_user_own" on subscriptions;
create policy "subs_user_own" on subscriptions
  for all using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());

-- ── banners / main_sections: 공개 읽기(노출), 쓰기 admin ─────
drop policy if exists "banners_public_read" on banners;
create policy "banners_public_read" on banners
  for select using (is_active = true or is_admin());
drop policy if exists "banners_admin_write" on banners;
create policy "banners_admin_write" on banners
  for all using (is_admin()) with check (is_admin());

drop policy if exists "main_sections_public_read" on main_sections;
create policy "main_sections_public_read" on main_sections
  for select using (is_active = true or is_admin());
drop policy if exists "main_sections_admin_write" on main_sections;
create policy "main_sections_admin_write" on main_sections
  for all using (is_admin()) with check (is_admin());

-- ── boards: 공개 읽기 + 작성자 본인 쓰기 + admin ─────────────
drop policy if exists "boards_public_read" on boards;
create policy "boards_public_read" on boards
  for select using (true);
drop policy if exists "boards_author_write" on boards;
create policy "boards_author_write" on boards
  for all using (author_id = auth.uid() or is_admin())
  with check (author_id = auth.uid() or is_admin());

-- ── ai_product_jobs: 상품 판매자 또는 admin ──────────────────
drop policy if exists "ai_jobs_owner" on ai_product_jobs;
create policy "ai_jobs_owner" on ai_product_jobs
  for select using (
    is_admin()
    or exists (select 1 from products p where p.id = product_id and p.seller_id = auth.uid())
  );
drop policy if exists "ai_jobs_admin_write" on ai_product_jobs;
create policy "ai_jobs_admin_write" on ai_product_jobs
  for all using (is_admin()) with check (is_admin());
