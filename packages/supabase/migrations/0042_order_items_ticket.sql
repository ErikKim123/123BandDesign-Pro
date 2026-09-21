-- 0042: 주문항목에 '어떤 패스를 샀는지' 를 남긴다.
-- 배경: 장바구니·결제화면까지는 티켓(패스) 티어를 들고 다니는데(CartContext.ticketKey/ticketName)
--       주문 생성 시 order_items 에는 단가만 남고 티어 정보가 통째로 버려졌다.
--       그래서 어드민 주문상세·파트너 주문관리·주문내역이 전부 '행사명'만 보여준다.
-- ticket_key       = event_content.tickets[].key (원본 참조)
-- ticket_name_i18n = 구매 시점 티켓명 스냅샷. 오거나이저가 나중에 티켓명을 바꿔도 주문서는 그대로 남아야 한다.
-- 둘 다 nullable — 일반상품(physical) 주문과 이 마이그레이션 이전 주문은 null 이다.
-- (레거시 주문은 표시 단에서 단가↔가격구간 역추적으로 보완한다.)
-- idempotent.

alter table order_items add column if not exists ticket_key text;
alter table order_items add column if not exists ticket_name_i18n jsonb;

comment on column order_items.ticket_key is
  '구매한 티켓(패스) 티어 키 — products.event_content->tickets[].key. 일반상품/레거시 주문은 null.';
comment on column order_items.ticket_name_i18n is
  '구매 시점 티켓명 스냅샷({"ko":"풀 패스","en":"Full Pass"}). 티켓명이 나중에 바뀌어도 주문서는 유지.';
