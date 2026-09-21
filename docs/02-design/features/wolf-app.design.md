# wolf-app Design Document

> **Summary**: Phase 0 — Supabase(Postgres) 데이터 모델 + RLS + 모노레포(web/admin/api) 스캐폴딩 설계 (Option C: Pragmatic)
>
> **Project**: wolf-app
> **Version**: 0.1.0
> **Author**: bandnara123
> **Date**: 2026-06-04
> **Status**: Draft
> **Planning Doc**: [wolf-app.plan.md](../../01-plan/features/wolf-app.plan.md)

### Pipeline References (if applicable)

| Phase | Document | Status |
|-------|----------|--------|
| Phase 1 | Schema Definition | N/A (이 문서가 Phase 0 스키마 역할) |
| Phase 2 | Coding Conventions | ❌ (후속) |
| Phase 3 | Mockup | N/A (Phase 0 범위 외) |
| Phase 4 | API Spec | N/A (Supabase auto REST + NestJS는 후속 Phase) |

---

## Context Anchor

> Plan 문서에서 복사. Design→Do 핸드오프에서 전략 맥락 유지.

| Key | Value |
|-----|-------|
| **WHY** | 4가지(파트너 마켓플레이스 / 티켓 / SaaS 구독 / AI 상품페이지)가 합쳐진 플랫폼을, 다국어·다통화를 깔고도 흔들리지 않게 설계해야 한다. |
| **WHO** | 고객(일반 회원), 파트너(입점 판매자), 운영자(울프 어드민). 1차 시장은 해외(영어 우선) + 한국. |
| **RISK** | ① 결제/정산 금액·통화·환불 오류 ② AI 생성 HTML의 XSS/품질 ③ 상품 타입별 결제·배송 분기 누락 ④ 다국어 구조 뒤늦은 추가 비용. |
| **SUCCESS** | Phase 0: 스키마+RLS가 실제 Supabase에 생성되고 파트너가 자기 상품만 조회된다. 전체: 한 장바구니에서 실물+티켓+구독을 en/ko로 결제하고 파트너 정산이 자동 산출된다. |
| **SCOPE** | Phase 0(DB 설계, **이번 Design**) → 1(운영자 관리) → 2(메인) → 3(상품+AI) → 4(주문/결제/배송/구독/티켓/다국어 마감). |

---

## 1. Overview

### 1.1 Design Goals

이 문서는 **Phase 0**(DB 설계 + 모노레포 스캐폴딩)의 기술 설계다. 목표:

1. 멀티-셀러·멀티-타입(실물/티켓/구독)·멀티-통화·멀티-언어를 **처음부터 견디는** Postgres 스키마 확정
2. RLS로 고객/파트너/관리자 권한 경계를 DB 레벨에서 강제
3. apps/web·apps/admin·apps/api + packages/ 모노레포 골격과 Supabase 클라이언트 경계 정의
4. 재현 가능한(idempotent) 마이그레이션 + 시드 데이터 체계

### 1.2 Design Principles

- **Option C (Pragmatic)**: JSONB로 유연성(가격·다국어·타입속성) 확보 + 정합성 핵심(구독·정산·관계)은 정규화
- **타입을 1급 개념으로**: `product_type`으로 분기, 타입별 가변 속성은 `attributes jsonb`
- **금액은 정수 최소단위**: 통화별 `prices jsonb` (`{"USD": 1990, "KRW": 2900000}` — 센트/원 단위)
- **보이는 텍스트는 언어별로**: 콘텐츠는 `*_i18n jsonb`, UI 고정 텍스트는 next-intl(DB 아님)
- **권한은 DB에서**: 프런트 신뢰 금지, RLS로 강제, 민감 작업은 service_role(서버 전용)
- **확장 자리만 남김(YAGNI)**: 123Pass 연동은 `external_ref jsonb` 자리만, 구현은 후속

---

## 2. Architecture Options (v1.7.0)

### 2.0 Architecture Comparison

| Criteria | Option A: Minimal | Option B: Clean | Option C: Pragmatic |
|----------|:-:|:-:|:-:|
| **Approach** | 가이드 §4 그대로, 단일통화 | i18n/가격/속성 전부 정규화 | JSONB 유연 + 정합성 핵심만 정규화 |
| **Tables** | ~12 | ~18 | 12 |
| **다국어** | `*_i18n jsonb` | `translations` 테이블 | `*_i18n jsonb` |
| **다통화** | `currency` 단일 | `product_prices` 테이블 | `prices jsonb` |
| **Complexity** | Low | High | Medium |
| **Maintainability** | Medium | High | High |
| **Effort** | Low | High | Medium |
| **Risk** | 다통화 확장 시 재설계 | 초기 과설계 | 균형 |
| **Recommendation** | 빠른 PoC | 대규모 장기 | **선택됨** |

**Selected**: **Option C (Pragmatic)** — **Rationale**: Plan에서 통화별 가격(`prices jsonb`)·`*_i18n`·`external_ref`를 이미 확정했고, Stripe+PortOne 동시 지원으로 통화별 가격이 필수. JSONB로 유연성을 유지하되 구독·정산처럼 정합성이 중요한 영역만 정규화한다.

### 2.1 Component Diagram

```
┌──────────────┐     ┌──────────────┐
│ apps/web      │     │ apps/admin    │   (Next.js, anon key, RLS 적용)
│ (고객 쇼핑몰)  │     │ (운영자 관리)  │
└──────┬───────┘     └──────┬───────┘
       │  Supabase JS (anon) │
       ▼                     ▼
┌─────────────────────────────────────┐
│        Supabase (Postgres)           │
│   profiles/products/orders/... + RLS │
│        Auth + Storage                │
└──────────────▲──────────────────────┘
               │ service_role (서버 전용)
       ┌───────┴────────┐
       │ apps/api(NestJS)│  ← 결제(Stripe/PortOne)·정산·AI(Claude)·번역
       └────────────────┘
packages/shared(타입·i18n·prices 헬퍼)  packages/supabase(스키마·마이그레이션·seed)
```

> Phase 0에서는 **DB 스키마 + RLS + 스캐폴딩**까지. NestJS 비즈니스 로직 구현은 Phase 4.

### 2.2 Data Flow (Phase 0 기준)

```
마이그레이션 적용 → 테이블/관계/RLS 생성 → 시드 데이터 적재
→ (검증) anon으로 파트너 로그인 → 자기 상품만 SELECT 확인
→ service_role로 전체 조회 확인
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| apps/web, apps/admin | packages/shared, Supabase anon | 타입·헬퍼 공유, RLS 적용 조회 |
| apps/api (NestJS) | packages/supabase(service_role), packages/shared | 민감 로직, 전체 접근 |
| packages/supabase | — | 스키마·마이그레이션·RLS·seed 단일 소스 |
| 모든 테이블 | profiles → auth.users | role 기반 권한 |

---

## 3. Data Model

### 3.1 Entity Definition (TypeScript — packages/shared)

```typescript
// 공통 다국어/다통화 타입
type Locale = 'en' | 'ko' | 'ja' | 'zh-TW';
type Currency = 'USD' | 'KRW';
type I18n = Partial<Record<Locale, string>>;        // {"en": "...", "ko": "..."}
type Prices = Partial<Record<Currency, number>>;     // {"USD": 1990, "KRW": 2900000} 최소단위 정수
type Role = 'customer' | 'partner' | 'admin';
type ProductType = 'physical' | 'ticket' | 'subscription';

interface Profile {
  id: string;            // = auth.users.id
  email: string;
  role: Role;            // default 'customer'
  name?: string;
  phone?: string;
  locale: Locale;        // default 'en'
  createdAt: string;
}

interface Product {
  id: string;
  code: string;          // unique
  sellerId: string;      // 자사=admin id, 파트너=partner profile id
  isPartnerProduct: boolean;
  productType: ProductType;
  categoryId?: string;
  nameI18n: I18n;
  detailHtmlI18n?: I18n;     // 언어별 상세 HTML (목록 쿼리에서 제외)
  prices: Prices;           // 통화별 가격 직접 입력
  attributes?: Record<string, unknown>;  // ticket: {date,seat}, subscription: {tier}
  externalRef?: Record<string, unknown>; // 123Pass 연동 대비
  aiGenerated: boolean;
  status: 'draft' | 'pending' | 'active' | 'soldout';
  createdAt: string;
}
```

### 3.2 Entity Relationships

```
auth.users 1──1 profiles ──(role)── customer / partner / admin
profiles   1──N products (seller_id)         ← 파트너/자사 상품
profiles   1──1 partners (user_id, role=partner)
categories 1──N categories (parent_id 자기참조) ← 대/중 분류
categories 1──N products
profiles   1──N orders (buyer_id)
orders     1──N order_items ──N─1 products
order_items N─1 profiles (seller_id)          ← 정산 근거
orders     1──N shipments
profiles   1──N subscriptions                 ← JNJ/DIV
products   1──N ai_product_jobs
banners / boards / main_sections              ← 독립 관리
```

### 3.3 Database Schema (Postgres / Supabase — Option C)

```sql
-- 공통 트리거: updated_at 자동 갱신
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;

-- 1) profiles
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'customer' check (role in ('customer','partner','admin')),
  name text, phone text,
  locale text not null default 'en' check (locale in ('en','ko','ja','zh-TW')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2) partners (정합성 중요 → 정규화)
create table partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references profiles(id) on delete cascade,
  company_name text, biz_no text,
  commission_rate numeric(5,4) not null default 0.10 check (commission_rate >= 0 and commission_rate <= 1),
  settlement_info jsonb,
  status text not null default 'pending' check (status in ('pending','active','suspended')),
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- 3) categories (자기참조)
create table categories (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  parent_id uuid references categories(id) on delete set null,
  name_i18n jsonb not null default '{}',
  sort_order int default 0,
  is_visible boolean default true
);

-- 4) products (JSONB 유연: prices/i18n/attributes)
create table products (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  seller_id uuid not null references profiles(id),
  is_partner_product boolean default false,
  product_type text not null default 'physical' check (product_type in ('physical','ticket','subscription')),
  category_id uuid references categories(id) on delete set null,
  name_i18n jsonb not null default '{}',
  detail_html_i18n jsonb default '{}',
  prices jsonb not null default '{}',     -- {"USD":1990,"KRW":2900000}
  attributes jsonb default '{}',          -- 타입별 가변 속성
  external_ref jsonb,                     -- 123Pass 연동 대비
  ai_generated boolean default false,
  status text not null default 'draft' check (status in ('draft','pending','active','soldout')),
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index idx_products_seller on products(seller_id);
create index idx_products_category on products(category_id);
create index idx_products_status on products(status);

-- 5) orders / order_items (정산 정합성 → 정규화)
create table orders (
  id uuid primary key default gen_random_uuid(),
  order_no text unique not null,
  buyer_id uuid not null references profiles(id),
  status text not null default 'pending'
    check (status in ('pending','paid','shipped','done','cancelled','refunded')),
  total_amount int not null default 0,
  currency text not null default 'USD' check (currency in ('USD','KRW')),
  payment_method text check (payment_method in ('stripe','portone')),
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id),
  seller_id uuid not null references profiles(id),  -- 정산용
  qty int not null check (qty > 0),
  unit_price int not null,
  line_amount int not null,
  currency text not null default 'USD'
);
create index idx_order_items_seller on order_items(seller_id);
create index idx_order_items_order on order_items(order_id);

-- 6) shipments (국내/해외 분기)
create table shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  region text not null default 'domestic' check (region in ('domestic','overseas')),
  carrier text, tracking_no text,
  status text not null default 'preparing' check (status in ('preparing','shipped','delivered')),
  shipped_at date, eta date, cost int default 0
);

-- 7) subscriptions (반복결제 정합성 → 정규화)
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  plan text not null,                      -- 'JNJ' | 'DIV' (+tier)
  status text not null default 'active' check (status in ('active','paused','cancelled')),
  period_start date, period_end date,
  price int, currency text default 'USD'
);

-- 8) 독립 관리 테이블
create table banners (
  id uuid primary key default gen_random_uuid(),
  position text, title_i18n jsonb default '{}', image_url text, link_url text,
  sort_order int default 0, start_at date, end_at date, is_active boolean default true
);
create table boards (
  id uuid primary key default gen_random_uuid(),
  board_type text check (board_type in ('notice','qna','review','faq')),
  title text, content text,
  author_id uuid references profiles(id),
  status text default 'open', created_at timestamptz default now()
);
create table main_sections (
  id uuid primary key default gen_random_uuid(),
  section_type text check (section_type in ('hero','slider','featured','category_strip')),
  config jsonb default '{}', sort_order int default 0, is_active boolean default true
);
create table ai_product_jobs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  input jsonb, generated_html text,
  status text default 'done', created_at timestamptz default now()
);

-- updated_at 트리거 부착 (profiles/partners/products/orders)
create trigger trg_profiles_updated before update on profiles for each row execute function set_updated_at();
create trigger trg_partners_updated before update on partners for each row execute function set_updated_at();
create trigger trg_products_updated before update on products for each row execute function set_updated_at();
create trigger trg_orders_updated   before update on orders   for each row execute function set_updated_at();
```

---

## 4. API Specification

> **Phase 0 범위**: 별도 API 구현 없음. Supabase가 테이블 생성 시 PostgREST 기반 auto REST/JS SDK를 제공하고, RLS가 권한을 강제한다. 민감 로직(결제/정산/AI)을 위한 NestJS 엔드포인트 설계는 **Phase 4 Design**에서 전개.

### 4.1 데이터 접근 경계 (Phase 0)

| Actor | 클라이언트 | 키 | 접근 |
|-------|-----------|----|------|
| 고객/파트너 | apps/web | anon key | RLS 정책 범위 내 SELECT/INSERT/UPDATE |
| 운영자 | apps/admin | anon key (role=admin) | RLS admin 정책으로 전체 |
| 서버 배치/적재 | apps/api(NestJS) | **service_role** | RLS 우회(전체). 절대 프런트/git 노출 금지 |

### 4.2 RLS 정책 (핵심)

```sql
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table subscriptions enable row level security;

-- 관리자 판별 헬퍼
create or replace function is_admin() returns boolean as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$ language sql security definer stable;

-- 파트너: 자기 상품만 (자사 상품/관리자는 admin 정책)
create policy "products_partner_own" on products
  for all using (seller_id = auth.uid() or is_admin())
  with check (seller_id = auth.uid() or is_admin());
-- 공개 상품은 누구나 읽기 (active) + 파트너는 자기 상품(비-active 포함) 읽기 + admin
create policy "products_public_read" on products
  for select using (status = 'active' or seller_id = auth.uid() or is_admin());

-- 고객: 자기 주문만
create policy "orders_buyer_own" on orders
  for all using (buyer_id = auth.uid() or is_admin())
  with check (buyer_id = auth.uid() or is_admin());

-- order_items: 구매자 또는 판매자(정산 조회) 또는 admin
create policy "order_items_visibility" on order_items
  for select using (
    seller_id = auth.uid() or is_admin()
    or exists (select 1 from orders o where o.id = order_id and o.buyer_id = auth.uid())
  );

-- 구독: 본인만
create policy "subs_user_own" on subscriptions
  for all using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());
```

---

## 5. UI/UX Design

> **Phase 0 범위 외.** 관리자/고객 화면 UI는 Phase 1/2/3 Design에서 전개. 이 문서는 데이터 계층만 다룬다.

---

## 6. Error Handling

### 6.1 DB/마이그레이션 레벨 (Phase 0)

| 상황 | 처리 |
|------|------|
| check 제약 위반 (잘못된 enum 값) | DB가 거부 → 시드/적재 스크립트에서 검증 후 재시도 |
| 외래키 위반 (orphan) | on delete cascade/set null로 명시, 적재 순서 보장(profiles→categories→products→…) |
| 마이그레이션 재실행 | idempotent 작성 (`create table if not exists` / 버전 관리된 순차 마이그레이션) |
| RLS로 0행 반환 | 권한 부족과 데이터 없음 구분 로깅 |

### 6.2 향후 API 에러 포맷 (Phase 4 참조용)

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": { "fieldErrors": {} } } }
```

---

## 7. Security Considerations

- [x] **RLS 활성화**: products/orders/order_items/subscriptions 등 민감 테이블 전부
- [x] **파트너 격리**: `seller_id = auth.uid()` — 자기 상품/정산만
- [x] **service_role 키 서버 전용**: `.env`에만, `NEXT_PUBLIC_` 접두사 금지, git 제외(.gitignore)
- [ ] **AI 생성 HTML sanitize**: 저장·렌더 양쪽 (Phase 3, isomorphic-dompurify) — Phase 0에선 컬럼만
- [ ] **이미지 base64 금지**: Storage URL만 (Phase 3 규칙)
- [x] **금액 정수 저장**: 부동소수 오류 방지, 통화별 최소단위
- [x] **결제수단/통화 enum 제약**: check 제약으로 잘못된 값 차단

---

## 8. Test Plan (v2.3.0)

> Phase 0는 DB 계층이므로 테스트는 **SQL 검증 + RLS 동작 확인**이 중심. (L2/L3 UI/E2E는 Phase 1+ 화면 생성 후)

### 8.1 Test Scope

| Type | Target | Tool | Phase |
|------|--------|------|-------|
| L1: DB/RLS Tests | 테이블 생성·제약·RLS 권한 경계 | psql / Supabase SQL + 통합 스크립트 | Do |
| L2: UI Action Tests | (Phase 1+ 화면 생성 후) | Playwright | 후속 |
| L3: E2E Scenario Tests | (Phase 4 결제 흐름) | Playwright | 후속 |

### 8.2 L1: DB/RLS Test Scenarios

| # | 대상 | 테스트 | 기대 결과 |
|---|------|--------|-----------|
| 1 | 전체 테이블 | 마이그레이션 적용 | 12개 테이블 + 인덱스 + 트리거 생성, 에러 0 |
| 2 | check 제약 | `role='hacker'` insert | 거부(check_violation) |
| 3 | products.prices | `{"USD":1990,"KRW":2900000}` insert/select | jsonb 그대로 왕복 |
| 4 | RLS 파트너 | 파트너 토큰으로 타 파트너 상품 select | **0행** (자기 것만) |
| 5 | RLS 파트너 | 파트너 토큰으로 자기 상품 select | 자기 상품만 반환 |
| 6 | RLS 공개읽기 | 익명/고객으로 status='active' 상품 select | 노출 상품만 |
| 7 | RLS 주문 | 고객 A 토큰으로 고객 B 주문 select | 0행 |
| 8 | RLS admin | admin 토큰으로 전체 테이블 select | 전체 반환 |
| 9 | 외래키 | 존재하지 않는 category_id로 product insert | 거부(fk_violation) |
| 10 | 정산 근거 | order_items.seller_id로 파트너별 합계 집계 | 판매자별 정확 집계 |

### 8.5 Seed Data Requirements

| Entity | Minimum Count | Key Fields Required |
|--------|:------------:|---------------------|
| profiles | 3 | admin 1, partner 1, customer 1 (role, locale) |
| partners | 1 | user_id(=partner), commission_rate, status='active' |
| categories | 3 | 대분류 1 + 중분류 2 (name_i18n en/ko, parent_id) |
| products | 3 | physical/ticket/subscription 각 1, prices(USD+KRW), name_i18n, seller_id |
| orders + order_items | 1 | 파트너 상품 포함 → 정산 집계 검증용 |

> Do phase: `packages/supabase/seed.sql`(또는 `seed.ts`) 구현 후 L1 테스트 실행.

---

## 9. Clean Architecture

### 9.1 Layer Structure (모노레포 맥락)

| Layer | Responsibility | Location |
|-------|---------------|----------|
| **Presentation** | 화면(후속 Phase) | `apps/web/src/`, `apps/admin/src/` |
| **Application** | 결제·정산·AI 유스케이스(후속) | `apps/api/src/` (NestJS modules) |
| **Domain** | 공통 타입·도메인 규칙 | `packages/shared/src/types`, `.../domain` |
| **Infrastructure** | Supabase 스키마·클라이언트·마이그레이션 | `packages/supabase/`, `packages/shared/src/supabase` |

### 9.2 Dependency Rules

```
apps/web · apps/admin ──→ packages/shared(types, i18n/prices helpers) ──→ (Supabase anon client)
apps/api(NestJS)      ──→ packages/shared, packages/supabase(service_role)
packages/supabase     ──→ (없음: 단일 소스. 스키마/마이그레이션/RLS/seed)
규칙: 앱은 packages를 import, packages는 앱을 import하지 않음
```

### 9.4 This Feature's Layer Assignment (Phase 0)

| Component | Layer | Location |
|-----------|-------|----------|
| 공통 타입 (Profile, Product, I18n, Prices…) | Domain | `packages/shared/src/types/index.ts` |
| i18n 헬퍼 (`pickI18n(value, locale)`, 폴백) | Domain | `packages/shared/src/i18n.ts` |
| prices 헬퍼 (`pickPrice(prices, currency)`) | Domain | `packages/shared/src/prices.ts` |
| 스키마/마이그레이션/RLS | Infrastructure | `packages/supabase/migrations/*.sql` |
| seed 스크립트 | Infrastructure | `packages/supabase/seed.sql` |
| Supabase 클라이언트(anon/service) | Infrastructure | `packages/shared/src/supabase/{client,admin}.ts` |

---

## 10. Coding Convention Reference

### 10.1 Naming Conventions

| Target | Rule | Example |
|--------|------|---------|
| 테이블/컬럼 | snake_case | `order_items`, `seller_id` |
| 다국어 컬럼 | `_i18n` 접미사 jsonb | `name_i18n`, `title_i18n` |
| 가격 컬럼 | `prices` jsonb (통화별) | `prices = {"USD":..,"KRW":..}` |
| TS 타입/인터페이스 | PascalCase | `Product`, `Prices`, `I18n` |
| 함수 | camelCase | `pickI18n()`, `pickPrice()` |
| 폴더 | kebab-case | `order-items/` |

### 10.3 Environment Variables

| Prefix | Purpose | Scope |
|--------|---------|-------|
| `NEXT_PUBLIC_SUPABASE_*` | URL/anon 키 | Browser |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용(RLS 우회) | Server only |
| `ANTHROPIC_API_KEY` | AI 생성(Phase 3) | Server only |
| `STRIPE_SECRET_KEY` / `PORTONE_API_SECRET` | 결제(Phase 4) | Server only |

### 10.4 This Feature's Conventions

| Item | Convention Applied |
|------|-------------------|
| 금액 단위 | 정수 최소단위(센트/원), prices jsonb 키=ISO 통화코드 |
| 다국어 폴백 | 누락 시 'en' 폴백 (`pickI18n`) |
| 마이그레이션 | 순차 번호 파일, idempotent |
| 권한 | RLS 우선, 클라이언트 신뢰 금지 |

---

## 11. Implementation Guide

### 11.1 File Structure

```
wolf-app/
├── package.json (workspaces) / pnpm-workspace.yaml
├── apps/
│   ├── web/       (Next.js — 스캐폴딩만, 화면은 Phase 2+)
│   ├── admin/     (Next.js — 스캐폴딩만, 화면은 Phase 1)
│   └── api/       (NestJS — 스캐폴딩만, 로직은 Phase 4)
└── packages/
    ├── shared/
    │   └── src/{types/index.ts, i18n.ts, prices.ts, supabase/{client.ts, admin.ts}}
    └── supabase/
        ├── migrations/
        │   ├── 0001_init_tables.sql
        │   ├── 0002_indexes_triggers.sql
        │   └── 0003_rls_policies.sql
        ├── seed.sql
        └── schema.sql (확정 스냅샷, 버전 관리)
```

### 11.2 Implementation Order

1. [ ] 모노레포 골격 (pnpm workspaces, apps/* · packages/* 빈 스캐폴딩)
2. [ ] `packages/shared` 공통 타입 + i18n/prices 헬퍼
3. [ ] `packages/supabase/migrations` 0001 테이블 → 0002 인덱스/트리거 → 0003 RLS
4. [ ] Supabase 클라이언트(anon/service_role) 래퍼
5. [ ] `seed.sql` 작성 + 적재
6. [ ] L1 DB/RLS 테스트 (§8.2) 실행 → 파트너 격리·정산 집계 검증
7. [ ] `schema.sql` 스냅샷 저장(버전 관리)

### 11.3 Session Guide

> `/pdca do wolf-app --scope module-N`으로 모듈 단위 구현 가능.

#### Module Map

| Module | Scope Key | Description | Estimated Turns |
|--------|-----------|-------------|:---------------:|
| 모노레포 + shared 패키지 | `module-1` | pnpm workspaces 골격, 공통 타입·i18n/prices 헬퍼, Supabase 클라이언트 래퍼 | 8-12 |
| 스키마 마이그레이션 | `module-2` | 0001 테이블 + 0002 인덱스/트리거 (§3.3) | 10-15 |
| RLS + 헬퍼 | `module-3` | 0003 RLS 정책 + is_admin() (§4.2) | 8-12 |
| Seed + L1 검증 | `module-4` | seed.sql + DB/RLS 테스트 (§8.2), schema.sql 스냅샷 | 10-15 |

#### Recommended Session Plan

| Session | Phase | Scope | Turns |
|---------|-------|-------|:-----:|
| Session 1 | Plan + Design | 전체 | 완료 |
| Session 2 | Do | `--scope module-1,module-2` | 40-50 |
| Session 3 | Do | `--scope module-3,module-4` | 40-50 |
| Session 4 | Check + Report | 전체 | 30-40 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-06-04 | 초안 — Phase 0 DB 설계(Option C Pragmatic): 12테이블 스키마, RLS 정책, 모노레포 스캐폴딩, L1 DB/RLS 테스트 계획, Session Guide | bandnara123 |
| 0.2 | 2026-06-04 | Check 후속 동기화 — 테이블 카운트 12개 정정, §4.2 products_public_read에 파트너 자기상품/admin 조건 반영 | bandnara123 |
