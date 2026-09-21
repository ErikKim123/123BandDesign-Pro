-- Design Ref: 선물 '받기(수락)' 2단계 도입 — 보내면 예약(gifting), 받은 사람이 '내 주문으로 이동'하면
--   소유권 이전 + 시크릿 회전으로 활성화. 이동 전엔 QR 없음(문구 안내).
-- 보안: 보낸 즉시 패스를 'gifting'(사용불가)로 잠가 보낸 사람도 입장 못 하게 하고, 받기 시점에
--   redemption_secret 을 회전해 이전 소유자 캡처본을 무효화한다. 이중입장 불가.
-- 0026/0027 후속. idempotent.

-- ── 1) 상태 확장 ─────────────────────────────────────────────
-- passes.status 에 'gifting'(선물 예약, 사용불가) 추가. gifts.status 에 'claimed'(받기 완료) 추가.
-- 인라인 check 제약은 자동 명명이라 정의를 훑어 안전하게 교체한다.
do $$
declare c text;
begin
  select conname into c from pg_constraint
    where conrelid = 'band123.passes'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%';
  if c is not null then execute format('alter table passes drop constraint %I', c); end if;
end $$;
alter table passes
  add constraint passes_status_check check (status in ('valid', 'used', 'revoked', 'gifting'));

do $$
declare c text;
begin
  select conname into c from pg_constraint
    where conrelid = 'band123.gifts'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%';
  if c is not null then execute format('alter table gifts drop constraint %I', c); end if;
end $$;
alter table gifts
  add constraint gifts_status_check check (status in ('sent', 'revoked', 'claimed'));

-- 예약된 패스를 어느 선물이 잡았는지 연결(받기 시 정확히 이전).
alter table passes add column if not exists gift_id uuid references gifts(id) on delete set null;
create index if not exists idx_passes_gift on passes(gift_id);

-- ── 2) send_gift 재정의 — 소유권 즉시 이전 대신 'gifting' 예약(보낸 사람도 사용불가) ──
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

  select * into v_recipient from profiles where lower(email) = v_email limit 1;
  if not found then raise exception 'recipient_not_found' using errcode = 'P0002'; end if;
  if v_recipient.id = v_uid then raise exception 'cannot_gift_self' using errcode = '22023'; end if;

  -- 내가 소유한 valid 패스 p_qty 장을 잠근다.
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

  -- 예약: 소유권은 그대로(보낸 사람), 상태만 'gifting'(사용불가)로 잠그고 선물에 연결. 시크릿은 받기 때 회전.
  update passes
    set status = 'gifting', gift_id = v_row.id
    where id = any(v_ids) and status = 'valid';
  get diagnostics v_moved = row_count;
  if v_moved < p_qty then
    raise exception 'not_enough_available' using errcode = '22023';  -- 롤백
  end if;

  return v_row;
end;
$$;

revoke all on function send_gift(uuid, text, int, text) from public;
grant execute on function send_gift(uuid, text, int, text) to authenticated;

-- ── 3) claim_gift — 받은 사람이 '내 주문으로 이동'. 소유권 이전 + 시크릿 회전 + 활성화(valid). ──
create or replace function claim_gift(p_gift_id uuid)
returns int  -- 이동된 패스 수
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_uid uuid := auth.uid();
  v_gift gifts;
  v_ids uuid[];
  v_moved int := 0;
begin
  if v_uid is null then raise exception 'unauthorized' using errcode = '42501'; end if;

  select * into v_gift from gifts where id = p_gift_id;
  if not found then raise exception 'gift_not_found' using errcode = 'P0002'; end if;
  if v_gift.recipient_id <> v_uid then raise exception 'forbidden' using errcode = '42501'; end if;

  -- 이 선물이 예약한 gifting 패스(신규) 또는 (구모델) 보낸 사람이 여전히 소유한 valid 패스.
  select array_agg(id) into v_ids from (
    select id from passes
    where (gift_id = p_gift_id and status = 'gifting')
       or (gift_id is null and order_item_id = v_gift.order_item_id
           and owner_id = v_gift.sender_id and status = 'valid')
    order by id
    limit v_gift.qty
    for update
  ) s;

  if v_ids is not null then
    -- 소유권 이전 + 시크릿 회전(이전 소유자 캡처본 무효) + 활성화.
    update passes
      set owner_id = v_uid,
          status = 'valid',
          redemption_secret = gen_random_uuid(),
          gift_id = p_gift_id
      where id = any(v_ids);
    get diagnostics v_moved = row_count;
  end if;

  update gifts set status = 'claimed' where id = p_gift_id;
  return v_moved;
end;
$$;

revoke all on function claim_gift(uuid) from public;
grant execute on function claim_gift(uuid) to authenticated;
