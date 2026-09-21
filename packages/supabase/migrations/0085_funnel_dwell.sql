-- 0085_funnel_dwell.sql
-- 퍼널 심화 — "어떤 사람이 · 어느 화면을 · 몇 분 봤는지".
--
-- 0056~0060 이 만든 것: 방문자 쿠키(page_views) · 회원 매핑(visitor_identities) ·
--   순차 퍼널(admin_funnel_summary) · 유입→매출 귀속(admin_funnel_by_source).
-- 없던 것은 시간 축이다. 한 방문자가 화면에 얼마나 머물렀는지, 단계 사이에 몇 분이
--   걸렸는지, 한 번의 방문이 어떤 화면 순서로 흘러 어디서 끝났는지가 전혀 없었다.
--
-- 체류시간을 어떻게 아는가 — 두 출처를 겹쳐 쓴다.
--   (측정) page_views.dwell_ms : 화면이 실제로 '보이던' 시간을 브라우저가 재서 보낸다.
--          탭을 숨기면 시계를 멈추므로, 열어두고 자리를 비운 시간이 섞이지 않는다.
--   (추정) 다음 조회까지의 간격 : 측정값이 없는 행(과거 데이터 · 비콘 유실)의 대체값.
--          방문의 마지막 화면은 '다음'이 없어 추정이 불가능하다 → 측정값이 있어야만 잡힌다.
--   두 값을 섞으므로 화면마다 '측정 비율'을 같이 돌려준다. 숫자를 믿을지 판단하라고.
--
-- 방문(세션) 정의: 같은 방문자의 연속 조회 중 간격이 30분을 넘으면 새 방문으로 끊는다.
--
-- ⚠️ 개인정보: 회원 1명의 화면별 열람 이력을 어드민이 열어보게 된다.
--    0060 의 visitor_identities 와 같은 고지 대상이다(개인정보처리방침 반영 필요).
-- idempotent.

-- ── 1) 측정된 체류시간 ────────────────────────────────────────────────────
-- 밀리초. 브라우저가 화면을 떠날 때 1회 보낸다(없으면 NULL — 추정으로 대체된다).
alter table band123.page_views add column if not exists dwell_ms int;

-- 세션 조립은 (방문자, 시각) 순서로 훑는다 — 0056 의 인덱스를 그대로 쓴다.

-- ── 2) 세션 조립 ─────────────────────────────────────────────────────────
-- 모든 심화 집계가 이 함수 하나를 딛는다. 세션 경계·체류시간 판정이 여기 한 곳에만
-- 있어야 화면마다 숫자가 어긋나지 않는다(0060 이 단계 정규식을 단일화한 것과 같은 이유).
create or replace function band123.funnel_sessionize(p_since timestamptz)
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
    where p.created_at >= p_since
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

-- 확정 결제를 금액까지 들고 온다. 0060 funnel_purchases 는 (방문자, 시각) 만 주는데
-- 방문별 매출을 붙이려면 주문 금액이 필요하다. 귀속 경로는 0060 과 동일하다.
create or replace function band123.funnel_purchase_orders(p_since timestamptz)
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
  union
  select vi.visitor_id, coalesce(o.paid_at, o.updated_at, o.created_at), o.id,
         coalesce(o.total_amount, 0)::bigint
    from band123.orders o
    join band123.visitor_identities vi on vi.user_id = o.buyer_id
   where o.visitor_id is null
     and o.status in ('paid', 'shipped', 'done')
     and coalesce(o.paid_at, o.updated_at, o.created_at) >= p_since;
$fn$;

-- ── 3) 화면별 체류시간 ───────────────────────────────────────────────────
-- 평균만 보면 한 명이 오래 켜둔 화면이 1등이 된다 → 중앙값을 같이 준다.
-- 이탈률(이 화면에서 방문이 끝난 비율)이 함께 있어야 '오래 봤다'가
-- 정독인지 헤맨 것인지 갈린다.
create or replace function band123.admin_funnel_page_dwell(p_days int default 14, p_limit int default 20)
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
  v_since timestamptz := band123.traffic_window_start(p_days);
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
    from band123.funnel_sessionize(v_since) s
    group by s.path
    order by count(*) desc
    limit greatest(p_limit, 1);
end;
$fn$;

-- ── 4) 단계 사이에 걸린 시간 ─────────────────────────────────────────────
-- 전환율은 '몇 명이 넘어갔나'만 말한다. '넘어가는 데 얼마나 걸렸나'가 붙어야
-- 망설임이 보인다. 방문자별 단계 최초 도달 시각의 차이를 쓴다(0060 순차 퍼널과 같은 기준).
create or replace function band123.admin_funnel_step_timing(p_days int default 14)
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
  v_since timestamptz := band123.traffic_window_start(p_days);
begin
  if not band123.is_admin() then
    return;
  end if;
  return query
    with pv as (
      select p.visitor_id as vid, band123.funnel_path_step(p.path) as st, p.created_at as at
        from band123.page_views p
       where p.created_at >= v_since
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
        from band123.funnel_purchases(v_since) b join t4 on t4.vid = b.visitor_id
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

-- ── 5) 방문 목록 — "누가 언제 와서 무엇을 보고 어디서 나갔나" ────────────
-- 로그인한 적 있는 방문자는 회원 이름이 붙고, 아닌 사람은 익명 방문자로 남는다.
-- 한 사람이 기기를 여러 대 써도 visitor_identities 가 회원 하나로 묶어준다(0060).
create or replace function band123.admin_funnel_sessions(
  p_days int default 14,
  p_limit int default 50,
  p_offset int default 0,
  p_only_members boolean default false
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
  v_since timestamptz := band123.traffic_window_start(p_days);
begin
  if not band123.is_admin() then
    return;
  end if;
  return query
    with s as (
      select * from band123.funnel_sessionize(v_since)
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
      join band123.funnel_purchase_orders(v_since) o
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
        b.device as dev, b.country as ctry
      from bounded b
      left join ident i on i.vid = b.vid
      left join band123.profiles pr on pr.id = i.uid
      left join buys y on y.vid = b.vid and y.sno = b.sno
      where not p_only_members or i.uid is not null
    )
    select
      j.vid, j.sno, j.uid, j.uname, j.uemail, j.st, j.et, j.dur, j.pvs,
      j.ep, j.xp, j.mstep, j.conv, j.rev, j.dev, j.ctry,
      (select count(*) from joined)::bigint
    from joined j
    order by j.st desc
    limit greatest(p_limit, 1) offset greatest(p_offset, 0);
end;
$fn$;

-- ── 5-1) 방문 전체의 요약 지표 ───────────────────────────────────────────
-- 목록은 최근 50건만 보여주므로 평균을 목록에서 내면 최근에 치우친다 → 기간 전체로 따로 낸다.
-- 이탈방문(bounce)은 화면 하나만 보고 끝난 방문 — 퍼널 1단계가 새는 양을 가장 직접 말해준다.
create or replace function band123.admin_funnel_session_stats(p_days int default 14)
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
  v_since timestamptz := band123.traffic_window_start(p_days);
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
      from band123.funnel_sessionize(v_since) s
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

-- ── 6) 방문 1건의 화면 순서 ──────────────────────────────────────────────
-- 목록에서 한 줄을 펼치면 나오는 여정. 화면 · 머문 시간 · 퍼널 단계.
create or replace function band123.admin_funnel_session_detail(
  p_visitor uuid,
  p_session_no int,
  p_days int default 14
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
  v_since timestamptz := band123.traffic_window_start(p_days);
begin
  if not band123.is_admin() then
    return;
  end if;
  return query
    select
      (row_number() over (order by s.viewed_at))::int,
      s.path, s.step, s.viewed_at, s.dwell_sec, s.measured, s.is_exit
    from band123.funnel_sessionize(v_since) s
    where s.visitor_id = p_visitor and s.session_no = p_session_no
    order by s.viewed_at;
end;
$fn$;

-- ── 7) 권한 ──────────────────────────────────────────────────────────────
revoke execute on function band123.admin_funnel_page_dwell(int, int) from public;
revoke execute on function band123.admin_funnel_step_timing(int) from public;
revoke execute on function band123.admin_funnel_sessions(int, int, int, boolean) from public;
revoke execute on function band123.admin_funnel_session_stats(int) from public;
revoke execute on function band123.admin_funnel_session_detail(uuid, int, int) from public;
grant execute on function band123.admin_funnel_page_dwell(int, int) to authenticated;
grant execute on function band123.admin_funnel_step_timing(int) to authenticated;
grant execute on function band123.admin_funnel_sessions(int, int, int, boolean) to authenticated;
grant execute on function band123.admin_funnel_session_stats(int) to authenticated;
grant execute on function band123.admin_funnel_session_detail(uuid, int, int) to authenticated;
