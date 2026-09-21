-- Design Ref: §5 Phase 4 — 결제 연동 (Stripe en/USD · PortOne ko/KRW)
-- ⚠️ SQL Editor 에서 0001~0006 적용 후 실행.
-- 목적: PG 결제건과 주문을 연결할 추적 컬럼. 상태 전환(pending→paid)은 서버 webhook/complete 에서 admin 키로 수행.

-- PG 측 결제 식별자(Stripe: checkout session/payment_intent id, PortOne: paymentId) 와 결제 완료 시각
alter table orders add column if not exists payment_ref text;
alter table orders add column if not exists paid_at timestamptz;

-- 멱등 확정 조회용: 같은 PG 결제건이 두 번 들어와도 한 번만 처리되도록 ref 로도 찾는다
create index if not exists orders_payment_ref_idx on orders (payment_ref);
