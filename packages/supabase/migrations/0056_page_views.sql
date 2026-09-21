-- 0056_page_views.sql
-- 어드민 방문자수/트래픽수 메뉴 — web(공개 사이트) 방문 기록 + 집계 RPC.
--
-- 수집: web 앱이 페이지 렌더마다 /api/track 을 호출해 service_role 로 INSERT 한다
--       (비로그인 방문자가 대부분이라 RLS insert 정책 대신 서버 라우트에서만 쓰게 한다).
-- 방문자 식별: 로그인 여부와 무관하게 미들웨어가 발급하는 익명 visitor_id 쿠키(1년)로 집계한다.
-- 조회: 어드민만 — SECURITY DEFINER RPC 안에서 band123.is_admin() 확인 (0047 등과 동일 패턴).

create table if not exists band123.page_views (
  id bigint generated always as identity primary key,
  visitor_id uuid not null,
  path text not null,
  referrer text,
  user_agent text,
  device text,
  created_at timestamptz not null default now()
);

create index if not exists idx_page_views_created_at
  on band123.page_views (created_at desc);
create index if not exists idx_page_views_visitor_created
  on band123.page_views (visitor_id, created_at);
create index if not exists idx_page_views_path_created
  on band123.page_views (path, created_at);

alter table band123.page_views enable row level security;

-- 직접 조회(어드민 세션)도 가능하게 열어둔다. 실제 조회는 아래 RPC 를 쓴다.
drop policy if exists page_views_admin_select on band123.page_views;
create policy page_views_admin_select on band123.page_views
  for select using (band123.is_admin());
-- insert 정책 없음 — web 앱 API 라우트가 service_role 로만 기록한다(RLS 우회).

-- 일자별 방문자수(순 방문자)·페이지뷰수. KST 기준으로 날짜를 자른다.
create or replace function band123.admin_traffic_daily(p_days int default 14)
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
    where pv.created_at >= now() - (greatest(p_days, 1) || ' days')::interval
    group by 1
    order by 1;
end;
$$;

-- 기간 내 조회수 상위 경로.
create or replace function band123.admin_traffic_top_paths(p_days int default 14, p_limit int default 10)
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
    where pv.created_at >= now() - (greatest(p_days, 1) || ' days')::interval
    group by pv.path
    order by count(*) desc
    limit greatest(p_limit, 1);
end;
$$;

-- 기간 내 유입 경로(referrer) 상위. referrer 가 없으면 NULL로 돌려주고 프론트에서 "직접 접속" 라벨을 붙인다.
create or replace function band123.admin_traffic_top_referrers(p_days int default 14, p_limit int default 10)
returns table (referrer text, visitors bigint)
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
      nullif(btrim(coalesce(pv.referrer, '')), '') as referrer,
      count(distinct pv.visitor_id)::bigint as visitors
    from band123.page_views pv
    where pv.created_at >= now() - (greatest(p_days, 1) || ' days')::interval
    group by 1
    order by 2 desc
    limit greatest(p_limit, 1);
end;
$$;

revoke execute on function band123.admin_traffic_daily(int) from public;
revoke execute on function band123.admin_traffic_top_paths(int, int) from public;
revoke execute on function band123.admin_traffic_top_referrers(int, int) from public;
grant execute on function band123.admin_traffic_daily(int) to authenticated;
grant execute on function band123.admin_traffic_top_paths(int, int) to authenticated;
grant execute on function band123.admin_traffic_top_referrers(int, int) to authenticated;
