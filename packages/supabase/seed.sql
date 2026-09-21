-- ⚠️ 123Band 는 울프·JNJ 와 같은 DB 를 쓴다. 이 파일을 psql 로 직접 실행하지 말 것 —
--    검색 경로가 public 이라 이름 없는 객체가 울프 쪽에 생기고, 고정 UUID 계정이 울프 계정과 겹칠 수 있다.
--    스키마 구축은 pnpm db:bootstrap 을 쓴다.

-- Design Ref: §8.5 — 시드 데이터 (L1 DB/RLS 테스트가 의미를 갖도록 최소 데이터)
-- Plan SC: 카테고리 + 샘플 상품(physical/ticket/subscription), 파트너 정산 검증용 주문
-- idempotent: 고정 UUID + on conflict do nothing
-- ⚠️ service_role(또는 SQL Editor)로 실행. profiles 는 auth.users 참조 → 먼저 auth.users 시드.
-- crypt()/gen_salt(pgcrypto)를 확실히 찾도록 search_path 확장 (Supabase: pgcrypto = extensions 스키마)
set search_path = band123, extensions, auth;

-- 고정 UUID (테스트에서 재참조)
--   admin    : 00000000-0000-0000-0000-000000000001
--   partner  : 00000000-0000-0000-0000-000000000002
--   customer : 00000000-0000-0000-0000-000000000003

-- ── auth.users (Supabase 인증 사용자) ───────────────────────
-- 비밀번호 포함 (signInWithPassword 로그인 가능). 공통 PW: Band!2026
-- crypt()/gen_salt() = pgcrypto (Supabase 기본 제공). email_confirmed_at 설정 = 이메일 인증 생략.
-- 멱등: 이미 비번 없는 더미가 있어도 do update 로 비번/확인일시를 채움.
insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@123band.test',
   crypt('Band!2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'partner@123band.test',
   crypt('Band!2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'customer@123band.test',
   crypt('Band!2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do update set
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  aud                = excluded.aud,
  role               = excluded.role,
  raw_app_meta_data  = excluded.raw_app_meta_data,
  updated_at         = now();

-- auth.identities (GoTrue 로그인에 필요 — provider_id 필수)
insert into auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
)
values
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001',
   '{"sub":"00000000-0000-0000-0000-000000000001","email":"admin@123band.test"}'::jsonb,    'email', '00000000-0000-0000-0000-000000000001', now(), now(), now()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002',
   '{"sub":"00000000-0000-0000-0000-000000000002","email":"partner@123band.test"}'::jsonb,  'email', '00000000-0000-0000-0000-000000000002', now(), now(), now()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003',
   '{"sub":"00000000-0000-0000-0000-000000000003","email":"customer@123band.test"}'::jsonb, 'email', '00000000-0000-0000-0000-000000000003', now(), now(), now())
on conflict (provider, provider_id) do nothing;

-- ── profiles ─────────────────────────────────────────────────
insert into profiles (id, email, role, name, locale) values
  ('00000000-0000-0000-0000-000000000001', 'admin@123band.test',    'admin',    '123Band Admin',  'en'),
  ('00000000-0000-0000-0000-000000000002', 'partner@123band.test',  'partner',  'Partner One', 'ko'),
  ('00000000-0000-0000-0000-000000000003', 'customer@123band.test', 'customer', 'Customer A',  'en')
on conflict (id) do nothing;

-- ── partners (partner profile 연결) ──────────────────────────
insert into partners (id, user_id, company_name, biz_no, commission_rate, status) values
  ('00000000-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-000000000002', 'Partner One Co.', '123-45-67890', 0.15, 'active')
on conflict (id) do nothing;

-- ── categories (대분류 1 + 중분류 2) ─────────────────────────
insert into categories (id, code, parent_id, name_i18n, sort_order, is_visible) values
  ('00000000-0000-0000-0000-0000000000c1', 'apparel', null,
   '{"en":"Apparel","ko":"의류"}'::jsonb, 1, true),
  ('00000000-0000-0000-0000-0000000000c2', 'tops',
   '00000000-0000-0000-0000-0000000000c1',
   '{"en":"Tops","ko":"상의"}'::jsonb, 1, true),
  ('00000000-0000-0000-0000-0000000000c3', 'events', null,
   '{"en":"Events","ko":"이벤트"}'::jsonb, 2, true)
on conflict (id) do nothing;

-- ── products (physical / ticket / subscription, 통화별 prices) ──
-- physical: 파트너 상품 (정산 검증 대상)
insert into products
  (id, code, seller_id, is_partner_product, product_type, category_id,
   name_i18n, prices, attributes, status) values
  ('00000000-0000-0000-0000-0000000000d1', 'BAND-TS-001',
   '00000000-0000-0000-0000-000000000002', true, 'physical',
   '00000000-0000-0000-0000-0000000000c2',
   '{"en":"123Band T-Shirt","ko":"123Band 티셔츠"}'::jsonb,
   '{"USD":1990,"KRW":2900000}'::jsonb,
   '{"size":["S","M","L"]}'::jsonb, 'active'),
  -- ticket: 자사 상품
  ('00000000-0000-0000-0000-0000000000d2', 'BAND-TK-001',
   '00000000-0000-0000-0000-000000000001', false, 'ticket',
   '00000000-0000-0000-0000-0000000000c3',
   '{"en":"123Band Live Concert","ko":"123Band 라이브 콘서트"}'::jsonb,
   '{"USD":8000,"KRW":11000000}'::jsonb,
   '{"date":"2026-09-01T19:00:00Z","seat":"A-12","venue":"Seoul"}'::jsonb, 'active'),
  -- subscription: 자사 상품 (JNJ 플랜)
  ('00000000-0000-0000-0000-0000000000d3', 'BAND-SUB-JNJ',
   '00000000-0000-0000-0000-000000000001', false, 'subscription',
   null,
   '{"en":"JNJ SaaS Monthly","ko":"JNJ SaaS 월간"}'::jsonb,
   '{"USD":2900,"KRW":3900000}'::jsonb,
   '{"plan":"JNJ","tier":"basic","interval":"month"}'::jsonb, 'active')
on conflict (id) do nothing;

-- ── order + order_items (파트너 정산 집계 검증용) ────────────
insert into orders (id, order_no, buyer_id, status, total_amount, currency, payment_method) values
  ('00000000-0000-0000-0000-0000000000e1', 'ORD-20260604-0001',
   '00000000-0000-0000-0000-000000000003', 'paid', 3980, 'USD', 'stripe')
on conflict (id) do nothing;

-- 파트너 상품 2개 구매 → seller_id=partner 로 정산 근거 (USD 1990 × 2 = 3980)
insert into order_items
  (id, order_id, product_id, seller_id, qty, unit_price, line_amount, currency) values
  ('00000000-0000-0000-0000-0000000000f1',
   '00000000-0000-0000-0000-0000000000e1',
   '00000000-0000-0000-0000-0000000000d1',
   '00000000-0000-0000-0000-000000000002', 2, 1990, 3980, 'USD')
on conflict (id) do nothing;
