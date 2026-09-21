-- Design Ref: 선물하기(패스 선물) — 내가 구매한 티켓(패스)을 친구(이메일)에게 보내 친구 선물함에 넣는다.
-- 보안 원칙(0019 체크인과 동일 철학): 직접 insert 를 열지 않고 SECURITY DEFINER 함수(send_gift)로만 생성한다.
--   함수가 (1) 호출자가 그 주문의 구매자인지 (2) 티켓 항목인지 (3) 가용수량(qty-입장-기선물) 이내인지
--   (4) 받는 사람이 실제 회원이고 본인이 아닌지 를 검증한다.
--   profiles RLS 가 '본인/admin' 이라 서로의 이름을 못 읽으므로, 보낸이/받는이 이름·상품명은
--   함수(RLS 우회) 안에서 스냅샷으로 gifts 행에 저장해 표시에 쓴다.
-- 입장(체크인)은 기존대로 order_items 카운터를 공유한다(선물해도 총 입장수는 결제한 qty 로 상한 유지 → 초과입장 불가).
-- idempotent.

create table if not exists gifts (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  sender_id uuid not null references profiles(id) on delete cascade,
  sender_name text,                              -- 보낸이 표시명 스냅샷
  recipient_id uuid not null references profiles(id) on delete cascade,
  recipient_email text,                          -- 받는이 이메일 스냅샷
  recipient_name text,                           -- 받는이 표시명 스냅샷
  qty int not null check (qty > 0),
  message text,
  name_i18n jsonb not null default '{}'::jsonb,  -- 상품명 스냅샷(표시용)
  order_no text,                                 -- 주문번호 스냅샷(QR 라벨용)
  status text not null default 'sent' check (status in ('sent', 'revoked')),
  created_at timestamptz not null default now()
);

create index if not exists idx_gifts_sender on gifts(sender_id);
create index if not exists idx_gifts_recipient on gifts(recipient_id);
create index if not exists idx_gifts_order_item on gifts(order_item_id);

alter table gifts enable row level security;

-- 조회: 보낸 사람 또는 받은 사람만. (insert/update/delete 정책 없음 → 직접 변경 불가, 생성은 RPC 로만)
drop policy if exists gifts_select_own on gifts;
create policy gifts_select_own on gifts for select
  using (sender_id = auth.uid() or recipient_id = auth.uid());

-- 선물 보내기 RPC -----------------------------------------------------------
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
  v_gifted int;
  v_available int;
  v_email text := lower(trim(coalesce(p_recipient_email, '')));
  v_row gifts;
begin
  if v_uid is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if p_qty is null or p_qty < 1 then raise exception 'invalid_qty' using errcode = '22023'; end if;
  if v_email = '' then raise exception 'recipient_required' using errcode = '22023'; end if;

  select * into v_item from order_items where id = p_order_item_id;
  if not found then raise exception 'item_not_found' using errcode = 'P0002'; end if;

  select * into v_order from orders where id = v_item.order_id;
  if not found or v_order.buyer_id <> v_uid then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_order.status in ('cancelled', 'refunded') then raise exception 'order_not_active' using errcode = '22023'; end if;

  select * into v_product from products where id = v_item.product_id;
  if not found or v_product.product_type <> 'ticket' then raise exception 'not_a_pass' using errcode = '22023'; end if;

  -- 받는 사람 (이메일 → 프로필). 미가입/본인 차단.
  select * into v_recipient from profiles where lower(email) = v_email limit 1;
  if not found then raise exception 'recipient_not_found' using errcode = 'P0002'; end if;
  if v_recipient.id = v_uid then raise exception 'cannot_gift_self' using errcode = '22023'; end if;

  -- 가용 수량 = qty - 입장완료 - 기(旣)선물(sent)
  select coalesce(sum(qty), 0) into v_gifted
    from gifts where order_item_id = p_order_item_id and status = 'sent';
  v_available := v_item.qty - coalesce(v_item.checked_in_count, 0) - v_gifted;
  if p_qty > v_available then raise exception 'not_enough_available' using errcode = '22023'; end if;

  select * into v_sender from profiles where id = v_uid;

  insert into gifts(
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
