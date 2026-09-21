-- 0053: J&J 부문(division) + 심사위원.
-- 0052 는 '에디션 1건 = 대회 1개' 였고 FORMAT/GUIDELINES 도 에디션에 하나씩만 있었다.
-- 실제 운영은 한 대회 안에 부문이 여러 개(JLCF Bachata PRO / Bachata AMA / Salsa OPEN)이고
-- 부문마다 진행 방식·규정·심사위원·시상대가 다르다. 그래서 부문을 최상위 탭으로 올린다.
--
--   jnj_editions (JLCL 2026)
--     └ jnj_divisions (Bachata PRO / Bachata AMA / Salsa OPEN)
--          ├ jnj_winners  (code 로 매칭 — 기존 division 텍스트 컬럼 그대로 재사용)
--          └ jnj_judges   (division_id NULL 이면 전 부문 공통)
--
-- 폴백 규칙: 부문의 format_i18n/guidelines_i18n 가 비면 에디션(0052)의 공통 본문을 그대로 쓴다.
--            부문 행이 하나도 없으면 고객몰은 0052 시절 화면 그대로 동작한다(무중단 전환).
-- idempotent.

-- ── 1) 부문 ─────────────────────────────────────────────────
create table if not exists jnj_divisions (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references jnj_editions(id) on delete cascade,
  -- jnj_winners.division 과 매칭되는 코드. 'pro' | 'amateur' | 'salsa' 또는 자유값.
  code text not null,
  title_i18n jsonb not null default '{}'::jsonb,       -- 탭에 찍히는 이름. {"en":"JLCF Bachata PRO"}
  subtitle_i18n jsonb not null default '{}'::jsonb,    -- 탭 아래 한 줄 설명(선택)
  format_i18n jsonb not null default '{}'::jsonb,      -- 비면 에디션 공통 FORMAT 사용
  guidelines_i18n jsonb not null default '{}'::jsonb,  -- 비면 에디션 공통 GUIDELINES 사용
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (edition_id, code)
);

create index if not exists jnj_divisions_edition_idx
  on jnj_divisions (edition_id, sort_order);

-- ── 2) 심사위원 ──────────────────────────────────────────────
create table if not exists jnj_judges (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references jnj_editions(id) on delete cascade,
  -- NULL = 그 대회 전 부문에 공통으로 노출. 값이 있으면 해당 부문에서만 노출.
  division_id uuid references jnj_divisions(id) on delete cascade,
  name text not null default '',
  title_i18n jsonb not null default '{}'::jsonb,       -- 직함. {"en":"Head Judge","ko":"심사위원장"}
  country text,                                        -- ISO 3166-1 alpha-2 → 국기/국가명
  photo_url text,
  bio_i18n jsonb not null default '{}'::jsonb,         -- 한두 줄 소개
  instagram text,                                      -- 핸들 또는 URL (선택)
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists jnj_judges_edition_idx
  on jnj_judges (edition_id, sort_order);

-- ── 3) RLS — 0052 와 동일한 규칙 ─────────────────────────────
alter table jnj_divisions enable row level security;
alter table jnj_judges    enable row level security;

-- 부문은 자기 자신이 노출이고 소속 에디션도 노출일 때만 공개(에디션 숨김 = 통째로 비공개).
drop policy if exists "jnj_divisions_public_read" on jnj_divisions;
create policy "jnj_divisions_public_read" on jnj_divisions
  for select using (
    is_admin()
    or (
      is_active = true
      and exists (select 1 from jnj_editions e where e.id = edition_id and e.is_active)
    )
  );
drop policy if exists "jnj_divisions_admin_write" on jnj_divisions;
create policy "jnj_divisions_admin_write" on jnj_divisions
  for all using (is_admin()) with check (is_admin());

drop policy if exists "jnj_judges_public_read" on jnj_judges;
create policy "jnj_judges_public_read" on jnj_judges
  for select using (
    is_admin()
    or (
      is_active = true
      and exists (select 1 from jnj_editions e where e.id = edition_id and e.is_active)
    )
  );
drop policy if exists "jnj_judges_admin_write" on jnj_judges;
create policy "jnj_judges_admin_write" on jnj_judges
  for all using (is_admin()) with check (is_admin());

-- 사진은 0052 에서 만든 'jnj' 버킷을 그대로 쓴다(별도 정책 불필요).
