-- 0086_funnel_sessions_sort.sql
-- 퍼널분석 '방문 기록' 목록 정렬(머문 시간 · 화면 수 · 매출 · 도달 단계 · 방문자 · 방문 시각).
--
-- 왜 DB 에서 정렬하는가: 목록은 기간 전체(예: 296건) 중 50건만 내려간다.
--   화면에서 정렬하면 '내려온 50건 안에서만' 줄이 바뀐다 — 가장 오래 머문 방문을 찾으려고
--   눌렀는데 최근 50건 중 1등이 나오는, 답이 틀린 정렬이 된다. 그래서 order by 를 여기서 건다.
--
-- 정렬 키를 문자열로 받지만 SQL 을 이어 붙이지 않는다(주입 여지 없음).
-- 아는 값만 case 로 골라 쓰고, 모르는 값이 오면 기본값(방문 시각 내림차순)으로 떨어진다.
-- idempotent.

-- 인자가 늘어 시그니처가 바뀐다. 지우지 않으면 4인자 버전이 남아 오버로드가 되고,
-- PostgREST 가 어느 쪽을 부를지 모호해진다.
drop function if exists band123.admin_funnel_sessions(int, int, int, boolean);

create function band123.admin_funnel_sessions(
  p_days int default 14,
  p_limit int default 50,
  p_offset int default 0,
  p_only_members boolean default false,
  p_sort text default 'started',
  p_dir text default 'desc'
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

revoke execute on function band123.admin_funnel_sessions(int, int, int, boolean, text, text) from public;
grant execute on function band123.admin_funnel_sessions(int, int, int, boolean, text, text) to authenticated;
