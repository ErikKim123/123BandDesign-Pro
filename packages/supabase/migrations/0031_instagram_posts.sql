-- 0031: 인스타그램 예약 게시 — 어드민 › 인스타그램 캘린더에서 만드는 예약 게시물.
-- ⚠️ SQL Editor 에서 0030 적용 후 실행.
-- 예약을 브라우저(localStorage)가 아니라 DB 에 두고 cron 이 발행한다 → 브라우저를 꺼도 정시에 게시된다.

create table if not exists instagram_posts (
  id uuid primary key default gen_random_uuid(),

  scheduled_at timestamptz not null,                  -- 게시 예정 시각(UTC 저장, UI 는 로컬 표시)
  caption text not null default '',
  media_type text not null default 'IMAGE',           -- 'IMAGE' | 'REELS'(동영상)
  media_url text not null,                            -- 인스타가 가져갈 수 있는 공개 URL
  thumb_url text,                                     -- 목록 미리보기용(동영상일 때 커버)

  -- scheduled: 대기 / publishing: cron 이 집어감(중복 발행 방지 잠금) / posted / failed / canceled
  status text not null default 'scheduled',
  permalink text,                                     -- 발행 성공 시 인스타 게시물 링크
  error text,                                         -- 마지막 실패 사유
  attempts int not null default 0,                    -- 발행 시도 횟수(무한 재시도 방지)
  published_at timestamptz,

  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint instagram_posts_media_type_chk check (media_type in ('IMAGE', 'REELS')),
  constraint instagram_posts_status_chk
    check (status in ('scheduled', 'publishing', 'posted', 'failed', 'canceled'))
);

-- cron 이 "발행할 때가 된 것"을 찾는 경로 + 캘린더의 월 범위 조회 경로.
create index if not exists instagram_posts_due_idx
  on instagram_posts (status, scheduled_at);
create index if not exists instagram_posts_scheduled_at_idx
  on instagram_posts (scheduled_at);

alter table instagram_posts enable row level security;

-- 어드민 전용. cron 은 service_role 로 접근하므로 RLS 를 우회한다.
drop policy if exists "instagram_posts_admin_all" on instagram_posts;
create policy "instagram_posts_admin_all" on instagram_posts
  for all using (is_admin()) with check (is_admin());

-- ── 미디어 버킷 ── 인스타가 URL 로 직접 받아가야 하므로 공개 읽기.
insert into storage.buckets (id, name, public)
values ('band123-instagram-media', 'band123-instagram-media', true)
on conflict (id) do update set public = true;

drop policy if exists "band123_instagram_media_public_read" on storage.objects;
create policy "band123_instagram_media_public_read" on storage.objects
  for select using (bucket_id = 'band123-instagram-media');

drop policy if exists "band123_instagram_media_admin_write" on storage.objects;
create policy "band123_instagram_media_admin_write" on storage.objects
  for all to authenticated
  using (bucket_id = 'band123-instagram-media' and band123.is_admin())
  with check (bucket_id = 'band123-instagram-media' and band123.is_admin());
