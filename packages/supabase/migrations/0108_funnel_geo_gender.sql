-- 0108: 퍼널 방문 기록에 도시 · 성별
--
-- 방문 기록은 기기·국가까지만 보여 줬다. 도시(page_views.city, 0060 부터 Vercel 헤더로 쌓임)와
-- 회원 성별을 같이 보이게 한다. 성별은 지금까지 어디에도 없던 값이라 profiles.gender 를 새로 두고
-- 가입 화면·프로필 수정에서 선택(선택 사항)으로 받는다. 익명 방문자는 당연히 null.
-- 반환 컬럼이 늘어나므로 두 함수는 drop 후 재생성(create or replace 는 반환형 변경 불가). 본문은 0104 그대로.
-- idempotent.

alter table band123.profiles add column if not exists gender text
  check (gender in ('female', 'male', 'other'));
comment on column band123.profiles.gender is '성별(선택) — female | male | other. 가입·프로필 수정에서 본인이 고른다.';

drop function if exists band123.admin_funnel_sessions(int, int, int, boolean, text, text, date);
drop function if exists band123.funnel_sessionize(timestamptz, timestamptz);

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
  country        text,
  city           text
)
language sql
stable
set search_path = band123
as $fn$
  with base as (
    select
      p.visitor_id, p.path, p.created_at, p.dwell_ms, p.device, p.country, p.city,
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
      b.visitor_id, b.path, b.created_at, b.dwell_ms, b.device, b.country, b.city, b.next_at,
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
    m.country,
    m.city
  from marked m;
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
  city          text,
  gender        text,
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
        max(s.country) as country,
        max(s.city) as city
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
        b.device as dev, b.country as ctry, b.city as cty, pr.gender as gndr,
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
      k.ep, k.xp, k.mstep, k.conv, k.rev, k.dev, k.ctry, k.cty, k.gndr,
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

revoke execute on function band123.admin_funnel_sessions(int, int, int, boolean, text, text, date) from public;
grant execute on function band123.admin_funnel_sessions(int, int, int, boolean, text, text, date) to authenticated;

notify pgrst, 'reload schema';
