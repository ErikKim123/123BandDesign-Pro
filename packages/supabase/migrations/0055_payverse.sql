-- 0055: 결제 PG 를 PortOne → PayVerse(이롬넷)로 교체.
-- ⚠️ SQL Editor 에서 0054 적용 후 실행.
--
-- payment_method 에 'payverse' 를 추가한다. 기존 값(stripe/portone)은 과거 주문 데이터를 깨뜨리지
-- 않도록 체크 목록에 남겨 둔다(신규 주문은 payverse/transfer 만 쓴다).
alter table orders drop constraint if exists orders_payment_method_check;
alter table orders
  add constraint orders_payment_method_check
  check (payment_method in ('payverse','transfer','stripe','portone'));

comment on column orders.payment_ref is
  'PG 결제 식별자. PayVerse 는 거래 TID(String(20)). 무료주문은 ''free''.';
