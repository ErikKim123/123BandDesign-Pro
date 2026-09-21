-- 0018: 뉴스레터 캠페인(작성/예약/발송) — 어드민 전용.
-- 구독자(newsletter_subscribers, 0010)에게 보낼 메일을 작성·예약·발송 이력 관리.

create table if not exists newsletters (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  content_html text not null default '',
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sent')),
  scheduled_at timestamptz,            -- 예약 발송 시각(없으면 즉시/수동)
  sent_at timestamptz,                 -- 실제 발송 시각
  recipient_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists newsletters_status_idx on newsletters (status, scheduled_at);

alter table newsletters enable row level security;

-- 어드민만 전체 권한 (is_admin() — 0003 정의)
drop policy if exists "newsletters_admin_all" on newsletters;
create policy "newsletters_admin_all" on newsletters
  for all using (is_admin()) with check (is_admin());
