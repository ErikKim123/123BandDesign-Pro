-- 뉴스레터 구독자 — 행사 페이지 구독 폼에서 수집
create table if not exists newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  locale text,
  created_at timestamptz not null default now()
);

alter table newsletter_subscribers enable row level security;

-- 누구나 구독 신청(insert) 가능 (anon)
drop policy if exists "newsletter_public_insert" on newsletter_subscribers;
create policy "newsletter_public_insert" on newsletter_subscribers
  for insert with check (true);

-- 조회는 admin 만 (is_admin() — 0003 정의)
drop policy if exists "newsletter_admin_read" on newsletter_subscribers;
create policy "newsletter_admin_read" on newsletter_subscribers
  for select using (is_admin());
