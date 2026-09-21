-- Design Ref: §3.3 — Phase 0 핵심 테이블 (Option C Pragmatic)
-- Plan SC: 멀티-셀러/멀티-타입/멀티-통화/멀티-언어를 처음부터 견디는 스키마
-- idempotent: create table if not exists + drop/create 가능한 형태
-- 적재 순서 의존성: profiles → categories → products → orders → ...

-- 1) profiles (auth.users 확장)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'customer' check (role in ('customer','partner','admin')),
  name text,
  phone text,
  locale text not null default 'en' check (locale in ('en','ko','ja','zh-TW')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) partners (role='partner' 부가정보 — 정합성 중요 → 정규화)
create table if not exists partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references profiles(id) on delete cascade,
  company_name text,
  biz_no text,
  commission_rate numeric(5,4) not null default 0.10
    check (commission_rate >= 0 and commission_rate <= 1),
  settlement_info jsonb,
  status text not null default 'pending' check (status in ('pending','active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) categories (대/중 분류 자기참조)
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  parent_id uuid references categories(id) on delete set null,
  name_i18n jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  is_visible boolean not null default true
);

-- 4) products (실물/티켓/구독 통합 + 다국어 + 다통화)
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  seller_id uuid not null references profiles(id),
  is_partner_product boolean not null default false,
  product_type text not null default 'physical'
    check (product_type in ('physical','ticket','subscription')),
  category_id uuid references categories(id) on delete set null,
  name_i18n jsonb not null default '{}'::jsonb,
  detail_html_i18n jsonb not null default '{}'::jsonb,
  prices jsonb not null default '{}'::jsonb,        -- {"USD":1990,"KRW":2900000}
  attributes jsonb not null default '{}'::jsonb,    -- 타입별 가변 속성
  external_ref jsonb,                                -- 123Pass 연동 대비 자리
  ai_generated boolean not null default false,
  status text not null default 'draft'
    check (status in ('draft','pending','active','soldout')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5) orders / order_items (정산 정합성 → 정규화)
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_no text unique not null,
  buyer_id uuid not null references profiles(id),
  status text not null default 'pending'
    check (status in ('pending','paid','shipped','done','cancelled','refunded')),
  total_amount int not null default 0,
  currency text not null default 'USD' check (currency in ('USD','KRW')),
  payment_method text check (payment_method in ('stripe','portone')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id),
  seller_id uuid not null references profiles(id),  -- 정산용(누가 판 상품인지)
  qty int not null check (qty > 0),
  unit_price int not null,
  line_amount int not null,
  currency text not null default 'USD' check (currency in ('USD','KRW'))
);

-- 6) shipments (국내/해외 분기)
create table if not exists shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  region text not null default 'domestic' check (region in ('domestic','overseas')),
  carrier text,
  tracking_no text,
  status text not null default 'preparing' check (status in ('preparing','shipped','delivered')),
  shipped_at date,
  eta date,
  cost int not null default 0
);

-- 7) subscriptions (JNJ/DIV 반복결제 → 정규화)
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  plan text not null,                                -- 'JNJ' | 'DIV' (+tier)
  status text not null default 'active' check (status in ('active','paused','cancelled')),
  period_start date,
  period_end date,
  price int,
  currency text not null default 'USD' check (currency in ('USD','KRW'))
);

-- 8) 독립 관리 테이블
create table if not exists banners (
  id uuid primary key default gen_random_uuid(),
  position text,
  title_i18n jsonb not null default '{}'::jsonb,
  image_url text,
  link_url text,
  sort_order int not null default 0,
  start_at date,
  end_at date,
  is_active boolean not null default true
);

create table if not exists boards (
  id uuid primary key default gen_random_uuid(),
  board_type text check (board_type in ('notice','qna','review','faq')),
  title text,
  content text,
  author_id uuid references profiles(id),
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists main_sections (
  id uuid primary key default gen_random_uuid(),
  section_type text check (section_type in ('hero','slider','featured','category_strip')),
  config jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table if not exists ai_product_jobs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  input jsonb,
  generated_html text,
  status text not null default 'done',
  created_at timestamptz not null default now()
);
