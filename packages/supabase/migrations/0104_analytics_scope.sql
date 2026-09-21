-- 0104_analytics_scope.sql
-- 방문자수/퍼널분석 (1) 특정 날짜 창 (2) 분석 제외 계정.
--
-- (1) 방문자수 화면의 일별 막대를 누르면 그 하루의 퍼널분석으로 간다. 집계 RPC 는 지금까지
--     '오늘까지 N일' 만 받았다(p_days). 끝 날짜 p_end 를 더해 [p_end - N + 1, p_end] 를 보게 한다.
--     p_end 가 없으면 예전과 같다(오늘까지). 시그니처가 바뀌므로 옛 함수는 지운다(오버로드 모호 방지).
-- (2) 운영자가 테스트 계정으로 돌린 방문·주문은 허위 데이터다. analytics_exclusions 에 넣은
--     계정의 방문자 쿠키(visitor_identities 로 연결)와 주문을 모든 집계에서 뺀다.
--     page_views 를 지우지는 않는다 — 빼면 언제든 되돌릴 수 있고, 로그인 전 방문도 같은 쿠키라 같이 빠진다.
--     주간리포트의 주문·결제수단 통계는 매출 장부라 그대로 둔다.
--
-- 함수 본문은 0058/0059/0060/0085/0086 의 최신 정의를 그대로 가져와 창·제외 조건만 더했다.
-- idempotent.

-- ── 1) 창 ──────────────────────────────────────────────────────────────────
-- 시작: p_end(없으면 오늘 KST) 에서 N-1 일 전 0시. 끝: p_end 다음날 0시(없으면 무한).
create or replace function band123.traffic_window_start(p_days int, p_end date)
returns timestamptz
language sql
stable
set search_path = band123
as $$
  select ((coalesce(p_end, (now() at time zone 'Asia/Seoul')::date) - (greatest(p_days, 1) - 1))::timestamp
          at time zone 'Asia/Seoul');
$$;

create or replace function band123.traffic_window_end(p_end date)
returns timestamptz
language sql
stable
set search_path = band123
as $$
  select case when p_end is null then 'infinity'::timestamptz
              else ((p_end + 1)::timestamp at time zone 'Asia/Seoul') end;
$$;

-- ── 2) 분석 제외 계정 ────────────────────────────────────────────────────────
create table if not exists band123.analytics_exclusions (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  note       text,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table band123.analytics_exclusions enable row level security;
drop policy if exists analytics_exclusions_admin on band123.analytics_exclusions;
create policy analytics_exclusions_admin on band123.analytics_exclusions
  for all using (band123.is_admin()) with check (band123.is_admin());

create or replace function band123.analytics_user_excluded(p_user uuid)
returns boolean
language sql
stable
set search_path = band123
as $$
  select p_user is not null and exists (select 1 from band123.analytics_exclusions x where x.user_id = p_user);
$$;

-- 제외 계정이 로그인한 적 있는 기기(visitor_id)는 통째로 뺀다 — 로그인 전 둘러본 기록도 그 사람 것이다.
create or replace function band123.analytics_visitor_excluded(p_visitor uuid)
returns boolean
language sql
stable
set search_path = band123
as $$
  select exists (
    select 1 from band123.visitor_identities vi
    join band123.analytics_exclusions x on x.user_id = vi.user_id
    where vi.visitor_id = p_visitor
  );
$$;

-- ── 3) 옛 시그니처 제거 ───────────────────────────────────────────────────────
drop function if exists band123.admin_traffic_daily(int);
drop function if exists band123.admin_traffic_top_paths(int, int);
drop function if exists band123.admin_traffic_top_referrers(int, int);
drop function if exists band123.admin_funnel_summary(int);
drop function if exists band123.admin_funnel_by_source(int, int);
drop function if exists band123.admin_funnel_page_dwell(int, int);
drop function if exists band123.admin_funnel_step_timing(int);
drop function if exists band123.admin_funnel_sessions(int, int, int, boolean, text, text);
drop function if exists band123.admin_funnel_session_stats(int);
drop function if exists band123.admin_funnel_session_detail(uuid, int, int);
drop function if exists band123.funnel_sessionize(timestamptz);
drop function if exists band123.funnel_purchases(timestamptz);
drop function if exists band123.funnel_purchase_orders(timestamptz);

-- ── 4) 집계 RPC (창 · 제외 적용) ─────────────────────────────────────────────
create or replace function band123.admin_traffic_daily(p_days int default 14, p_end date default null)
returns table (day date, pageviews bigint, visitors bigint)
language plpgsql
security definer
set search_path = band123
as $$
begin
  if not band123.is_admin() then
    return;
  end if;
  return query
    select
      (pv.created_at at time zone 'Asia/Seoul')::date as day,
      count(*)::bigint as pageviews,
      count(distinct pv.visitor_id)::bigint as visitors
    from band123.page_views pv
    where pv.created_at >= band123.traffic_window_start(p_days, p_end)
      and pv.created_at < band123.traffic_window_end(p_end)
      and not band123.analytics_visitor_excluded(pv.visitor_id)
    group by 1
    order by 1;
end;
$$;

create or replace function band123.admin_traffic_top_paths(p_days int default 14, p_limit int default 10, p_end date default null)
returns table (path text, pageviews bigint, visitors bigint)
language plpgsql
security definer
set search_path = band123
as $$
begin
  if not band123.is_admin() then
    return;
  end if;
  return query
    select
      pv.path,
      count(*)::bigint as pageviews,
      count(distinct pv.visitor_id)::bigint as visitors
    from band123.page_views pv
    where pv.created_at >= band123.traffic_window_start(p_days, p_end)
      and pv.created_at < band123.traffic_window_end(p_end)
      and not band123.analytics_visitor_excluded(pv.visitor_id)
    group by pv.path
    order by count(*) desc
    limit greatest(p_limit, 1);
end;
$$;

create or replace function band123.admin_traffic_top_referrers(p_days int default 14, p_limit int default 10, p_end date default null)
returns table (source text, kind text, visitors bigint)
language plpgsql
security definer
set search_path = band123
as $$
begin
  if not band123.is_admin() then
    return;
  end if;
  return query
    with tagged as (
      select
        pv.visitor_id,
        case
          when band123.is_self_referrer(nullif(btrim(coalesce(pv.referrer, '')), '')) then null
          else nullif(btrim(coalesce(pv.referrer, '')), '')
        end as ref,
        -- standalone/fullscreen/minimal-ui = 홈화면에 설치된 앱으로 실행된 것.
        -- launch_mode 가 NULL 인 과거 데이터(0058 이전)는 브라우저로 간주한다.
        coalesce(pv.launch_mode, 'browser') <> 'browser' as is_app
      from band123.page_views pv
      where pv.created_at >= band123.traffic_window_start(p_days, p_end)
      and pv.created_at < band123.traffic_window_end(p_end)
      and not band123.analytics_visitor_excluded(pv.visitor_id)
    )
    select
      t.ref as source,
      case
        when t.ref is not null then 'referrer'
        when t.is_app then 'app'
        else 'direct'
      end as kind,
      count(distinct t.visitor_id)::bigint as visitors
    from tagged t
    group by 1, 2
    order by 3 desc
    limit greatest(p_limit, 1);
end;
$$;

create or replace function band123.funnel_purchases(p_since timestamptz, p_until timestamptz)
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
     and coalesce(o.paid_at, o.updated_at, o.created_at) < p_until
     and not band123.analytics_user_excluded(o.buyer_id)
  union
  select vi.visitor_id, coalesce(o.paid_at, o.updated_at, o.created_at)
    from band123.orders o
    join band123.visitor_identities vi on vi.user_id = o.buyer_id
   where o.visitor_id is null
     and o.status in ('paid', 'shipped', 'done')
     and coalesce(o.paid_at, o.updated_at, o.created_at) >= p_since
     and coalesce(o.paid_at, o.updated_at, o.created_at) < p_until
     and not band123.analytics_user_excluded(o.buyer_id)
  union
  select fe.visitor_id, fe.created_at
    from band123.funnel_events fe
   where fe.step = 'purchase' and fe.created_at >= p_since and fe.created_at < p_until
     and not band123.analytics_visitor_excluded(fe.visitor_id);
$fn$;

create or replace function band123.funnel_purchase_orders(p_since timestamptz, p_until timestamptz)
returns table (visitor_id uuid, occurred_at timestamptz, order_id uuid, amount bigint)
language sql
stable
set search_path = band123
as $fn$
  select o.visitor_id, coalesce(o.paid_at, o.updated_at, o.created_at), o.id,
         coalesce(o.total_amount, 0)::bigint
    from band123.orders o
   where o.visitor_id is not null
     and o.status in ('paid', 'shipped', 'done')
     and coalesce(o.paid_at, o.updated_at, o.created_at) >= p_since
     and coalesce(o.paid_at, o.updated_at, o.created_at) < p_until
     and not band123.analytics_user_excluded(o.buyer_id)
  union
  select vi.visitor_id, coalesce(o.paid_at, o.updated_at, o.created_at), o.id,
         coalesce(o.total_amount, 0)::bigint
    from band123.orders o
    join band123.visitor_identities vi on vi.user_id = o.buyer_id
   where o.visitor_id is null
     and o.status in ('paid', 'shipped', 'done')
     and coalesce(o.paid_at, o.updated_at, o.created_at) >= p_since
     and coalesce(o.paid_at, o.updated_at, o.created_at) < p_until
     and not band123.analytics_user_excluded(o.buyer_id);
$fn$;

create or replace function band123.funnel_sessionize(p_since timestamptz, p_until timestamptz)
returns table (
  visitor_id     uuid,
  session_no     int,
  session_start  timestamptz,
  path           text,
  step           text,
  viewed_at      timestamptz,
  dwell_sec      numeric,
  measured       boolean,
  is_exit        boolean,
  device         text,
  country        text
)
language sql
stable
set search_path = band123
as $fn$
  with base as (
    select
      p.visitor_id, p.path, p.created_at, p.dwell_ms, p.device, p.country,
      lead(p.created_at) over w as next_at,
      case
        when lag(p.created_at) over w is null then 1
        when p.created_at - lag(p.created_at) over w > interval '30 minutes' then 1
        else 0
      end as boundary
    from band123.page_views p
    where p.created_at >= p_since and p.created_at < p_until
      and not band123.analytics_visitor_excluded(p.visitor_id)
    window w as (partition by p.visitor_id order by p.created_at)
  ),
  marked as (
    select
      b.visitor_id, b.path, b.created_at, b.dwell_ms, b.device, b.country, b.next_at,
      sum(b.boundary) over (
        partition by b.visitor_id order by b.created_at rows unbounded preceding
      )::int as session_no,
      -- 다음 조회가 30분 넘게 떨어져 있으면 같은 방문이 아니다 → 여기서 방문이 끝난다.
      (b.next_at is null or b.next_at - b.created_at > interval '30 minutes') as ends_here
    from base b
  )
  select
    m.visitor_id,
    m.session_no,
    min(m.created_at) over (partition by m.visitor_id, m.session_no) as session_start,
    m.path,
    band123.funnel_path_step(m.path) as step,
    m.created_at as viewed_at,
    -- 이상치를 자른다: 음수·1시간 초과 한 건이 평균을 통째로 망가뜨린다.
    least(
      greatest(
        coalesce(
          nullif(m.dwell_ms, 0) / 1000.0,
          case when not m.ends_here then extract(epoch from (m.next_at - m.created_at)) end
        ),
        0
      ),
      3600
    )::numeric as dwell_sec,
    m.dwell_ms is not null as measured,
    m.ends_here as is_exit,
    m.device,
    m.country
  from marked m;
$fn$;

create or replace function band123.admin_funnel_summary(p_days int default 14, p_end date default null)
returns table (step text, sort_order int, visitors bigint, reached bigint, is_branch boolean)
language plpgsql
security definer
set search_path = band123
as $fn$
declare
  v_since timestamptz := band123.traffic_window_start(p_days, p_end);
  v_until timestamptz := band123.traffic_window_end(p_end);
begin
  if not band123.is_admin() then
    return;
  end if;
  return query
    with pv as (
      select p.visitor_id, band123.funnel_path_step(p.path) as st, p.created_at
        from band123.page_views p
       where p.created_at >= v_since and p.created_at < v_until
         and not band123.analytics_visitor_excluded(p.visitor_id)
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
        from band123.funnel_purchases(v_since, v_until) b
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
           (select count(distinct b.visitor_id) from band123.funnel_purchases(v_since, v_until) b)::bigint, false
    order by 2;
end;
$fn$;

create or replace function band123.admin_funnel_by_source(p_days int default 14, p_limit int default 10, p_end date default null)
returns table (source text, visitors bigint, purchases bigint, revenue bigint)
language plpgsql
security definer
set search_path = band123
as $fn$
declare
  v_since timestamptz := band123.traffic_window_start(p_days, p_end);
  v_until timestamptz := band123.traffic_window_end(p_end);
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
      where pv.created_at >= v_since and pv.created_at < v_until
        and not band123.analytics_visitor_excluded(pv.visitor_id)
      order by pv.visitor_id, pv.created_at
    ),
    buys as (
      select o.visitor_id, count(*)::bigint as cnt, coalesce(sum(o.total_amount), 0)::bigint as amt
        from band123.orders o
       where o.visitor_id is not null
         and o.status in ('paid', 'shipped', 'done')
         and coalesce(o.paid_at, o.updated_at, o.created_at) >= v_since
         and coalesce(o.paid_at, o.updated_at, o.created_at) < v_until
         and not band123.analytics_user_excluded(o.buyer_id)
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

create or replace function band123.admin_funnel_page_dwell(p_days int default 14, p_limit int default 20, p_end date default null)
returns table (
  path          text,
  step          text,
  pageviews     bigint,
  visitors      bigint,
  avg_sec       numeric,
  median_sec    numeric,
  total_sec     numeric,
  exits         bigint,
  exit_rate     numeric,
  measured_rate numeric
)
language plpgsql
security definer
set search_path = band123
as $fn$
declare
  v_since timestamptz := band123.traffic_window_start(p_days, p_end);
  v_until timestamptz := band123.traffic_window_end(p_end);
begin
  if not band123.is_admin() then
    return;
  end if;
  return query
    select
      s.path,
      max(s.step) as step,
      count(*)::bigint as pageviews,
      count(distinct s.visitor_id)::bigint as visitors,
      round(avg(s.dwell_sec) filter (where s.dwell_sec is not null), 1) as avg_sec,
      round(
        (percentile_cont(0.5) within group (order by s.dwell_sec)
          filter (where s.dwell_sec is not null))::numeric,
        1
      ) as median_sec,
      round(coalesce(sum(s.dwell_sec), 0), 0) as total_sec,
      count(*) filter (where s.is_exit)::bigint as exits,
      round(count(*) filter (where s.is_exit)::numeric / nullif(count(*), 0), 4) as exit_rate,
      round(count(*) filter (where s.measured)::numeric / nullif(count(*), 0), 4) as measured_rate
    from band123.funnel_sessionize(v_since, v_until) s
    group by s.path
    order by count(*) desc
    limit greatest(p_limit, 1);
end;
$fn$;

create or replace function band123.admin_funnel_step_timing(p_days int default 14, p_end date default null)
returns table (
  from_step  text,
  to_step    text,
  samples    bigint,
  median_sec numeric,
  avg_sec    numeric,
  p90_sec    numeric
)
language plpgsql
security definer
set search_path = band123
as $fn$
declare
  v_since timestamptz := band123.traffic_window_start(p_days, p_end);
  v_until timestamptz := band123.traffic_window_end(p_end);
begin
  if not band123.is_admin() then
    return;
  end if;
  return query
    with pv as (
      select p.visitor_id as vid, band123.funnel_path_step(p.path) as st, p.created_at as at
        from band123.page_views p
       where p.created_at >= v_since and p.created_at < v_until
         and not band123.analytics_visitor_excluded(p.visitor_id)
    ),
    t1 as (select q.vid, min(q.at) as t from pv q group by 1),
    t2 as (
      select q.vid, min(q.at) as t from pv q join t1 on t1.vid = q.vid
       where q.st = 'product_view' and q.at >= t1.t group by 1
    ),
    t3 as (
      select q.vid, min(q.at) as t from pv q join t2 on t2.vid = q.vid
       where q.st = 'cart' and q.at >= t2.t group by 1
    ),
    t4 as (
      select q.vid, min(q.at) as t from pv q join t2 on t2.vid = q.vid
       where q.st = 'checkout' and q.at >= t2.t group by 1
    ),
    t5 as (
      select b.visitor_id as vid, min(b.occurred_at) as t
        from band123.funnel_purchases(v_since, v_until) b join t4 on t4.vid = b.visitor_id
       where b.occurred_at >= t4.t group by 1
    ),
    legs as (
      select 'visit'::text as f, 'product_view'::text as tt,
             extract(epoch from (t2.t - t1.t))::numeric as d
        from t2 join t1 on t1.vid = t2.vid
      union all
      select 'product_view', 'cart', extract(epoch from (t3.t - t2.t))::numeric
        from t3 join t2 on t2.vid = t3.vid
      union all
      select 'product_view', 'checkout', extract(epoch from (t4.t - t2.t))::numeric
        from t4 join t2 on t2.vid = t4.vid
      union all
      select 'checkout', 'purchase', extract(epoch from (t5.t - t4.t))::numeric
        from t5 join t4 on t4.vid = t5.vid
    )
    select
      l.f, l.tt,
      count(*)::bigint,
      round((percentile_cont(0.5) within group (order by l.d))::numeric, 0),
      round(avg(l.d), 0),
      round((percentile_cont(0.9) within group (order by l.d))::numeric, 0)
    from legs l
    group by l.f, l.tt
    order by case l.tt when 'product_view' then 1 when 'cart' then 2
                       when 'checkout' then 3 else 4 end;
end;
$fn$;

create or replace function band123.admin_funnel_sessions(
  p_days int default 14,
  p_limit int default 50,
  p_offset int default 0,
  p_only_members boolean default false,
  p_sort text default 'started',
  p_dir text default 'desc',
  p_end date default null
)
returns table (
  visitor_id    uuid,
  session_no    int,
  user_id       uuid,
  user_name     text,
  user_email    text,
  started_at    timestamptz,
  ended_at      timestamptz,
  duration_sec  numeric,
  pageviews     bigint,
  entry_path    text,
  exit_path     text,
  max_step      text,
  converted     boolean,
  revenue       bigint,
  device        text,
  country       text,
  total_count   bigint
)
language plpgsql
security definer
set search_path = band123
as $fn$
declare
  v_since timestamptz := band123.traffic_window_start(p_days, p_end);
  v_until timestamptz := band123.traffic_window_end(p_end);
  -- 아는 값만 통과시킨다. 그 외에는 기본값으로.
  v_sort text := case
    when p_sort in ('visitor', 'started', 'duration', 'pageviews', 'step', 'revenue') then p_sort
    else 'started'
  end;
  v_asc boolean := lower(coalesce(p_dir, '')) = 'asc';
begin
  if not band123.is_admin() then
    return;
  end if;
  return query
    with s as (
      select * from band123.funnel_sessionize(v_since, v_until)
    ),
    agg as (
      select
        s.visitor_id as vid, s.session_no as sno,
        min(s.viewed_at) as started_at,
        -- 마지막 화면의 체류시간까지 더해야 '머문 시간'이 된다(마지막 조회 시각이 아니라).
        max(s.viewed_at)
          + (coalesce(max(s.dwell_sec) filter (where s.is_exit), 0) || ' seconds')::interval
          as ended_at,
        count(*)::bigint as pageviews,
        -- 배열 트릭: 시각과 경로를 함께 담아 min/max 를 취하면 첫/마지막 화면의 경로가 나온다.
        (min(array[s.viewed_at::text, s.path]))[2] as entry_path,
        (max(array[s.viewed_at::text, s.path]))[2] as exit_path,
        max(case s.step when 'checkout' then 4 when 'cart' then 3
                        when 'product_view' then 2 else 1 end) as step_rank,
        max(s.device) as device,
        max(s.country) as country
      from s
      group by s.visitor_id, s.session_no
    ),
    bounded as (
      -- 이 방문에 귀속할 결제의 시간 창 = 방문 시작 ~ 다음 방문 시작.
      -- 결제 확정이 웹훅으로 며칠 뒤에 와도(0060) 그 사이에 다른 방문이 없으면 이 방문의 성과다.
      select a.*, lead(a.started_at) over (partition by a.vid order by a.sno) as next_start
      from agg a
    ),
    buys as (
      select b.vid, b.sno,
             count(*)::bigint as cnt,
             coalesce(sum(o.amount), 0)::bigint as amt
      from bounded b
      join band123.funnel_purchase_orders(v_since, v_until) o
        on o.visitor_id = b.vid
       and o.occurred_at >= b.started_at
       and (b.next_start is null or o.occurred_at < b.next_start)
      group by b.vid, b.sno
    ),
    ident as (
      -- 한 방문자에 회원이 여럿 붙는 일은 드물지만(공용 기기), 있으면 최근 로그인 1명.
      select distinct on (vi.visitor_id) vi.visitor_id as vid, vi.user_id as uid
        from band123.visitor_identities vi
       order by vi.visitor_id, vi.last_seen_at desc
    ),
    joined as (
      select
        b.vid, b.sno, i.uid, pr.name as uname, pr.email as uemail,
        b.started_at as st, b.ended_at as et,
        round(extract(epoch from (b.ended_at - b.started_at))::numeric, 0) as dur,
        b.pageviews as pvs, b.entry_path as ep, b.exit_path as xp,
        case when coalesce(y.cnt, 0) > 0 then 'purchase'
             else (array['visit','product_view','cart','checkout'])[b.step_rank] end as mstep,
        coalesce(y.cnt, 0) > 0 as conv,
        coalesce(y.amt, 0)::bigint as rev,
        b.device as dev, b.country as ctry,
        -- 결제까지 간 방문은 4단계(결제 시작)보다 위다. 단계 정렬은 이 값을 쓴다.
        case when coalesce(y.cnt, 0) > 0 then 5 else b.step_rank end as srank
      from bounded b
      left join ident i on i.vid = b.vid
      left join band123.profiles pr on pr.id = i.uid
      left join buys y on y.vid = b.vid and y.sno = b.sno
      where not p_only_members or i.uid is not null
    ),
    keyed as (
      select j.*,
        case v_sort
          when 'duration'  then j.dur
          when 'pageviews' then j.pvs::numeric
          when 'revenue'   then j.rev::numeric
          when 'step'      then j.srank::numeric
          else extract(epoch from j.st)::numeric   -- 'started'
        end as sort_num,
        -- 이름 정렬만 문자열이다. 익명 방문자는 이름이 없어 NULL → 항상 뒤로 간다.
        lower(coalesce(nullif(j.uname, ''), j.uemail)) as sort_txt
      from joined j
    )
    select
      k.vid, k.sno, k.uid, k.uname, k.uemail, k.st, k.et, k.dur, k.pvs,
      k.ep, k.xp, k.mstep, k.conv, k.rev, k.dev, k.ctry,
      (select count(*) from joined)::bigint
    from keyed k
    order by
      -- 활성화되지 않은 절은 전부 NULL 이라 정렬에 영향을 주지 않는다.
      case when v_sort = 'visitor' and     v_asc then k.sort_txt end asc  nulls last,
      case when v_sort = 'visitor' and not v_asc then k.sort_txt end desc nulls last,
      case when v_sort <> 'visitor' and     v_asc then k.sort_num end asc  nulls last,
      case when v_sort <> 'visitor' and not v_asc then k.sort_num end desc nulls last,
      k.st desc   -- 동점이면 최근 방문이 위로
    limit greatest(p_limit, 1) offset greatest(p_offset, 0);
end;
$fn$;

create or replace function band123.admin_funnel_session_stats(p_days int default 14, p_end date default null)
returns table (
  sessions        bigint,
  visitors        bigint,
  members         bigint,
  avg_duration    numeric,
  median_duration numeric,
  avg_pageviews   numeric,
  bounce_rate     numeric
)
language plpgsql
security definer
set search_path = band123
as $fn$
declare
  v_since timestamptz := band123.traffic_window_start(p_days, p_end);
  v_until timestamptz := band123.traffic_window_end(p_end);
begin
  if not band123.is_admin() then
    return;
  end if;
  return query
    with agg as (
      select
        s.visitor_id as vid,
        s.session_no as sno,
        count(*) as pvs,
        extract(epoch from (
          max(s.viewed_at)
            + (coalesce(max(s.dwell_sec) filter (where s.is_exit), 0) || ' seconds')::interval
            - min(s.viewed_at)
        ))::numeric as dur
      from band123.funnel_sessionize(v_since, v_until) s
      group by 1, 2
    )
    select
      count(*)::bigint,
      count(distinct a.vid)::bigint,
      (select count(distinct vi.visitor_id) from band123.visitor_identities vi
        where vi.visitor_id in (select a2.vid from agg a2))::bigint,
      round(avg(a.dur), 0),
      round((percentile_cont(0.5) within group (order by a.dur))::numeric, 0),
      round(avg(a.pvs), 2),
      round(count(*) filter (where a.pvs = 1)::numeric / nullif(count(*), 0), 4)
    from agg a;
end;
$fn$;

create or replace function band123.admin_funnel_session_detail(
  p_visitor uuid,
  p_session_no int,
  p_days int default 14,
  p_end date default null
)
returns table (
  seq       int,
  path      text,
  step      text,
  viewed_at timestamptz,
  dwell_sec numeric,
  measured  boolean,
  is_exit   boolean
)
language plpgsql
security definer
set search_path = band123
as $fn$
declare
  v_since timestamptz := band123.traffic_window_start(p_days, p_end);
  v_until timestamptz := band123.traffic_window_end(p_end);
begin
  if not band123.is_admin() then
    return;
  end if;
  return query
    select
      (row_number() over (order by s.viewed_at))::int,
      s.path, s.step, s.viewed_at, s.dwell_sec, s.measured, s.is_exit
    from band123.funnel_sessionize(v_since, v_until) s
    where s.visitor_id = p_visitor and s.session_no = p_session_no
    order by s.viewed_at;
end;
$fn$;

create or replace function band123.admin_weekly_traffic(p_weeks int default 8)
returns table (week_start date, visitors bigint, pageviews bigint)
language plpgsql
security definer
set search_path = band123
as $$
begin
  if not band123.is_admin() then
    return;
  end if;
  return query
    select
      (date_trunc('week', pv.created_at at time zone 'Asia/Seoul'))::date as week_start,
      count(distinct pv.visitor_id)::bigint,
      count(*)::bigint
    from band123.page_views pv
    where pv.created_at >= now() - (greatest(p_weeks, 1) || ' weeks')::interval
      and not band123.analytics_visitor_excluded(pv.visitor_id)
    group by 1
    order by 1;
end;
$$;

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
        and not band123.analytics_visitor_excluded(p.visitor_id)
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
      from band123.funnel_purchases(v_since, 'infinity'::timestamptz) p
      group by 1
    )
    select t.wk, t.visit, t.product_view, t.cart, t.checkout, coalesce(b.purchase, 0)
    from t left join b on b.wk = t.wk
    order by t.wk;
end;
$fn$;

-- ── 5) 권한 ──────────────────────────────────────────────────────────────────
revoke execute on function band123.admin_traffic_daily(int, date) from public;
revoke execute on function band123.admin_traffic_top_paths(int, int, date) from public;
revoke execute on function band123.admin_traffic_top_referrers(int, int, date) from public;
revoke execute on function band123.admin_funnel_summary(int, date) from public;
revoke execute on function band123.admin_funnel_by_source(int, int, date) from public;
revoke execute on function band123.admin_funnel_page_dwell(int, int, date) from public;
revoke execute on function band123.admin_funnel_step_timing(int, date) from public;
revoke execute on function band123.admin_funnel_sessions(int, int, int, boolean, text, text, date) from public;
revoke execute on function band123.admin_funnel_session_stats(int, date) from public;
revoke execute on function band123.admin_funnel_session_detail(uuid, int, int, date) from public;
grant execute on function band123.admin_traffic_daily(int, date) to authenticated;
grant execute on function band123.admin_traffic_top_paths(int, int, date) to authenticated;
grant execute on function band123.admin_traffic_top_referrers(int, int, date) to authenticated;
grant execute on function band123.admin_funnel_summary(int, date) to authenticated;
grant execute on function band123.admin_funnel_by_source(int, int, date) to authenticated;
grant execute on function band123.admin_funnel_page_dwell(int, int, date) to authenticated;
grant execute on function band123.admin_funnel_step_timing(int, date) to authenticated;
grant execute on function band123.admin_funnel_sessions(int, int, int, boolean, text, text, date) to authenticated;
grant execute on function band123.admin_funnel_session_stats(int, date) to authenticated;
grant execute on function band123.admin_funnel_session_detail(uuid, int, int, date) to authenticated;

notify pgrst, 'reload schema';
