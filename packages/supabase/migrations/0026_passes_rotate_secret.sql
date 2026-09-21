-- Design Ref: 선물(양도) 시 QR 위조/이중입장 차단 — '고정 order_id QR' → '패스 1장 = 1행, 회전형 시크릿' 모델.
-- 배경(취약점): 기존 QR 은 order_id 를 고정으로 담았고, 선물은 order_items.checked_in_count 를 공유하는
--   '배정(allotment)' 방식이라 (1) 준 사람 화면의 QR 이 그대로 살아있고 (2) sender/recipient 가 카운터
--   풀을 공유해, 준 사람이 캡처본으로 먼저 입장하면 받은 사람이 못 들어가는 등 소유권 회수가 되지 않았다.
-- 해결(이 마이그레이션):
--   1) passes — 입장 1단위 = 1행. owner_id(현재 소유자) · redemption_secret(QR 값) · status('valid'/'used'/'revoked').
--   2) 선물 = 소유권 이전. owner_id 변경 + redemption_secret 회전을 한 트랜잭션으로 → 이전 소유자 캡처본 즉시 무효.
--   3) 체크인 = 시크릿으로 원자적 burn. UPDATE ... WHERE status='valid' RETURNING 으로 동시 스캔 이중입장 차단.
--   4) redemption_secret 은 owner(본인)와 admin 만 SELECT(RLS). 판매자는 checkin_pass RPC 로만 소각.
-- 정산/금액은 종전대로 order_items 가 원천(passes 는 입장권 원장). order_items.checked_in_count 는
--   구매자 UI 실시간 동기화를 위해 체크인 시 미러(denormalized)만 유지한다.
-- idempotent: create table/or replace/if not exists + 백필은 not exists 가드.

-- ─────────────────────────────────────────────────────────────
-- 1) passes 테이블 — 입장 1단위 = 1행
-- ─────────────────────────────────────────────────────────────
create table if not exists passes (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  seller_id uuid not null references profiles(id),          -- 정산/체크인 판매자 검증(발행 시점 고정)
  owner_id uuid not null references profiles(id) on delete cascade,   -- 현재 소유자(선물로 변경)
  original_buyer_id uuid not null references profiles(id),  -- 최초 구매자(감사/이력용, 불변)
  redemption_secret uuid not null default gen_random_uuid(),         -- QR 에 담기는 값(선물 시 회전)
  status text not null default 'valid' check (status in ('valid', 'used', 'revoked')),
  used_at timestamptz,
  used_by uuid references profiles(id),                    -- 입장 처리한 오거나이저
  created_at timestamptz not null default now()
);

-- redemption_secret 로 조회(체크인) → 유니크. 선물 회전 후에도 전역 유일.
create unique index if not exists uq_passes_secret on passes(redemption_secret);
create index if not exists idx_passes_owner on passes(owner_id);
create index if not exists idx_passes_order_item on passes(order_item_id);
create index if not exists idx_passes_seller on passes(seller_id);

-- ─────────────────────────────────────────────────────────────
-- 2) RLS — owner(본인)/admin 만 행 조회(=시크릿 노출). 직접 쓰기 없음(모든 변경은 RPC).
--    판매자는 passes 를 직접 SELECT 하지 못한다(시크릿 수집 차단) — 체크인은 checkin_pass RPC 로만.
-- ─────────────────────────────────────────────────────────────
alter table passes enable row level security;

drop policy if exists passes_owner_read on passes;
create policy passes_owner_read on passes for select
  using (owner_id = auth.uid() or is_admin());

drop policy if exists passes_admin_write on passes;
create policy passes_admin_write on passes for all
  using (is_admin()) with check (is_admin());

-- ─────────────────────────────────────────────────────────────
-- 3) 발행 — 결제확정(paid) 시 티켓 order_item 의 qty 만큼 valid 패스 생성. 멱등(부족분만 보충).
--    서버(finalize, service_role)에서 호출. 백필도 이 함수의 로직을 공유.
-- ─────────────────────────────────────────────────────────────
create or replace function mint_passes_for_order(p_order_id uuid)
returns int
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_item record;
  v_have int;
  v_need int;
  v_minted int := 0;
begin
  -- 결제완료(이후) 주문만 발행. 그 외(pending/cancelled/refunded)는 무시.
  perform 1 from orders where id = p_order_id and status in ('paid', 'shipped', 'done');
  if not found then return 0; end if;

  for v_item in
    select oi.id, oi.order_id, oi.product_id, oi.seller_id, oi.qty, o.buyer_id
    from order_items oi
    join orders o on o.id = oi.order_id
    join products p on p.id = oi.product_id
    where oi.order_id = p_order_id and p.product_type = 'ticket'
  loop
    select count(*) into v_have from passes where order_item_id = v_item.id;
    v_need := v_item.qty - v_have;
    if v_need > 0 then
      insert into passes (order_item_id, order_id, product_id, seller_id, owner_id, original_buyer_id)
      select v_item.id, v_item.order_id, v_item.product_id, v_item.seller_id, v_item.buyer_id, v_item.buyer_id
      from generate_series(1, v_need);
      v_minted := v_minted + v_need;
    end if;
  end loop;

  return v_minted;
end;
$$;

-- 발행은 서버(webhook/complete, service_role)만. 클라이언트에서 임의 호출 불가.
revoke all on function mint_passes_for_order(uuid) from public;
grant execute on function mint_passes_for_order(uuid) to service_role;

-- ─────────────────────────────────────────────────────────────
-- 4) 선물(소유권 이전) — send_gift 재정의.
--    이전 '배정' 방식 폐기 → 호출자가 소유한 valid 패스 p_qty 장을 받는이로 이전하며 시크릿 회전.
--    (owner_id 변경 + redemption_secret 재발급 + status='valid' 조건)을 한 트랜잭션으로 원자 처리.
--    gifts 행은 이력/표시용 로그로 계속 남긴다(스냅샷명·메시지). 시그니처는 종전과 동일.
-- ─────────────────────────────────────────────────────────────
create or replace function send_gift(
  p_order_item_id uuid,
  p_recipient_email text,
  p_qty int default 1,
  p_message text default null
)
returns gifts
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_uid uuid := auth.uid();
  v_item order_items;
  v_order orders;
  v_product products;
  v_recipient profiles;
  v_sender profiles;
  v_email text := lower(trim(coalesce(p_recipient_email, '')));
  v_ids uuid[];
  v_moved int;
  v_row gifts;
begin
  if v_uid is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if p_qty is null or p_qty < 1 then raise exception 'invalid_qty' using errcode = '22023'; end if;
  if v_email = '' then raise exception 'recipient_required' using errcode = '22023'; end if;

  select * into v_item from order_items where id = p_order_item_id;
  if not found then raise exception 'item_not_found' using errcode = 'P0002'; end if;

  select * into v_order from orders where id = v_item.order_id;
  if not found then raise exception 'item_not_found' using errcode = 'P0002'; end if;
  if v_order.status in ('cancelled', 'refunded') then raise exception 'order_not_active' using errcode = '22023'; end if;

  select * into v_product from products where id = v_item.product_id;
  if not found or v_product.product_type <> 'ticket' then raise exception 'not_a_pass' using errcode = '22023'; end if;

  -- 받는 사람 (이메일 → 프로필). 미가입/본인 차단.
  select * into v_recipient from profiles where lower(email) = v_email limit 1;
  if not found then raise exception 'recipient_not_found' using errcode = 'P0002'; end if;
  if v_recipient.id = v_uid then raise exception 'cannot_gift_self' using errcode = '22023'; end if;

  -- 내가 소유한 valid 패스 p_qty 장을 잠그고 선점(동시 선물/체크인 경합 안전).
  select array_agg(id) into v_ids from (
    select id from passes
    where order_item_id = p_order_item_id and owner_id = v_uid and status = 'valid'
    order by id
    limit p_qty
    for update
  ) s;
  if v_ids is null or array_length(v_ids, 1) < p_qty then
    raise exception 'not_enough_available' using errcode = '22023';
  end if;

  -- 소유권 이전 + 시크릿 회전(=이전 소유자 캡처본 무효). status='valid' 재확인으로 이중 처리 방지.
  update passes
    set owner_id = v_recipient.id,
        redemption_secret = gen_random_uuid()
    where id = any(v_ids) and status = 'valid';
  get diagnostics v_moved = row_count;
  if v_moved < p_qty then
    -- 잠금 사이에 상태가 바뀐 경우(사실상 불가) — 트랜잭션 롤백.
    raise exception 'not_enough_available' using errcode = '22023';
  end if;

  select * into v_sender from profiles where id = v_uid;

  insert into gifts (
    order_item_id, order_id, product_id, sender_id, sender_name,
    recipient_id, recipient_email, recipient_name, qty, message, name_i18n, order_no
  ) values (
    v_item.id, v_item.order_id, v_item.product_id, v_uid,
    coalesce(nullif(trim(v_sender.name), ''), split_part(coalesce(v_sender.email, ''), '@', 1)),
    v_recipient.id, v_recipient.email,
    coalesce(nullif(trim(v_recipient.name), ''), split_part(coalesce(v_recipient.email, ''), '@', 1)),
    p_qty, nullif(trim(coalesce(p_message, '')), ''), v_product.name_i18n, v_order.order_no
  ) returning * into v_row;

  return v_row;
end;
$$;

revoke all on function send_gift(uuid, text, int, text) from public;
grant execute on function send_gift(uuid, text, int, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5) 체크인 — 시크릿으로 원자적 burn.
--    UPDATE ... WHERE redemption_secret=? AND status='valid' AND seller_id=<나> RETURNING
--    → 유효하고 '내가 판' 패스일 때만 1행이 갱신되며 즉시 status='used'. 동시 스캔 시 한쪽만 성공.
--    실패 시 사유 분류: 없음(회전됨/위조)=pass_not_found · 내 판매 아님=forbidden · 이미 소진=already.
-- ─────────────────────────────────────────────────────────────
create or replace function checkin_pass(p_secret uuid)
returns table (
  order_no text,
  product_name jsonb,   -- 상품명(다국어) 스냅샷 — 파트너 표시용
  owner_name text,      -- 현재 소유자 표시명
  pass_status text,     -- 처리 후 패스 상태('used' 또는 기존 상태)
  already boolean       -- 이번 스캔으로 소각한 게 없으면 true(이미 사용/무효)
)
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_uid uuid := auth.uid();
  v_burned passes;
  v_pass passes;
  v_order orders;
  v_product products;
  v_owner profiles;
begin
  if v_uid is null then raise exception 'unauthorized' using errcode = '42501'; end if;

  -- 원자적 소각: 유효(valid) + 내가 판(seller) 패스일 때만 1행 갱신.
  update passes
    set status = 'used', used_at = now(), used_by = v_uid
    where redemption_secret = p_secret and status = 'valid' and seller_id = v_uid
    returning * into v_burned;

  if found then
    -- 구매자/판매자 UI 동기화용 카운터 미러(원장은 passes). best-effort.
    update order_items
      set checked_in_count = checked_in_count + 1,
          checked_in_at = coalesce(checked_in_at, now()),
          checked_in_by = coalesce(checked_in_by, v_uid)
      where id = v_burned.order_item_id;

    select * into v_order from orders where id = v_burned.order_id;
    select * into v_product from products where id = v_burned.product_id;
    select * into v_owner from profiles where id = v_burned.owner_id;
    return query select
      v_order.order_no,
      coalesce(v_product.name_i18n, '{}'::jsonb),
      coalesce(nullif(trim(v_owner.name), ''), v_owner.email),
      'used'::text,
      false;
    return;
  end if;

  -- 소각 실패 → 사유 분류. 시크릿에 해당하는 패스가 아예 없으면 회전됨/위조.
  select * into v_pass from passes where redemption_secret = p_secret;
  if not found then raise exception 'pass_not_found' using errcode = 'P0002'; end if;
  -- 존재하지만 내가 판 게 아니면 권한 없음.
  if v_pass.seller_id <> v_uid then raise exception 'forbidden' using errcode = '42501'; end if;

  -- 내 패스지만 valid 가 아님 → 이미 사용/무효.
  select * into v_order from orders where id = v_pass.order_id;
  select * into v_product from products where id = v_pass.product_id;
  select * into v_owner from profiles where id = v_pass.owner_id;
  return query select
    v_order.order_no,
    coalesce(v_product.name_i18n, '{}'::jsonb),
    coalesce(nullif(trim(v_owner.name), ''), v_owner.email),
    v_pass.status,
    true;
end;
$$;

revoke all on function checkin_pass(uuid) from public;
grant execute on function checkin_pass(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 6) 백필 — 기존 결제완료 티켓 데이터를 passes 로 이관(멱등, best-effort).
--    (a) qty 만큼 발행(owner=구매자) → (b) checked_in_count 만큼 앞에서부터 used 표시
--    → (c) 기존 선물(gifts.status='sent') 만큼 valid 패스를 받는이 소유로 이전.
--    구모델은 '누가 입장했는지'를 단위별로 기록하지 않으므로 (b)(c)는 근사(best-effort)다.
-- ─────────────────────────────────────────────────────────────

-- (a) 발행 — 아직 패스가 없는 티켓 order_item 만.
insert into passes (order_item_id, order_id, product_id, seller_id, owner_id, original_buyer_id, created_at)
select oi.id, oi.order_id, oi.product_id, oi.seller_id, o.buyer_id, o.buyer_id, now()
from order_items oi
join orders o on o.id = oi.order_id
join products p on p.id = oi.product_id,
     generate_series(1, oi.qty)
where p.product_type = 'ticket'
  and o.status in ('paid', 'shipped', 'done')
  and not exists (select 1 from passes ps where ps.order_item_id = oi.id);

-- (b) 입장완료 미러 반영 — 각 order_item 의 앞 checked_in_count 장을 used 로.
with ranked as (
  select id, order_item_id,
         row_number() over (partition by order_item_id order by id) as rn
  from passes
  where status = 'valid'
)
update passes ps
  set status = 'used',
      used_at = coalesce(oi.checked_in_at, now()),
      used_by = oi.checked_in_by
from ranked r
join order_items oi on oi.id = r.order_item_id
where ps.id = r.id
  and coalesce(oi.checked_in_count, 0) > 0
  and r.rn <= oi.checked_in_count;

-- (c) 기존 선물 반영 — sent 선물 수량만큼 구매자의 valid 패스를 받는이 소유로 이전(시크릿 유지: 유출 이력 없음).
do $$
declare
  g record;
  v_ids uuid[];
begin
  for g in select * from gifts where status = 'sent' order by created_at loop
    select array_agg(id) into v_ids from (
      select ps.id from passes ps
      where ps.order_item_id = g.order_item_id
        and ps.owner_id = g.sender_id
        and ps.status = 'valid'
      order by ps.id
      limit g.qty
    ) s;
    if v_ids is not null then
      update passes set owner_id = g.recipient_id where id = any(v_ids);
    end if;
  end loop;
end;
$$;
