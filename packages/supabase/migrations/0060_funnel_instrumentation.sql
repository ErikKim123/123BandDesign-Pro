-- 0060_funnel_instrumentation.sql
-- 퍼널 계측 정비. 0057 의 세 가지 구조적 문제를 고친다.
--
-- (1) 순서를 보지 않았다 — 5개 독립 카운트였다.
--     /cart 를 먼저 보고 /shop 을 나중에 본 방문자도 두 단계 모두에 잡혀서
--     '이탈'이 실제 이탈이 아니었다 → 단계별 최초 도달 시각을 순차로 강제한다.
--
-- (2) 결제완료가 결제 성공 화면 방문에만 의존했다.
--     이 사이트는 웹훅이 나중에 확정하는 흐름이 흔하다(pending 72 vs paid 7).
--     승인 확인 중 화면을 보고 떠난 구매자는 영영 기록되지 않는다
--     → orders 를 진실의 원천으로 삼고, funnel_events 는 보조로 남긴다.
--
-- (3) 자기 도메인 referrer 노이즈 + 롤링 24시간 경계(0058 에서 traffic 만 고쳤다).
--
-- 덧붙여 사용자별 분석의 토대(visitor_identities)와 국가 축(Vercel geo)을 깐다.

-- ── 1) 주문에 방문자 흔적을 남긴다 ────────────────────────────────────────
-- 결제 시작 시점(주문 생성)에 기록한다. 웹훅이 며칠 뒤에 확정해도 귀속이 유지된다.
alter table band123.orders add column if not exists visitor_id uuid;
create index if not exists idx_orders_visitor on band123.orders (visitor_id)
  where visitor_id is not null;

-- ── 2) 방문자 ↔ 회원 매핑 ─────────────────────────────────────────────────
-- 로그인 시 1회 기록. 익명 visitor_id 로 쌓인 과거 행동을 그 회원에게 소급 귀속하고,
-- 기기가 여러 대여도 한 사람으로 합쳐 볼 수 있게 한다.
-- ⚠️ 개인정보: 회원 개인의 열람 이력과 연결되는 데이터다. 개인정보처리방침 고지 대상.
create table if not exists band123.visitor_identities (
  visitor_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (visitor_id, user_id)
);
create index if not exists idx_visitor_identities_user
  on band123.visitor_identities (user_id);

alter table band123.visitor_identities enable row level security;
drop policy if exists visitor_identities_admin_select on band123.visitor_identities;
create policy visitor_identities_admin_select on band123.visitor_identities
  for select using (band123.is_admin());
-- insert 정책 없음 — web 앱이 service_role 로만 기록한다(0056 과 동일 패턴).

-- ── 3) 국가/도시 — Vercel 이 모든 요청에 무료로 붙여주는 geo 헤더 ────────
-- Vercel Web Analytics 로 보면 orders 와 조인이 안 된다. 우리 테이블에 넣어야
-- '어느 나라 방문이 실매출로 이어졌는지'가 나온다.
alter table band123.page_views add column if not exists country text;
alter table band123.page_views add column if not exists region  text;
alter table band123.page_views add column if not exists city    text;

-- ── 4) 단계 판정을 한 곳에서 ─────────────────────────────────────────────
-- 0057(퍼널)과 0059(주간리포트)가 같은 정규식을 각자 복사해 갖고 있었다.
-- 한쪽만 고치면 두 화면의 숫자가 어긋나므로 정의를 단일화한다.
--
-- /jnj 는 일부러 넣지 않는다 — 명예의 전당·심사위원·가이드라인으로 이뤄진
-- 콘텐츠 허브라서 상품조회로 세면 2단계가 부풀려진다.
create or replace function band123.funnel_path_step(p_path text)
returns text
language sql
immutable
set search_path = band123
as $fn$
  select case
    when p_path ~ '/checkout(/|$)' and p_path !~ '/checkout/success' then 'checkout'
    when p_path ~ '/cart(/|$)'                                       then 'cart'
    when p_path ~ '/(products|events|shop)(/|$)'                     then 'product_view'
    else null
  end;
$fn$;

-- 확정 결제 = 퍼널 5단계의 진실. 세 경로로 방문자에 귀속한다.
--   a) orders.visitor_id  — 결제 시작 시점에 남긴 흔적(가장 정확)
--   b) visitor_identities — 회원이 로그인한 적이 있으면 과거 주문까지 소급
--   c) funnel_events      — 0057 이 남긴 기존 기록(하위 호환)
-- 시각은 확정 시각(paid_at)을 쓴다 — 주문 생성 시각이 아니다.
create or replace function band123.funnel_purchases(p_since timestamptz)
returns table (visitor_id uuid, occurred_at timestamptz)
language sql
stable
set search_path = band123
as $fn$
  select o.visitor_id, coalesce(o.paid_at, o.updated_at, o.created_at)
    from band123.orders o
   where o.visitor_id is not null
     and o.status in ('paid', 'shipped', 'done')
     and coalesce(o.paid_at, o.updated_at, o.created_at) >= p_since
  union
  select vi.visitor_id, coalesce(o.paid_at, o.updated_at, o.created_at)
    from band123.orders o
    join band123.visitor_identities vi on vi.user_id = o.buyer_id
   where o.visitor_id is null
     and o.status in ('paid', 'shipped', 'done')
     and coalesce(o.paid_at, o.updated_at, o.created_at) >= p_since
  union
  select fe.visitor_id, fe.created_at
    from band123.funnel_events fe
   where fe.step = 'purchase' and fe.created_at >= p_since;
$fn$;

-- ── 5) 순차 퍼널 ─────────────────────────────────────────────────────────
-- visitors : 앞 단계를 시간순으로 거친 방문자만(진짜 이탈이 보인다)
-- reached  : 순서 무시하고 그 단계에 닿기만 한 방문자(0057 과 같은 값 — 비교용)
-- is_branch: 선택 분기 단계. 주 경로 전환율 계산에서 건너뛴다.
--
-- ⚠️ 장바구니는 필수 관문이 아니다. 실제 방문자 여정을 열어보면
--      product_view ×3 → checkout ×2      (장바구니 안 거치고 바로 결제)
--      product_view ×2 → checkout → cart  (결제 시작이 장바구니보다 먼저)
--    처럼 건너뛰는 흐름이 실재한다. 장바구니를 관문으로 강제하면 결제시작이
--    실제와 무관하게 0 이 된다 → 장바구니는 분기로 두고, 결제시작은
--    '상품조회 이후'를 조건으로 삼는다.
--
-- reached/is_branch 컬럼이 늘어 반환 타입이 바뀌므로 drop 후 재생성한다.
drop function if exists band123.admin_funnel_summary(int);

create function band123.admin_funnel_summary(p_days int default 14)
returns table (step text, sort_order int, visitors bigint, reached bigint, is_branch boolean)
language plpgsql
security definer
set search_path = band123
as $fn$
declare
  v_since timestamptz := band123.traffic_window_start(p_days);
begin
  if not band123.is_admin() then
    return;
  end if;
  return query
    with pv as (
      select p.visitor_id, band123.funnel_path_step(p.path) as st, p.created_at
        from band123.page_views p
       where p.created_at >= v_since
    ),
    s1 as (
      select q.visitor_id, min(q.created_at) as t from pv q group by 1
    ),
    s2 as (
      select q.visitor_id, min(q.created_at) as t
        from pv q join s1 on s1.visitor_id = q.visitor_id
       where q.st = 'product_view' and q.created_at >= s1.t
       group by 1
    ),
    s3 as (  -- 장바구니 — 선택 분기(상품조회 이후 도달한 사람)
      select q.visitor_id, min(q.created_at) as t
        from pv q join s2 on s2.visitor_id = q.visitor_id
       where q.st = 'cart' and q.created_at >= s2.t
       group by 1
    ),
    s4 as (  -- 결제 시작 — 장바구니가 아니라 '상품조회 이후'가 조건이다(위 주석 참고)
      select q.visitor_id, min(q.created_at) as t
        from pv q join s2 on s2.visitor_id = q.visitor_id
       where q.st = 'checkout' and q.created_at >= s2.t
       group by 1
    ),
    s5 as (
      select b.visitor_id, min(b.occurred_at) as t
        from band123.funnel_purchases(v_since) b
        join s4 on s4.visitor_id = b.visitor_id
       where b.occurred_at >= s4.t
       group by 1
    ),
    reach as (
      select
        count(distinct q.visitor_id)                                        as r1,
        count(distinct q.visitor_id) filter (where q.st = 'product_view')   as r2,
        count(distinct q.visitor_id) filter (where q.st = 'cart')           as r3,
        count(distinct q.visitor_id) filter (where q.st = 'checkout')       as r4
      from pv q
    )
    select 'visit'::text, 1, (select count(*) from s1)::bigint, (select r1 from reach)::bigint, false
    union all
    select 'product_view', 2, (select count(*) from s2)::bigint, (select r2 from reach)::bigint, false
    union all
    select 'cart', 3, (select count(*) from s3)::bigint, (select r3 from reach)::bigint, true
    union all
    select 'checkout', 4, (select count(*) from s4)::bigint, (select r4 from reach)::bigint, false
    union all
    select 'purchase', 5, (select count(*) from s5)::bigint,
           (select count(distinct b.visitor_id) from band123.funnel_purchases(v_since) b)::bigint, false
    order by 2;
end;
$fn$;

-- ── 6) 유입 경로별 전환·매출 — 0058 의 수정을 여기에도 적용 ─────────────
create or replace function band123.admin_funnel_by_source(p_days int default 14, p_limit int default 10)
returns table (source text, visitors bigint, purchases bigint, revenue bigint)
language plpgsql
security definer
set search_path = band123
as $fn$
declare
  v_since timestamptz := band123.traffic_window_start(p_days);
begin
  if not band123.is_admin() then
    return;
  end if;
  return query
    with first_touch as (
      select distinct on (pv.visitor_id)
        pv.visitor_id,
        coalesce(
          nullif(btrim(coalesce(pv.utm_source, '')), ''),
          -- 자기 도메인 referrer 는 유입이 아니다(0058 과 동일 판정).
          case when band123.is_self_referrer(pv.referrer) then null
               else nullif(regexp_replace(coalesce(pv.referrer, ''), '^https?://(www\.)?([^/]+).*$', '\2'), '')
          end,
          case when coalesce(pv.launch_mode, 'browser') <> 'browser' then 'app' end,
          'direct'
        ) as source
      from band123.page_views pv
      where pv.created_at >= v_since
      order by pv.visitor_id, pv.created_at
    ),
    buys as (
      select o.visitor_id, count(*)::bigint as cnt, coalesce(sum(o.total_amount), 0)::bigint as amt
        from band123.orders o
       where o.visitor_id is not null
         and o.status in ('paid', 'shipped', 'done')
         and coalesce(o.paid_at, o.updated_at, o.created_at) >= v_since
       group by o.visitor_id
    )
    select
      ft.source,
      count(distinct ft.visitor_id)::bigint,
      coalesce(sum(b.cnt), 0)::bigint,
      coalesce(sum(b.amt), 0)::bigint
    from first_touch ft
    left join buys b on b.visitor_id = ft.visitor_id
    group by ft.source
    order by 2 desc
    limit greatest(p_limit, 1);
end;
$fn$;

-- ── 7) 주간리포트도 같은 정의를 쓰게 한다 ────────────────────────────────
-- 0059 가 정규식과 purchase 판정을 따로 복사해 갖고 있어, 안 고치면
-- 퍼널분석 화면과 주간리포트 화면의 숫자가 서로 어긋난다.
create or replace function band123.admin_weekly_funnel(p_weeks int default 8)
returns table (
  week_start date,
  visit bigint,
  product_view bigint,
  cart bigint,
  checkout bigint,
  purchase bigint
)
language plpgsql
security definer
set search_path = band123
as $fn$
declare
  v_since timestamptz := now() - (greatest(p_weeks, 1) || ' weeks')::interval;
begin
  if not band123.is_admin() then
    return;
  end if;
  return query
    with pv as (
      select
        (date_trunc('week', p.created_at at time zone 'Asia/Seoul'))::date as wk,
        p.visitor_id,
        band123.funnel_path_step(p.path) as st
      from band123.page_views p
      where p.created_at >= v_since
    ),
    t as (
      select
        q.wk,
        count(distinct q.visitor_id)::bigint as visit,
        count(distinct q.visitor_id) filter (where q.st = 'product_view')::bigint as product_view,
        count(distinct q.visitor_id) filter (where q.st = 'cart')::bigint as cart,
        count(distinct q.visitor_id) filter (where q.st = 'checkout')::bigint as checkout
      from pv q
      group by q.wk
    ),
    b as (
      select
        (date_trunc('week', p.occurred_at at time zone 'Asia/Seoul'))::date as wk,
        count(distinct p.visitor_id)::bigint as purchase
      from band123.funnel_purchases(v_since) p
      group by 1
    )
    select t.wk, t.visit, t.product_view, t.cart, t.checkout, coalesce(b.purchase, 0)
    from t left join b on b.wk = t.wk
    order by t.wk;
end;
$fn$;

revoke execute on function band123.admin_funnel_summary(int) from public;
revoke execute on function band123.admin_funnel_by_source(int, int) from public;
revoke execute on function band123.admin_weekly_funnel(int) from public;
grant execute on function band123.admin_funnel_summary(int) to authenticated;
grant execute on function band123.admin_funnel_by_source(int, int) to authenticated;
grant execute on function band123.admin_weekly_funnel(int) to authenticated;
