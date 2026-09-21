-- Design Ref: 코드관리 — 화면 곳곳의 선택지(코드값)를 코드가 아니라 DB 에서 관리한다.
--
-- 지금은 '부문 코드(아마추어·프로·살사·오픈)' 같은 목록이 소스에 박혀 있어서, 값 하나 늘리는 데도
-- 배포가 필요하다. 대회마다 부문 구성이 달라지는 성격의 값인데 배포로만 바뀌는 건 맞지 않는다.
--
-- 한 테이블에 group_key 로 묶는다. 그룹마다 테이블을 따로 만들면 새 코드 그룹이 생길 때마다
-- 마이그레이션·화면·권한을 세 벌씩 늘려야 한다.
--
-- 라벨은 다국어다(label_i18n) — 어드민은 한국어로 보지만 고객 화면에도 쓰이는 값이 있다.
--
-- idempotent: create table if not exists + on conflict do nothing 시드.

create table if not exists code_values (
  id uuid primary key default gen_random_uuid(),
  -- 코드 그룹. 예: 'jnj_division'(J&J 부문), 'jnj_role'(참가 역할)
  group_key text not null,
  -- 실제로 저장·비교되는 값. 그룹 안에서 유일하다.
  code text not null,
  label_i18n jsonb not null default '{}'::jsonb,
  -- 이 코드가 무엇인지 운영자에게 남기는 메모(화면에는 안 나간다)
  note text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  -- 코드가 참조하는 곳이 있어 지우면 데이터가 깨지는 값. 삭제 대신 '사용 안 함'으로 끈다.
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_key, code)
);

create index if not exists idx_code_values_group on code_values(group_key, sort_order, code);

comment on table code_values is
  '화면 선택지(코드값) 원본. group_key 로 묶고, 코드가 없으면 소스의 기본 목록으로 폴백한다.';
comment on column code_values.is_system is
  '코드가 참조하는 값. 지우면 기존 데이터가 어느 코드인지 알 수 없어진다 — 삭제 대신 비활성으로.';

create or replace function touch_code_values() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists trg_touch_code_values on code_values;
create trigger trg_touch_code_values before update on code_values
  for each row execute function touch_code_values();

-- ── RLS ────────────────────────────────────────────────────────────────────
-- 읽기는 열어 둔다. 코드값은 화면에 그대로 보이는 라벨이라 숨길 내용이 없고,
-- 고객 화면(비로그인)도 부문 이름을 읽어야 한다. 쓰기는 운영자만.
alter table code_values enable row level security;

drop policy if exists code_values_read on code_values;
create policy code_values_read on code_values for select
  using (is_active or is_admin());

drop policy if exists code_values_admin_write on code_values;
create policy code_values_admin_write on code_values for all
  using (is_admin()) with check (is_admin());

-- ── 시드: 지금 소스에 박혀 있는 목록 그대로 ────────────────────────────────
insert into code_values (group_key, code, label_i18n, sort_order, is_system) values
  ('jnj_division', 'amateur', '{"ko":"아마추어","en":"Amateur"}'::jsonb, 1, true),
  ('jnj_division', 'pro',     '{"ko":"프로","en":"Pro"}'::jsonb,          2, true),
  ('jnj_division', 'salsa',   '{"ko":"살사","en":"Salsa"}'::jsonb,        3, true),
  ('jnj_division', 'open',    '{"ko":"오픈","en":"Open"}'::jsonb,         4, true),
  ('jnj_role', 'couple',   '{"ko":"커플 (리더+팔로워)","en":"Couple (leader+follower)"}'::jsonb, 1, true),
  ('jnj_role', 'leader',   '{"ko":"리더","en":"Leader"}'::jsonb,   2, true),
  ('jnj_role', 'follower', '{"ko":"팔로워","en":"Follower"}'::jsonb, 3, true)
on conflict (group_key, code) do nothing;
