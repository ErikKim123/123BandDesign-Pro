# @123band/api — NestJS 백엔드

> 플레이스홀더. Phase 3/4 에서 실제 구현.

- **스택**: NestJS
- **데이터 접근**: Supabase service_role 클라이언트 (`@123band/shared` → `createAdminClient`, RLS 우회)
- **책임 (민감/복합 로직)**:
  - Phase 3 — AI 상품페이지 생성 (Claude API 호출, 고정 템플릿, 영어 생성→번역), HTML sanitize
  - Phase 4 — 결제(Stripe 해외 / PortOne 국내, PaymentProvider 추상화), 파트너 정산(order_items.seller_id × commission_rate), 구독 반복결제
- **보안**: `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `PORTONE_API_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` 는 서버 전용(.env)

실제 NestJS 초기화는 Phase 3 시작 시 진행.
