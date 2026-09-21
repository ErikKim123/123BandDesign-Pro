-- 0058_traffic_launch_mode.sql
-- (1) 유입 경로에 "설치형 앱(홈화면 추가)" / "북마크·직접입력" 구분 추가
-- (2) 기간(7/14/30일) 경계를 세 집계 RPC 전부 KST 달력일 기준으로 통일
--
-- (1) 배경: 0056 은 referrer 가 비면 전부 "직접 접속" 한 덩어리로 보여줬다. 그 안에는
--   (a) 홈화면에 설치한 PWA 로 실행,
--   (b) 북마크 / 주소창 직접입력,
--   (c) referrer 가 제거된 유입(메신저 인앱브라우저, https→http 등)
-- 이 섞여 있다.
--
-- (a) 는 브라우저 display-mode 로 정확히 구분된다 → 비콘이 launch_mode 에 기록한다.
-- (b) 와 (c) 는 브라우저가 구분 수단을 전혀 주지 않는다(북마크 클릭을 알려주는 API 는 없다).
--     → 억지로 나누지 않고 "북마크/직접입력" 으로 함께 묶어 정직하게 표기한다.

alter table band123.page_views add column if not exists launch_mode text;

-- ── (2) 기간 경계 통일 ────────────────────────────────────────────────────────
-- 0056 은 세 RPC 모두 now() - N days, 즉 "지금부터 롤링 N×24시간" 을 썼다.
-- 반면 화면의 일별 추이 그래프는 KST 달력일 N개를 그린다(어드민이 byDay 로 다시 버킷팅).
-- 그래서 표에는 그래프에 없는 하루치 앞부분이 섞여 들어가, 데이터가 쌓이면
-- "그래프 합계 ≠ 표 합계" 로 드러난다. 시작 시각을 한 곳에서 정의해 셋 다 맞춘다.
create or replace function band123.traffic_window_start(p_days int)
returns timestamptz
language sql
stable
set search_path = band123
as $$
  select (((now() at time zone 'Asia/Seoul')::date - (greatest(p_days, 1) - 1))::timestamp
          at time zone 'Asia/Seoul');
$$;

-- 자기 도메인 referrer 는 외부 유입이 아니다.
-- document.referrer 는 SPA 라우트 이동에서도 최초 문서의 값을 그대로 유지해서,
-- 새로고침·내부 재진입이 "유입 경로" 목록을 자기 도메인으로 오염시키고 있었다.
-- 더 중요한 건, 설치형 앱 실행이 자기 도메인 referrer 를 달고 오면 (a) 판정이 막힌다는 점이다.
create or replace function band123.is_self_referrer(p_ref text)
returns boolean
language sql
immutable
set search_path = band123
as $$
  select p_ref is not null and p_ref ~* '^https?://([a-z0-9-]+\.)*(worldoflatinfestivals\.com|vercel\.app|localhost)(:[0-9]+)?(/|$)';
$$;

-- ── 집계 RPC ──────────────────────────────────────────────────────────────────
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
    where pv.created_at >= band123.traffic_window_start(p_days)
    group by 1
    order by 1;
end;
$$;

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
    where pv.created_at >= band123.traffic_window_start(p_days)
    group by pv.path
    order by count(*) desc
    limit greatest(p_limit, 1);
end;
$$;

-- 반환 컬럼이 바뀌므로 create or replace 가 아니라 drop 후 재생성한다.
drop function if exists band123.admin_traffic_top_referrers(int, int);

create function band123.admin_traffic_top_referrers(p_days int default 14, p_limit int default 10)
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
      where pv.created_at >= band123.traffic_window_start(p_days)
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

revoke execute on function band123.admin_traffic_top_referrers(int, int) from public;
grant execute on function band123.admin_traffic_top_referrers(int, int) to authenticated;
