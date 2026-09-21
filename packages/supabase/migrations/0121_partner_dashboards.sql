-- 0121: 오거나이저가 쓸 수 있는 대시보드 — 종류별 사용 여부와 대회 수
--
-- 0117 은 '대회 몇 개까지' 를 partners.max_contests 한 칸에 두고 세 대시보드를 합쳐 셌다.
-- 쓰다 보니 두 가지가 아쉬웠다.
--
--   · J&J 만 여는 주최자에게 BATTLE·DIV 까지 열어 둘 이유가 없다. 들어가 봐야 빈 화면이고,
--     오거나이저 로그인 화면의 바로가기에도 쓰지 않을 문이 늘어선다.
--   · 개수도 종류마다 다르게 팔린다. 합산 한 칸으로는 'J&J 2개 + BATTLE 1개' 같은 계약을
--     적을 수가 없다.
--
-- 그래서 (사람 × 대시보드) 한 줄로 쪼갠다. 한 줄이 곧 '그 사람이 그 대시보드를 쓸 수 있는가,
-- 몇 개까지 만들 수 있는가' 다.
--
--   enabled      — 어드민이 체크한 종류만 true. 오거나이저 로그인 화면의 바로가기도 이걸 본다.
--   max_contests — 그 대시보드에서 직접 만들 수 있는 대회 수. 공유받은 대회는 세지 않는다.
--
-- partners.max_contests 는 지우지 않고 남긴다 — 아직 배포되지 않은 대시보드가 그 값을 읽고
-- 있을 수 있어서, 새 표에 줄이 없으면 그쪽으로 물러선다(읽는 쪽에서 폴백).
-- idempotent.

create table if not exists band123.partner_dashboards (
  user_id uuid not null references band123.profiles(id) on delete cascade,
  dash text not null check (dash in ('jnj', 'battle', 'div')),
  enabled boolean not null default false,
  max_contests int not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, dash)
);

create index if not exists partner_dashboards_enabled_idx
  on band123.partner_dashboards (user_id) where enabled;

alter table band123.partner_dashboards enable row level security;

-- 본인 것만 읽는다 — 오거나이저 로그인 화면이 '내가 쓸 수 있는 대시보드'를 이걸로 그린다.
drop policy if exists partner_dashboards_own on band123.partner_dashboards;
create policy partner_dashboards_own on band123.partner_dashboards
  for select using (user_id = auth.uid());

-- 정하는 건 운영자뿐이다. 본인이 자기 한도를 올릴 수 있으면 한도가 아니다.
drop policy if exists partner_dashboards_admin on band123.partner_dashboards;
create policy partner_dashboards_admin on band123.partner_dashboards
  for all using (band123.is_admin()) with check (band123.is_admin());

-- 기존 계약을 옮겨 둔다. 개수는 쓰던 값 그대로, 사용 여부는 꺼 둔다 —
-- 어느 종류를 팔았는지는 기록이 없어서 운영자가 체크해야 알 수 있다.
insert into band123.partner_dashboards (user_id, dash, enabled, max_contests)
select p.user_id, d.dash, false, greatest(coalesce(p.max_contests, 1), 1)
  from band123.partners p
  cross join (values ('jnj'), ('battle'), ('div')) as d(dash)
 where p.status = 'active'
on conflict (user_id, dash) do nothing;

-- 이미 대회를 만들어 둔 사람은 그 종류를 쓰고 있다는 뜻이다. 켜 준다 —
-- 안 그러면 배포 직후 자기 대회가 잠긴다.
update band123.partner_dashboards pd
   set enabled = true, updated_at = now()
 where not pd.enabled
   and exists (
     select 1 from band123.dashboard_contest_access a
      where a.user_id = pd.user_id and a.dash = pd.dash
   );

comment on table band123.partner_dashboards is
  '오거나이저가 쓸 수 있는 대시보드(종류별). enabled=사용 여부, max_contests=직접 만들 수 있는 대회 수(공유받은 것은 제외).';

notify pgrst, 'reload schema';
