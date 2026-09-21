-- 0059_weekly_report.sql
-- 어드민 '주간리포트' 메뉴 — 주차별 트래픽·퍼널·주문을 한 화면에서 전주 대비로 본다.
--
-- 0056(page_views)/0057(funnel_events)이 '지금 상태'를 보여준다면, 여기는 '추세'를 본다.
-- 주 경계는 KST 월요일 기준(date_trunc('week', ...)) — 운영이 한국 시간으로 돌아간다.
--
-- 결제수단별 성공률을 같이 넣은 이유: 퍼널 하단(결제)에서 새는 물이 가장 비싸고,
-- 그게 특정 PG 문제인지 전반적 이탈인지는 수단별로 갈라봐야만 보인다.
-- idempotent.

-- ── 1) 주차별 트래픽 ────────────────────────────────────────────────────
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
    group by 1
    order by 1;
end;
$$;

-- ── 2) 주차별 퍼널 ──────────────────────────────────────────────────────
-- 단계 판정식은 0057 admin_funnel_summary 와 동일하게 유지한다(두 화면 숫자가 어긋나면 안 된다).
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
as $$
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
        p.path
      from band123.page_views p
      where p.created_at >= v_since
    ),
    t as (
      select
        pv.wk,
        count(distinct pv.visitor_id)::bigint as visit,
        count(distinct pv.visitor_id) filter (where pv.path ~ '/(products|events|shop)(/|$)')::bigint as product_view,
        count(distinct pv.visitor_id) filter (where pv.path ~ '/cart(/|$)')::bigint as cart,
        count(distinct pv.visitor_id) filter (
          where pv.path ~ '/checkout(/|$)' and pv.path !~ '/checkout/success'
        )::bigint as checkout
      from pv
      group by pv.wk
    ),
    b as (
      select
        (date_trunc('week', fe.created_at at time zone 'Asia/Seoul'))::date as wk,
        count(distinct fe.visitor_id)::bigint as purchase
      from band123.funnel_events fe
      where fe.step = 'purchase' and fe.created_at >= v_since
      group by 1
    )
    select t.wk, t.visit, t.product_view, t.cart, t.checkout, coalesce(b.purchase, 0)
    from t left join b on b.wk = t.wk
    order by t.wk;
end;
$$;

-- ── 3) 주차별 주문·매출 ─────────────────────────────────────────────────
-- 확정(paid/shipped/done)만 매출로 센다. pending 은 '시도했지만 안 된 것'이라 분리해 본다.
create or replace function band123.admin_weekly_orders(p_weeks int default 8)
returns table (
  week_start date,
  orders bigint,
  paid bigint,
  revenue bigint
)
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
      (date_trunc('week', o.created_at at time zone 'Asia/Seoul'))::date as week_start,
      count(*)::bigint,
      count(*) filter (where o.status in ('paid', 'shipped', 'done'))::bigint,
      coalesce(sum(o.total_amount) filter (where o.status in ('paid', 'shipped', 'done')), 0)::bigint
    from band123.orders o
    where o.created_at >= now() - (greatest(p_weeks, 1) || ' weeks')::interval
    group by 1
    order by 1;
end;
$$;

-- ── 4) 결제수단별 성공률 ────────────────────────────────────────────────
-- 어느 PG 가 실제로 돈을 받아내는지. 시도는 많은데 paid 가 0 이면 연동 자체를 의심해야 한다.
create or replace function band123.admin_payment_method_stats(p_weeks int default 8)
returns table (
  method text,
  attempts bigint,
  paid bigint,
  revenue bigint
)
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
      coalesce(o.payment_method, '(미선택)')::text,
      count(*)::bigint,
      count(*) filter (where o.status in ('paid', 'shipped', 'done'))::bigint,
      coalesce(sum(o.total_amount) filter (where o.status in ('paid', 'shipped', 'done')), 0)::bigint
    from band123.orders o
    where o.created_at >= now() - (greatest(p_weeks, 1) || ' weeks')::interval
    group by 1
    order by 2 desc;
end;
$$;

revoke execute on function band123.admin_weekly_traffic(int) from public;
revoke execute on function band123.admin_weekly_funnel(int) from public;
revoke execute on function band123.admin_weekly_orders(int) from public;
revoke execute on function band123.admin_payment_method_stats(int) from public;
grant execute on function band123.admin_weekly_traffic(int) to authenticated;
grant execute on function band123.admin_weekly_funnel(int) to authenticated;
grant execute on function band123.admin_weekly_orders(int) to authenticated;
grant execute on function band123.admin_payment_method_stats(int) to authenticated;
