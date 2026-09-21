-- 0052: J&J(Jack & Jill) 대회 — 연도/행사별 에디션 + 부문별 우승자.
-- 고객몰 상단 'J&J' 메뉴(/jnj)가 읽는다. 에디션 1건 = 특정 연도의 특정 행사에서 열린 J&J 대회.
--   · format_i18n / guidelines_i18n : 대회 방식(FORMAT) 과 참가 규정(Guidelines). HTML 또는 평문(줄바꿈) 모두 허용.
--   · jnj_winners : 부문(division) × 역할(role) × 순위(rank 1~3). role='couple' 이면 리더+팔로워를 한 카드에 표기.
-- idempotent.

-- ── 1) 에디션(연도 + 행사) ───────────────────────────────────
create table if not exists jnj_editions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,                          -- URL 조각. 예: 'jlcl-2026'
  year int not null,                                   -- 시상 연도 (연도 탭 기준)
  -- 연결 행사(선택). 행사 상세로 이어주는 링크에만 쓰고, 삭제돼도 에디션은 남는다.
  event_product_id uuid references products(id) on delete set null,
  title_i18n jsonb not null default '{}'::jsonb,       -- {"en":"Jeju Latin Conexion 2026","ko":"제주 라틴 커넥션 2026"}
  subtitle_i18n jsonb not null default '{}'::jsonb,
  location_i18n jsonb not null default '{}'::jsonb,    -- {"en":"Jeju, Korea"}
  held_at text,                                        -- 표시용 개최일 문자열. 예: '2026.06.23 – 06.26'
  cover_url text,                                      -- 히어로 배경 이미지
  format_i18n jsonb not null default '{}'::jsonb,      -- FORMAT (대회 진행 방식)
  guidelines_i18n jsonb not null default '{}'::jsonb,  -- Guidelines (참가 규정)
  sort_order int not null default 0,                   -- 같은 연도 내 정렬
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists jnj_editions_year_idx on jnj_editions (year desc, sort_order);

-- ── 2) 부문별 우승자 ─────────────────────────────────────────
create table if not exists jnj_winners (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references jnj_editions(id) on delete cascade,
  -- 부문: 'amateur' | 'pro' | 'salsa' (라벨은 프론트 매핑, 미지의 값은 원문 노출)
  division text not null default 'pro',
  -- 역할: 리더/팔로워 개별 시상 또는 커플 시상
  role text not null default 'couple' check (role in ('leader', 'follower', 'couple')),
  rank int not null default 1 check (rank between 1 and 3),
  name text not null default '',                       -- 개인 또는 커플의 리더
  country text,                                        -- ISO 3166-1 alpha-2 ('KR') → 국기/국가명
  photo_url text,
  partner_name text,                                   -- role='couple' 일 때 팔로워
  partner_country text,
  partner_photo_url text,
  note_i18n jsonb not null default '{}'::jsonb,        -- 한 줄 코멘트(선택)
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists jnj_winners_edition_idx
  on jnj_winners (edition_id, division, role, rank);

-- ── 3) RLS — 공개 읽기(노출된 것) + 어드민 전체 ───────────────
alter table jnj_editions enable row level security;
alter table jnj_winners  enable row level security;

drop policy if exists "jnj_editions_public_read" on jnj_editions;
create policy "jnj_editions_public_read" on jnj_editions
  for select using (is_active = true or is_admin());
drop policy if exists "jnj_editions_admin_write" on jnj_editions;
create policy "jnj_editions_admin_write" on jnj_editions
  for all using (is_admin()) with check (is_admin());

-- 우승자는 자기 자신이 노출이고 소속 에디션도 노출일 때만 공개된다(에디션 숨김 = 통째로 비공개).
drop policy if exists "jnj_winners_public_read" on jnj_winners;
create policy "jnj_winners_public_read" on jnj_winners
  for select using (
    is_admin()
    or (
      is_active = true
      and exists (select 1 from jnj_editions e where e.id = edition_id and e.is_active)
    )
  );
drop policy if exists "jnj_winners_admin_write" on jnj_winners;
create policy "jnj_winners_admin_write" on jnj_winners
  for all using (is_admin()) with check (is_admin());

-- ── 4) 이미지 버킷 — 우승자 사진 / 에디션 커버 ────────────────
-- 정책은 0050(banners) 과 동일: 공개 읽기 + 어드민만 쓰기.
insert into storage.buckets (id, name, public)
values ('band123-jnj', 'band123-jnj', true)
on conflict (id) do update set public = true;

drop policy if exists "band123_jnj_public_read" on storage.objects;
create policy "band123_jnj_public_read" on storage.objects
  for select using (bucket_id = 'band123-jnj');

drop policy if exists "band123_jnj_admin_write" on storage.objects;
create policy "band123_jnj_admin_write" on storage.objects
  for all to authenticated
  using (bucket_id = 'band123-jnj' and band123.is_admin())
  with check (bucket_id = 'band123-jnj' and band123.is_admin());
