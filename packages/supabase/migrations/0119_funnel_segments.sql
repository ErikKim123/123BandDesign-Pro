-- 0119: 퍼널 — 세그먼트 분해 · 매출 지표 · 결제수단 성공률 · 데이터 신뢰도 점검
--
-- 지금 퍼널은 전체 평균 하나뿐이다. 평균은 거짓말을 한다 — 모바일 결제 이탈이 데스크톱
-- 전환에 가려지고, 광고로 온 사람과 검색으로 온 사람이 한 덩어리로 섞인다. 그래서
-- '같은 퍼널을 기기·채널·신규/재방문·국가·랜딩별로 다시 그리는' 함수를 둔다.
--
-- 그리고 수치를 보기 전에 수치를 믿을 수 있는지부터 봐야 한다(admin_funnel_integrity).
-- 결제완료 수가 주문 DB 와 어긋나거나, 주문에 방문자가 안 붙어 있거나(PG 리다이렉트에서
-- 세션이 끊김), UTM 규칙이 제각각이면 그 아래 분석은 전부 헛것이다.
--
-- 금액은 기존 admin_funnel_by_source 와 같은 규칙으로 total_amount 를 그대로 더한다.
-- 통화가 섞여 있으면 섞인 채로 더해지는 한계도 그대로다 — 여기서 바꾸면 기존 표와
-- 숫자가 달라져 더 혼란스럽다.
-- idempotent.

-- ── 채널 묶음 ────────────────────────────────────────────────────────────────
-- 출처 문자열(utm_source 또는 referrer 호스트)을 사람이 의사결정하는 단위로 묶는다.
-- 광고 판정은 utm_medium 이 있을 때만 확실하다 — 없으면 검색엔진에서 온 것을 자연검색으로
-- 본다(유료 검색광고에 utm 을 안 달면 자연검색으로 섞인다. 그래서 UTM 규칙 점검이 같이 있다).
create or replace function band123.funnel_channel_group(p_source text, p_medium text)
returns text
language sql
immutable
set search_path = band123
as $$
  select case
    when lower(coalesce(p_medium, '')) in ('cpc', 'ppc', 'paid', 'paidsocial', 'paid_social', 'display', 'banner')
      then '광고'
    when lower(coalesce(p_source, '')) = 'direct' then '직접'
    when lower(coalesce(p_source, '')) ~ '(google|naver|bing|daum|yahoo|duckduckgo|baidu)'
      then '자연검색'
    when lower(coalesce(p_source, '')) ~ '(instagram|facebook|youtube|tiktok|twitter|^x\.com|threads|kakao|line\.me|pinterest)'
      then 'SNS'
    when lower(coalesce(p_source, '')) = 'app' then '앱'
    else '추천'
  end;
$$;

-- ── 세그먼트별 퍼널 ──────────────────────────────────────────────────────────
-- 단계 판정 규칙은 admin_funnel_summary 와 같다(장바구니는 선택 분기, 결제시작은
-- '상품조회 이후'). 다른 규칙을 쓰면 두 표의 합이 안 맞아 둘 다 못 믿게 된다.
--
-- p_dimension: 'device' | 'channel' | 'visitor_type' | 'country' | 'landing'
create or replace function band123.admin_funnel_segments(
  p_days int default 14,
  p_end date default null,
  p_dimension text default 'device',
  p_limit int default 12
)
returns table (
  segment text,
  visitors bigint,
  product_view bigint,
  cart bigint,
  checkout bigint,
  purchase bigint,
  revenue bigint
)
language plpgsql
security definer
set search_path = band123
as $fn$
declare
  v_since timestamptz := band123.traffic_window_start(p_days, p_end);
  v_until timestamptz := band123.traffic_window_end(p_end);
  v_dim text := lower(coalesce(p_dimension, 'device'));
begin
  if not band123.is_admin() then
    return;
  end if;

  return query
  with pv as (
    select p.visitor_id, band123.funnel_path_step(p.path) as st, p.created_at,
           p.device, p.country, p.path, p.referrer, p.utm_source, p.utm_medium, p.launch_mode
      from band123.page_views p
     where p.created_at >= v_since and p.created_at < v_until
       and not band123.analytics_visitor_excluded(p.visitor_id)
  ),
  -- 방문자마다 '처음 본 한 줄' — 세그먼트 값은 전부 여기서 나온다(first-touch).
  first_pv as (
    select distinct on (q.visitor_id) q.*
      from pv q
     order by q.visitor_id, q.created_at
  ),
  seg as (
    select
      f.visitor_id,
      case v_dim
        when 'device' then coalesce(nullif(btrim(f.device), ''), '알 수 없음')
        when 'country' then coalesce(nullif(btrim(f.country), ''), '알 수 없음')
        when 'landing' then f.path
        when 'visitor_type' then
          -- 이 기간 이전에 본 적이 있으면 재방문. 쿠키 기준이라 기기를 바꾸면 신규로 잡힌다.
          case when exists (
            select 1 from band123.page_views p0
             where p0.visitor_id = f.visitor_id and p0.created_at < v_since
          ) then '재방문' else '신규' end
        else band123.funnel_channel_group(
          coalesce(
            nullif(btrim(coalesce(f.utm_source, '')), ''),
            case when band123.is_self_referrer(f.referrer) then null
                 else nullif(regexp_replace(coalesce(f.referrer, ''), '^https?://(www\.)?([^/]+).*$', '\2'), '')
            end,
            case when coalesce(f.launch_mode, 'browser') <> 'browser' then 'app' end,
            'direct'
          ),
          f.utm_medium
        )
      end as label
    from first_pv f
  ),
  s1 as (select q.visitor_id, min(q.created_at) as t from pv q group by 1),
  s2 as (
    select q.visitor_id, min(q.created_at) as t
      from pv q join s1 on s1.visitor_id = q.visitor_id
     where q.st = 'product_view' and q.created_at >= s1.t
     group by 1
  ),
  s3 as (
    select q.visitor_id, min(q.created_at) as t
      from pv q join s2 on s2.visitor_id = q.visitor_id
     where q.st = 'cart' and q.created_at >= s2.t
     group by 1
  ),
  s4 as (
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
  buys as (
    select o.visitor_id, coalesce(sum(o.total_amount), 0)::bigint as amt
      from band123.orders o
     where o.visitor_id is not null
       and o.status in ('paid', 'shipped', 'done')
       and coalesce(o.paid_at, o.updated_at, o.created_at) >= v_since
       and coalesce(o.paid_at, o.updated_at, o.created_at) < v_until
       and not band123.analytics_user_excluded(o.buyer_id)
     group by o.visitor_id
  )
  select
    g.label,
    count(*)::bigint,
    count(s2.visitor_id)::bigint,
    count(s3.visitor_id)::bigint,
    count(s4.visitor_id)::bigint,
    count(s5.visitor_id)::bigint,
    coalesce(sum(b.amt), 0)::bigint
  from seg g
  join s1 on s1.visitor_id = g.visitor_id
  left join s2 on s2.visitor_id = g.visitor_id
  left join s3 on s3.visitor_id = g.visitor_id
  left join s4 on s4.visitor_id = g.visitor_id
  left join s5 on s5.visitor_id = g.visitor_id
  left join buys b on b.visitor_id = g.visitor_id
  group by g.label
  order by 2 desc
  limit greatest(p_limit, 1);
end;
$fn$;

-- ── 매출 지표 ────────────────────────────────────────────────────────────────
-- 전환율만 보면 '싸게 많이 판 날'과 '비싸게 조금 판 날'이 구분되지 않는다.
-- 객단가(AOV)와 방문당 매출(RPV)이 있어야 개선이 매출로 이어졌는지 말할 수 있다.
create or replace function band123.admin_funnel_revenue(p_days int default 14, p_end date default null)
returns table (orders bigint, revenue bigint, aov numeric, rpv numeric, visitors bigint)
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
  with o as (
    select coalesce(x.total_amount, 0)::bigint as amt
      from band123.orders x
     where x.status in ('paid', 'shipped', 'done')
       and coalesce(x.paid_at, x.updated_at, x.created_at) >= v_since
       and coalesce(x.paid_at, x.updated_at, x.created_at) < v_until
       and not band123.analytics_user_excluded(x.buyer_id)
  ),
  v as (
    select count(distinct p.visitor_id)::bigint as n
      from band123.page_views p
     where p.created_at >= v_since and p.created_at < v_until
       and not band123.analytics_visitor_excluded(p.visitor_id)
  )
  select
    (select count(*) from o)::bigint,
    (select coalesce(sum(amt), 0) from o)::bigint,
    case when (select count(*) from o) > 0
         then round((select sum(amt)::numeric from o) / (select count(*) from o), 0) else 0 end,
    case when (select n from v) > 0
         then round((select coalesce(sum(amt), 0)::numeric from o) / (select n from v), 0) else 0 end,
    (select n from v)::bigint;
end;
$fn$;

-- ── 결제수단별 성공률 ────────────────────────────────────────────────────────
-- 결제시작 → 완료 사이에서 새는 돈은 화면이 아니라 결제수단에서 새는 경우가 많다.
-- 수단마다 '시작한 주문' 대비 '결제된 주문' 비율을 본다. 취소·실패는 따로 센다.
create or replace function band123.admin_payment_success(p_days int default 14, p_end date default null)
returns table (
  method text,
  started bigint,
  paid bigint,
  pending bigint,
  cancelled bigint,
  success_rate numeric,
  revenue bigint
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
  with o as (
    select coalesce(nullif(btrim(x.payment_method), ''), '미지정') as m,
           x.status,
           coalesce(x.total_amount, 0)::bigint as amt
      from band123.orders x
     where x.created_at >= v_since and x.created_at < v_until
       and not band123.analytics_user_excluded(x.buyer_id)
  )
  select
    o.m,
    count(*)::bigint,
    count(*) filter (where o.status in ('paid', 'shipped', 'done'))::bigint,
    -- 아직 결과가 정해지지 않은 주문. 오래 남아 있으면 그 수단에서 이탈하고 있다는 뜻이다.
    count(*) filter (where o.status in ('pending', 'awaiting_payment'))::bigint,
    count(*) filter (where o.status in ('cancelled', 'canceled', 'failed', 'refunded'))::bigint,
    case when count(*) > 0
         then round(count(*) filter (where o.status in ('paid', 'shipped', 'done'))::numeric / count(*), 4)
         else 0 end,
    coalesce(sum(o.amt) filter (where o.status in ('paid', 'shipped', 'done')), 0)::bigint
  from o
  group by o.m
  order by 2 desc;
end;
$fn$;

-- ── 데이터 신뢰도 점검 ───────────────────────────────────────────────────────
-- 수치를 보기 전에 먼저 본다. 여기가 틀리면 아래 분석은 전부 헛것이다.
--   check   : 점검 항목 코드(화면이 문구를 붙인다)
--   value   : 문제가 있는 건수
--   total   : 모집단
--   severity: 'ok' | 'warn' | 'bad' — 화면에서 색을 고르는 기준
create or replace function band123.admin_funnel_integrity(p_days int default 14, p_end date default null)
returns table (check_key text, value bigint, total bigint, severity text)
language plpgsql
security definer
set search_path = band123
as $fn$
declare
  v_since timestamptz := band123.traffic_window_start(p_days, p_end);
  v_until timestamptz := band123.traffic_window_end(p_end);
  v_orders bigint;
  v_funnel bigint;
  v_no_visitor bigint;
  v_utm_src bigint;
  v_utm_bad bigint;
  v_bots bigint;
  v_pv bigint;
  v_excluded bigint;
  v_stale bigint;
begin
  if not band123.is_admin() then
    return;
  end if;

  -- 1) 결제완료 수 대조 — 주문 DB 의 결제완료 건수와 퍼널이 세는 구매 방문자 수.
  --    둘은 원래 다르다(한 방문자가 두 번 사면 주문 2 · 방문자 1). 크게 벌어질 때만 신호다.
  select count(*) into v_orders
    from band123.orders o
   where o.status in ('paid', 'shipped', 'done')
     and coalesce(o.paid_at, o.updated_at, o.created_at) >= v_since
     and coalesce(o.paid_at, o.updated_at, o.created_at) < v_until
     and not band123.analytics_user_excluded(o.buyer_id);

  select count(distinct b.visitor_id) into v_funnel
    from band123.funnel_purchases(v_since, v_until) b;

  -- 2) 세션이 끊긴 주문 — visitor_id 도 없고 회원 연결로도 방문자를 못 찾는 주문.
  --    PG 리다이렉트에서 쿠키가 끊기면 이렇게 되고, 그 매출은 어느 유입에도 안 붙는다.
  select count(*) into v_no_visitor
    from band123.orders o
   where o.status in ('paid', 'shipped', 'done')
     and coalesce(o.paid_at, o.updated_at, o.created_at) >= v_since
     and coalesce(o.paid_at, o.updated_at, o.created_at) < v_until
     and o.visitor_id is null
     and not exists (select 1 from band123.visitor_identities vi where vi.user_id = o.buyer_id);

  -- 3) UTM 규칙 — source 만 달고 medium 을 빼면 광고/자연검색을 가를 수 없다.
  select
    count(*) filter (where nullif(btrim(coalesce(pv.utm_source, '')), '') is not null),
    count(*) filter (
      where nullif(btrim(coalesce(pv.utm_source, '')), '') is not null
        and (
          nullif(btrim(coalesce(pv.utm_medium, '')), '') is null
          -- 대소문자가 섞이면 같은 캠페인이 두 줄로 갈라진다.
          or pv.utm_source <> lower(pv.utm_source)
          or pv.utm_medium <> lower(pv.utm_medium)
        )
    ),
    count(*),
    count(*) filter (where lower(coalesce(pv.user_agent, '')) ~ '(bot|crawler|spider|headless|preview|monitor)')
  into v_utm_src, v_utm_bad, v_pv, v_bots
  from band123.page_views pv
  where pv.created_at >= v_since and pv.created_at < v_until;

  -- 4) 제외 계정(테스트) 때문에 빠진 조회수 — 몇 줄이 빠지고 있는지 보여 준다.
  select count(*) into v_excluded
    from band123.page_views pv
   where pv.created_at >= v_since and pv.created_at < v_until
     and band123.analytics_visitor_excluded(pv.visitor_id);

  -- 5) 결론이 안 난 채 하루 넘게 묵은 주문 — 결제 구간에서 새는 양의 하한.
  select count(*) into v_stale
    from band123.orders o
   where o.created_at >= v_since and o.created_at < v_until
     and o.status in ('pending', 'awaiting_payment')
     and o.created_at < now() - interval '1 day';

  return query
  select 'purchase_vs_orders'::text, abs(v_orders - v_funnel), v_orders,
         case when v_orders = 0 then 'ok'
              when abs(v_orders - v_funnel)::numeric / greatest(v_orders, 1) > 0.3 then 'bad'
              when v_orders <> v_funnel then 'warn' else 'ok' end
  union all
  select 'orders_without_visitor', v_no_visitor, v_orders,
         case when v_no_visitor = 0 then 'ok'
              when v_no_visitor::numeric / greatest(v_orders, 1) > 0.2 then 'bad' else 'warn' end
  union all
  select 'utm_rule_violations', v_utm_bad, v_utm_src,
         case when v_utm_bad = 0 then 'ok'
              when v_utm_bad::numeric / greatest(v_utm_src, 1) > 0.3 then 'bad' else 'warn' end
  union all
  select 'bot_traffic', v_bots, v_pv,
         case when v_bots = 0 then 'ok'
              when v_bots::numeric / greatest(v_pv, 1) > 0.1 then 'bad' else 'warn' end
  union all
  select 'excluded_pageviews', v_excluded, v_pv, 'ok'::text
  union all
  select 'stale_pending_orders', v_stale, v_orders,
         case when v_stale = 0 then 'ok' when v_stale > v_orders then 'bad' else 'warn' end;
end;
$fn$;

notify pgrst, 'reload schema';
