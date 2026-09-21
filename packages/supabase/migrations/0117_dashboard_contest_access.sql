-- 0117: 대시보드 대회 접근권 + 오거나이저 대회 개수 한도
--
-- 대시보드(J&J·BATTLE·DIV)는 들어온 사람이 운영진이면 모든 대회를, 오거나이저면 '자기 대회'만
-- 보여 줘야 한다. 그런데 대회는 세 스키마(public·battle·div)에 흩어져 있고, 세 곳에 각각
-- 주인 칸을 두면 어드민이 세 군데를 따로 관리하게 된다. 그래서 '누가 어느 대회를 볼 수 있나'만
-- 이 한 표에 모은다 — 어드민 화면도, 세 대시보드도 이 표 하나만 보면 된다.
--
--   role='owner'  : 그 오거나이저가 직접 만든 대회(대시보드가 만들 때 넣는다)
--   role='shared' : 운영진이 만들어 둔 대회를 특정 오거나이저에게 열어 준 것(어드민이 넣는다)
--
-- 운영진(PIN)은 이 표를 보지 않는다 — 언제나 전부 볼 수 있다.
-- idempotent.

create table if not exists band123.dashboard_contest_access (
  -- 어느 대시보드의 대회인지. 대회 id 는 대시보드마다 따로 매겨져 겹칠 수 있다(BTL-001 · JNJ-001).
  dash text not null check (dash in ('jnj', 'battle', 'div')),
  -- 대회 id 는 'BTL-001' 같은 문자열이다(uuid 가 아니다). 스키마가 달라 FK 는 걸지 않는다.
  contest_id text not null,
  user_id uuid not null references band123.profiles(id) on delete cascade,
  role text not null default 'shared' check (role in ('owner', 'shared')),
  granted_by uuid references band123.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (dash, contest_id, user_id)
);

create index if not exists dashboard_contest_access_user_idx
  on band123.dashboard_contest_access (user_id, dash);

alter table band123.dashboard_contest_access enable row level security;

-- 본인 것만 읽는다. 대시보드는 service_role 로 읽으므로 이 정책과 무관하다.
drop policy if exists dashboard_contest_access_own on band123.dashboard_contest_access;
create policy dashboard_contest_access_own on band123.dashboard_contest_access
  for select using (user_id = auth.uid());

-- 운영자는 전부 — 어드민 화면에서 공유를 주고 뺀다.
drop policy if exists dashboard_contest_access_admin on band123.dashboard_contest_access;
create policy dashboard_contest_access_admin on band123.dashboard_contest_access
  for all using (band123.is_admin()) with check (band123.is_admin());

-- ── 대회 개수 한도 ────────────────────────────────────────────────────────────
-- 결제 상태에 따라 운영자가 정한다. 세 대시보드를 합쳐서 센다 — 주최자에게는 '내가 연 행사'가
-- 하나의 묶음이지 대시보드별로 나뉘지 않는다.
alter table band123.partners add column if not exists max_contests int not null default 1;
comment on column band123.partners.max_contests is
  '직접 만들 수 있는 대회 수(J&J·BATTLE·DIV 합산). 운영자가 결제 상태에 맞춰 정한다. 공유받은 대회는 세지 않는다.';

-- 0116 의 가드: 운영자가 아니면 status·수수료율을 못 고친다. 한도도 같은 칸이다.
create or replace function band123.partners_guard_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = band123
as $fn$
begin
  if band123.is_admin() then return new; end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.commission_rate := 0.10;
    new.max_contests := 1;
    new.approved_at := null;
    new.approved_by := null;
    new.rejected_at := null;
    new.reject_reason := null;
  else
    new.status := old.status;
    new.commission_rate := old.commission_rate;
    new.max_contests := old.max_contests;
    new.approved_at := old.approved_at;
    new.approved_by := old.approved_by;
    new.rejected_at := old.rejected_at;
    new.reject_reason := old.reject_reason;
    -- 동의 기록도 본인이 고칠 수 없다. 고치려면 다시 신청해야 한다(apply_organizer 가 definer).
    new.terms_version := old.terms_version;
    new.terms_agreed_at := old.terms_agreed_at;
  end if;
  return new;
end;
$fn$;

notify pgrst, 'reload schema';
