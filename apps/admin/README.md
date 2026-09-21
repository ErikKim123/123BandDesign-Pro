# @123band/admin — 운영자 관리 페이지

> 플레이스홀더. Phase 1 에서 실제 구현.

- **스택**: Next.js (App Router), Tailwind
- **인증**: Supabase Auth + `role='admin'` 체크, RLS admin 정책 (`is_admin()`)
- **관리 화면 (Phase 1)**: 회원 / 파트너(입점 승인) / 상품(자사·파트너 구분, 승인) / 카테고리(대·중 트리) / 주문 / 배송 / 게시판 / 배너 / 메인화면
- **패턴**: 목록(검색·필터) → 상세/편집 → 저장 반복, 공통 테이블·폼 컴포넌트

실제 Next.js 초기화는 Phase 1 시작 시 진행.
