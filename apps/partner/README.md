# @123band/partner — 파트너 입점 관리 페이지

운영자(123Band Admin)와 동일한 디자인/패턴으로, **파트너 본인 데이터에 한정된** 관리 페이지.

- **스택**: Next.js (App Router), Tailwind — admin 과 동일 컴포넌트/프레임워크
- **포트**: `3002` (admin=3001, web=3000)
- **인증**: Supabase Auth + `role='partner'` 게이트. RLS 가 본인 행만 노출/수정 보장
  - `products.seller_id = auth.uid()` — 자기 상품 CRUD
  - `order_items.seller_id = auth.uid()` — 자기 판매/정산 조회
  - `partners.user_id = auth.uid()` — 자기 입점 정보
- **메뉴**
  - 대시보드 — 내 상품/판매/정산 요약
  - 상품관리 — 실물·구독 상품 (등록·수정·승인요청, AI 상세·번역, 이미지 업로드)
  - 행사패스관리 — 티켓 상품 (이벤트 콘텐츠 에디터)
  - 판매/정산 — 내 상품이 포함된 주문 내역 + 수수료 차감 정산액
  - 내 정보 — 회사명/사업자번호/정산정보 (수수료율은 운영자가 설정, 읽기전용)
- **승인 흐름**: 파트너는 상품을 `초안 → 승인요청(pending)` 까지. `판매중(active)` 전환(승인)은 운영자 권한.

## 로컬 실행

```bash
cp .env.local.example .env.local   # SUPABASE URL/ANON KEY 채우기 (admin 과 동일 값)
pnpm --filter @123band/partner dev
```

테스트 계정: `partner@123band.test` / `Band!2026`
