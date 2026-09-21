-- 0033: 계좌이체/카카오페이/Wise 송금 주문 지원.
-- ⚠️ SQL Editor 에서 0032 적용 후 실행.
-- 고객이 송금 후 "알림 보내기"를 누르면 주문이 생성되는데, 카드결제(pending→즉시 PG)와 달리
-- 운영자가 입금을 수동 확인하기 전까지 '입금 확인 대기(awaiting_payment)' 상태로 마이페이지에 노출된다.
-- (getMyOrders 는 'pending' 만 숨기므로 awaiting_payment 는 자동으로 보인다.)
-- 운영자가 주문관리에서 awaiting_payment → paid('결제확인')로 전이하면 결제완료 처리된다.

alter table orders drop constraint if exists orders_status_check;
alter table orders
  add constraint orders_status_check
  check (status in ('pending','paid','shipped','done','cancelled','refunded','awaiting_payment'));

-- 송금 결제수단 표기. 기존 stripe/portone 에 transfer(계좌이체/송금) 추가.
alter table orders drop constraint if exists orders_payment_method_check;
alter table orders
  add constraint orders_payment_method_check
  check (payment_method in ('stripe','portone','transfer'));
