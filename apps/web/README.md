# @123band/web — 고객용 쇼핑몰

> 플레이스홀더. Phase 0(데이터 계층) 이후 단계에서 실제 구현.

- **스택**: Next.js (App Router), SSR + locale 라우팅(`/en`, `/ko`), Tailwind, react-query
- **인증/데이터**: Supabase anon 클라이언트 (`@123band/shared` → `createBrowserClient`), RLS 적용
- **구현 시점**:
  - Phase 2 — 메인페이지 (main_sections / banners 렌더링)
  - Phase 3 — 상품 상세 (+AI 생성 HTML 렌더, sanitize)
  - Phase 4 — 장바구니/주문/결제(Stripe/PortOne)/구독/티켓, 다국어 마감

실제 Next.js 초기화(`create-next-app`)는 Phase 2 시작 시 진행.
