-- 0120: 결제수단 표에 '결제창까지 간 주문' · 묵은 주문 점검에도 테스트 계정 제외
--
-- 0119 를 켜고 실제 자료를 보니 두 가지가 드러났다.
--
-- (1) 미결제 주문 103건이 전부 payment_ref 가 없고 만든 뒤 한 번도 갱신되지 않았다.
--     즉 결제가 '실패'한 게 아니라 결제창 앞에서 끝난 것이다. 주문 행은 결제 시작 전에
--     만들어지므로, '주문 생성'을 분모로 삼은 성공률은 결제수단 탓이 아닌 이탈까지
--     결제수단 실패처럼 보이게 한다. PG 거래가 붙은 주문(payment_ref)을 한 칸 더 두면
--     '우리 화면에서 샌 것'과 'PG 에서 샌 것'이 갈린다.
--
-- (2) 묵은 미결제 주문 점검만 테스트 계정 제외를 안 걸고 있었다. 다른 점검과 기준이 달라
--     같은 표 안에서 숫자가 서로 안 맞았다.
-- idempotent.

-- 반환 컬럼이 늘어 타입이 바뀌므로 지우고 다시 만든다.
drop function if exists band123.admin_payment_success(int, date);

create function band123.admin_payment_success(p_days int default 14, p_end date default null)
returns table (
  method text,
  started bigint,
  reached_pg bigint,
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
           nullif(btrim(coalesce(x.payment_ref, '')), '') is not null as has_ref,
           coalesce(x.total_amount, 0)::bigint as amt
      from band123.orders x
     where x.created_at >= v_since and x.created_at < v_until
       and not band123.analytics_user_excluded(x.buyer_id)
  )
  select
    o.m,
    count(*)::bigint,
    -- PG 거래번호가 붙은 주문 = 결제창까지 간 주문. 여기 못 닿은 주문은 우리 화면에서 샌 것이다.
    -- 계좌이체처럼 PG 를 안 쓰는 수단은 늘 0 이다 — 그 줄에서는 이 칸을 읽지 않는다.
    count(*) filter (where o.has_ref)::bigint,
    count(*) filter (where o.status in ('paid', 'shipped', 'done'))::bigint,
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

-- 묵은 주문 점검에도 같은 제외를 건다. 나머지 점검과 기준이 달라 한 표 안에서 숫자가 안 맞았다.
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

  select count(*) into v_orders
    from band123.orders o
   where o.status in ('paid', 'shipped', 'done')
     and coalesce(o.paid_at, o.updated_at, o.created_at) >= v_since
     and coalesce(o.paid_at, o.updated_at, o.created_at) < v_until
     and not band123.analytics_user_excluded(o.buyer_id);

  select count(distinct b.visitor_id) into v_funnel
    from band123.funnel_purchases(v_since, v_until) b;

  select count(*) into v_no_visitor
    from band123.orders o
   where o.status in ('paid', 'shipped', 'done')
     and coalesce(o.paid_at, o.updated_at, o.created_at) >= v_since
     and coalesce(o.paid_at, o.updated_at, o.created_at) < v_until
     and o.visitor_id is null
     and not band123.analytics_user_excluded(o.buyer_id)
     and not exists (select 1 from band123.visitor_identities vi where vi.user_id = o.buyer_id);

  select
    count(*) filter (where nullif(btrim(coalesce(pv.utm_source, '')), '') is not null),
    count(*) filter (
      where nullif(btrim(coalesce(pv.utm_source, '')), '') is not null
        and (
          nullif(btrim(coalesce(pv.utm_medium, '')), '') is null
          or pv.utm_source <> lower(pv.utm_source)
          or pv.utm_medium <> lower(pv.utm_medium)
        )
    ),
    count(*),
    count(*) filter (where lower(coalesce(pv.user_agent, '')) ~ '(bot|crawler|spider|headless|preview|monitor)')
  into v_utm_src, v_utm_bad, v_pv, v_bots
  from band123.page_views pv
  where pv.created_at >= v_since and pv.created_at < v_until;

  select count(*) into v_excluded
    from band123.page_views pv
   where pv.created_at >= v_since and pv.created_at < v_until
     and band123.analytics_visitor_excluded(pv.visitor_id);

  -- 여기 제외가 빠져 있었다(0119). 테스트로 눌러 본 주문이 '새는 매출'로 잡혔다.
  select count(*) into v_stale
    from band123.orders o
   where o.created_at >= v_since and o.created_at < v_until
     and o.status in ('pending', 'awaiting_payment')
     and o.created_at < now() - interval '1 day'
     and not band123.analytics_user_excluded(o.buyer_id);

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
  -- 결제완료 건수와 견주면 오해를 부른다(완료 4건 · 묵은 주문 6건 = 'bad'). 묵은 주문은
  -- 그 자체로 읽어야 하는 값이라 모집단을 '그 기간에 시작된 주문'으로 바꾼다.
  select 'stale_pending_orders', v_stale,
         (select count(*) from band123.orders o2
           where o2.created_at >= v_since and o2.created_at < v_until
             and not band123.analytics_user_excluded(o2.buyer_id))::bigint,
         case when v_stale = 0 then 'ok' else 'warn' end;
end;
$fn$;

notify pgrst, 'reload schema';
