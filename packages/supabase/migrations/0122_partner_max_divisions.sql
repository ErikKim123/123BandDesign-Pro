-- 0122: 계약에 '대회 하나당 디비전 몇 개까지' 를 더한다
--
-- 0121 은 종류별로 '대회 몇 개까지' 만 적을 수 있었다. 그런데 대시보드에서 실제로 늘어나는 건
-- 대회보다 디비전이다 — 대회 하나를 열어 두고 부문을 계속 만들면 계약한 규모를 넘어선다.
--
-- 세는 단위는 '대회 하나당' 이다. 오거나이저 전체 합계로 두면 대회를 두 개 가진 사람이
-- 첫 대회에 다 써 버려 두 번째 대회를 열 수 없게 된다 — 계약은 '행사 한 건의 규모' 에 가깝다.
--
--   max_divisions — 그 대시보드에서 대회 하나에 만들 수 있는 디비전 수. 기본 2.
--
-- 기존 줄에도 기본값이 들어간다. 이미 2개를 넘겨 만들어 둔 대회는 건드리지 않는다 —
-- 한도는 '더 만들 때' 만 본다(읽는 쪽에서 새로 만드는 것만 막는다).
-- idempotent.

alter table band123.partner_dashboards
  add column if not exists max_divisions int not null default 2;

comment on column band123.partner_dashboards.max_divisions is
  '대회 하나당 만들 수 있는 디비전 수. 이미 만들어 둔 것은 줄이지 않고, 새로 만들 때만 막는다.';

notify pgrst, 'reload schema';
