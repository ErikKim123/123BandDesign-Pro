-- 0034: 송금(서브통화) 주문의 '고객 표시 통화/금액' 병기.
-- ⚠️ SQL Editor 에서 0033 적용 후 실행. (web/admin 배포 前에 먼저 적용 — 주문내역/주문관리가 이 컬럼을 읽는다.)
-- 배경: 결제 통화는 늘 USD/KRW(정산·PG·매출통계 기준)지만, 고객이 웹에서 바트(THB 등 서브통화)로 보고
--       송금하면 어드민/주문내역에 '고객이 본 통화·금액'을 함께 보여줘야 한다.
-- 원칙: canonical(currency/total_amount)은 그대로 두고(정산·통계 불변), 표시 전용 컬럼만 추가한다.
--       display_* 는 서브통화(THB/VND/CNY/JPY)도 허용하므로 CHECK 제약을 두지 않는다. null 이면 canonical 사용.

alter table orders add column if not exists display_currency text;
alter table orders add column if not exists display_total int;

comment on column orders.display_currency is '고객 표시 통화(THB 등 서브통화 포함). null 이면 canonical currency 사용. 표시 전용.';
comment on column orders.display_total is '표시 통화 기준 결제금액(최소단위). display_currency 와 짝. 정산/통계엔 미사용.';
