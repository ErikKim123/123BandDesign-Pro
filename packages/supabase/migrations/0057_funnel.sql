-- 0057_funnel.sql
-- 어드민 '퍼널분석' 메뉴 — 방문 → 상품조회 → 장바구니 → 결제시작 → 결제완료 전환율.
--
-- 왜 Vercel Web Analytics 가 아니라 자체 집계인가:
--   · Vercel Pro 는 커스텀 이벤트 속성이 2개뿐이라 주문번호·금액·통화를 같이 못 싣는다.
--   · UTM 파라미터는 Web Analytics Plus($10/월) 애드온에서만 나온다 → 여기서 직접 수집한다.
--   · 무엇보다 Vercel 은 우리 orders 테이블과 조인할 수 없어 '유입 → 실매출' 귀속이 불가능하다.
--   0056 이 이미 visitor_id 쿠키로 page_views 를 쌓고 있어, 그걸 그대로 퍼널의 1~4단계로 쓴다.
--
-- 단계 판정:
--   1~4단계는 page_views.path 로 유추한다 → 별도 계측 없이 과거 데이터까지 즉시 집계된다.
--   5단계(결제완료)만 경로로 알 수 없어 funnel_events 에 기록한다(결제 성공 화면에서 1회).
-- idempotent.

-- ── 1) UTM — 캠페인별 전환을 보려면 유입 시점의 utm 이 필요하다 ──────────
alter table band123.page_views add column if not exists utm_source   text;
alter table band123.page_views add column if not exists utm_medium   text;
alter table band123.page_views add column if not exists utm_campaign text;

-- ── 2) 경로로 알 수 없는 단계(결제완료) ──────────────────────────────────
create table if not exists band123.funnel_events (
  id bigint generated always as identity primary key,
  visitor_id uuid not null,
  step text not null,                                  -- 현재는 'purchase' 만 쓴다
  order_id uuid references band123.orders(id) on delete cascade,
  amount int,                                          -- 주문 확정 금액(정산 통화 그대로)
  currency text,
  created_at timestamptz not null default now()
);

-- 결제 성공 화면은 새로고침될 수 있다 — 주문 1건당 단계 1행만 남긴다.
create unique index if not exists funnel_events_order_step_uniq
  on band123.funnel_events (order_id, step) where order_id is not null;
create index if not exists idx_funnel_events_created
  on band123.funnel_events (created_at desc);
create index if not exists idx_funnel_events_visitor
  on band123.funnel_events (visitor_id, step);

alter table band123.funnel_events enable row level security;

drop policy if exists funnel_events_admin_select on band123.funnel_events;
create policy funnel_events_admin_select on band123.funnel_events
  for select using (band123.is_admin());
-- insert 정책 없음 — 0056 과 같이 web 앱이 service_role 로만 기록한다.

-- ── 3) 단계별 전환 요약 ──────────────────────────────────────────────────
-- 각 단계의 '순 방문자 수'를 돌려준다. 앞 단계를 거치지 않고 바로 진입한 방문자도
-- 그 단계에는 포함된다(경로 기반이라 실제 도달 사실이 더 정확하다).
create or replace function band123.admin_funnel_summary(p_days int default 14)
returns table (step text, sort_order int, visitors bigint)
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_since timestamptz := now() - (greatest(p_days, 1) || ' days')::interval;
begin
  if not band123.is_admin() then
    return;
  end if;
  return query
    with pv as (
      select pv.visitor_id, pv.path
      from band123.page_views pv
      where pv.created_at >= v_since
    )
    select 'visit'::text, 1, count(distinct p.visitor_id)::bigint from pv p
    union all
    select 'product_view', 2, count(distinct p.visitor_id)::bigint
      from pv p where p.path ~ '/(products|events|shop)(/|$)'
    union all
    select 'cart', 3, count(distinct p.visitor_id)::bigint
      from pv p where p.path ~ '/cart(/|$)'
    union all
    select 'checkout', 4, count(distinct p.visitor_id)::bigint
      from pv p where p.path ~ '/checkout(/|$)' and p.path !~ '/checkout/success'
    union all
    select 'purchase', 5, count(distinct fe.visitor_id)::bigint
      from band123.funnel_events fe
      where fe.step = 'purchase' and fe.created_at >= v_since
    order by 2;
end;
$$;

-- ── 4) 유입 경로별 전환·매출 ─────────────────────────────────────────────
-- 방문자마다 '첫 유입'의 출처를 붙여(first-touch) 그 출처가 만든 매출까지 본다.
-- Vercel 로는 불가능한 구간 — orders 를 직접 조인하기 때문이다.
create or replace function band123.admin_funnel_by_source(p_days int default 14, p_limit int default 10)
returns table (source text, visitors bigint, purchases bigint, revenue bigint)
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_since timestamptz := now() - (greatest(p_days, 1) || ' days')::interval;
begin
  if not band123.is_admin() then
    return;
  end if;
  return query
    with first_touch as (
      -- 방문자별 가장 이른 조회 1건 = 그 방문자를 데려온 출처
      select distinct on (pv.visitor_id)
        pv.visitor_id,
        coalesce(
          nullif(btrim(coalesce(pv.utm_source, '')), ''),
          -- referrer 는 호스트만 남긴다(경로까지 있으면 행이 잘게 쪼개진다)
          nullif(regexp_replace(coalesce(pv.referrer, ''), '^https?://(www\.)?([^/]+).*$', '\2'), ''),
          'direct'
        ) as source
      from band123.page_views pv
      where pv.created_at >= v_since
      order by pv.visitor_id, pv.created_at
    ),
    buys as (
      select fe.visitor_id, count(*)::bigint as cnt, coalesce(sum(fe.amount), 0)::bigint as amt
      from band123.funnel_events fe
      where fe.step = 'purchase' and fe.created_at >= v_since
      group by fe.visitor_id
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
$$;

revoke execute on function band123.admin_funnel_summary(int) from public;
revoke execute on function band123.admin_funnel_by_source(int, int) from public;
grant execute on function band123.admin_funnel_summary(int) to authenticated;
grant execute on function band123.admin_funnel_by_source(int, int) to authenticated;
