-- Design Ref: §3.3 — 인덱스 + updated_at 트리거
-- Plan NFR: 상품 목록 쿼리 성능, 정산 집계(seller_id) 성능

-- ── 인덱스 ───────────────────────────────────────────────────
create index if not exists idx_products_seller   on products(seller_id);
create index if not exists idx_products_category  on products(category_id);
create index if not exists idx_products_status    on products(status);
create index if not exists idx_order_items_seller on order_items(seller_id);  -- 파트너 정산 집계
create index if not exists idx_order_items_order  on order_items(order_id);
create index if not exists idx_orders_buyer       on orders(buyer_id);
create index if not exists idx_shipments_order    on shipments(order_id);
create index if not exists idx_subscriptions_user on subscriptions(user_id);
create index if not exists idx_categories_parent  on categories(parent_id);

-- ── updated_at 자동 갱신 트리거 ──────────────────────────────
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_updated on profiles;
create trigger trg_profiles_updated
  before update on profiles for each row execute function set_updated_at();

drop trigger if exists trg_partners_updated on partners;
create trigger trg_partners_updated
  before update on partners for each row execute function set_updated_at();

drop trigger if exists trg_products_updated on products;
create trigger trg_products_updated
  before update on products for each row execute function set_updated_at();

drop trigger if exists trg_orders_updated on orders;
create trigger trg_orders_updated
  before update on orders for each row execute function set_updated_at();
