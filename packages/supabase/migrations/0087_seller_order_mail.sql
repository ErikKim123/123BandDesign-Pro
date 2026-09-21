-- Design Ref: 오거나이저 '구매확인 메일 재발송' — 파트너 포털 주문 목록의 수동 재발송 버튼이 쓰는 페이로드.
--
-- 왜 RPC 인가:
--   재발송 메일은 '원래 보낸 확인서와 같은 내용'이어야 한다. 그런데 파트너 세션은 RLS 상
--   order_items 를 자기 seller_id 것만 볼 수 있어(0025), 여러 판매자가 섞인 주문에서는
--   금액·항목이 원본과 달라진다. 그렇다고 파트너 앱에 service_role 키를 주면 그 앱이 뚫렸을 때
--   전 테이블이 열린다.
--   → 소유 검증을 안에서 하고 필요한 필드만 내주는 SECURITY DEFINER 함수로 좁힌다.
--     (0036 seller_advance_order 와 같은 방식)
--
-- 내주지 않는 것: passes.redemption_secret(입장 QR 값). 메일에 QR 을 싣지 않으므로 필요 없고,
--   판매자에게 시크릿을 노출하면 0026 의 위조 방지 모델이 깨진다.
--
-- idempotent: create or replace + drop policy 없음(정책 변경 없음).

create or replace function seller_order_mail_payload(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = band123
as $$
declare
  v_order record;
  v_buyer record;
  v_items jsonb;
  v_has_ticket boolean;
begin
  -- 1) 호출자가 이 주문의 판매자인가. 아니면 아무것도 알려주지 않는다(존재 여부조차).
  if not exists (
    select 1 from order_items oi
    where oi.order_id = p_order_id and oi.seller_id = auth.uid()
  ) then
    raise exception 'not_seller' using errcode = '42501';
  end if;

  -- 2) 결제가 끝난 주문만. pending/awaiting_payment/cancelled/refunded 는 보낼 확인서가 없다.
  select o.id, o.order_no, o.status, o.payment_method, o.paid_at,
         o.total_amount, o.currency, o.buyer_id
    into v_order
  from orders o
  where o.id = p_order_id
    and o.status in ('paid', 'shipped', 'done');
  if not found then
    raise exception 'not_payable' using errcode = 'P0002';
  end if;

  select p.name, p.email, p.locale into v_buyer
  from profiles p where p.id = v_order.buyer_id;

  -- 3) 주문 전체 항목(다른 판매자 것 포함) — 확인서는 구매자 관점이라 주문 전체가 맞다.
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'qty', oi.qty,
          'name_i18n', pr.name_i18n,
          'ticket_name_i18n', oi.ticket_name_i18n,
          'product_code', pr.code,
          'is_ticket', (pr.product_type = 'ticket')
        )
        order by oi.id
      ),
      '[]'::jsonb
    ),
    bool_or(pr.product_type = 'ticket')
    into v_items, v_has_ticket
  from order_items oi
  left join products pr on pr.id = oi.product_id
  where oi.order_id = p_order_id;

  return jsonb_build_object(
    'order_no', v_order.order_no,
    'status', v_order.status,
    'payment_method', v_order.payment_method,
    'paid_at', v_order.paid_at,
    'total_amount', v_order.total_amount,
    'currency', v_order.currency,
    'buyer_name', v_buyer.name,
    'buyer_email', v_buyer.email,
    'buyer_locale', coalesce(v_buyer.locale, 'en'),
    'has_ticket', coalesce(v_has_ticket, false),
    'items', v_items
  );
end;
$$;

-- 로그인한 사용자만 호출 가능. 판매자 여부는 함수 안에서 다시 본다.
-- anon 을 따로 회수하는 이유: Supabase 의 default privileges 가 새 함수에 anon EXECUTE 를
-- 자동으로 붙인다. from public 만으로는 그 '명시적' 부여가 지워지지 않는다.
-- (함수 안 auth.uid() 검사로도 막히지만, 0036 seller_advance_order 와 권한 표면을 맞춘다.)
revoke all on function seller_order_mail_payload(uuid) from public;
revoke all on function seller_order_mail_payload(uuid) from anon;
grant execute on function seller_order_mail_payload(uuid) to authenticated;

comment on function seller_order_mail_payload(uuid) is
  '오거나이저 구매확인 메일 재발송용 페이로드. 호출자가 해당 주문의 판매자일 때만, 결제완료 이후 주문에 한해 반환. 입장 QR 시크릿은 포함하지 않는다.';
