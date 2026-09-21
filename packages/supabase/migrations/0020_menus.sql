-- 0020: 메뉴관리 — 고객몰 상단 네비게이션 메뉴(다국어 라벨 + 경로 + 순서/노출).
-- 웹 헤더가 is_active 메뉴를 sort_order 순으로 읽어 렌더(없으면 코드 기본값 폴백).

create table if not exists menus (
  id uuid primary key default gen_random_uuid(),
  label_i18n jsonb not null default '{}'::jsonb,     -- {"en":"Shop","ko":"쇼핑"}
  path text not null default '/',                    -- 로케일 상대 경로: '/' = 홈, '/events', '/shop?type=ticket', 또는 http… 외부링크
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists menus_sort_idx on menus (sort_order);

alter table menus enable row level security;

-- 공개 읽기(노출된 것) + 어드민 전체
drop policy if exists "menus_public_read" on menus;
create policy "menus_public_read" on menus
  for select using (is_active = true or is_admin());
drop policy if exists "menus_admin_write" on menus;
create policy "menus_admin_write" on menus
  for all using (is_admin()) with check (is_admin());
