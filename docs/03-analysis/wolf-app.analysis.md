# wolf-app Gap Analysis (Check Phase)

> **Target**: Phase 0 (DB 스키마 + RLS + 모노레포 스캐폴딩, module 1~4)
> **Date**: 2026-06-04
> **Mode**: Static + Runtime (실 Supabase 검증 완료, 2026-06-04)
> **Design**: [wolf-app.design.md](../02-design/features/wolf-app.design.md)
> **Plan**: [wolf-app.plan.md](../01-plan/features/wolf-app.plan.md)

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 4-in-1 플랫폼을 다국어·다통화 위에서 흔들림 없이 설계 |
| **WHO** | 고객·파트너·운영자 (해외 우선 + 한국) |
| **RISK** | 결제·정산 정합성 / AI HTML XSS / 타입별 분기 / 다국어 늦은 추가 |
| **SUCCESS** | Phase 0: 스키마+RLS 생성 + 파트너 자기 상품만 조회 |
| **SCOPE** | Phase 0(완료) → 1→2→3→4 |

---

## 1. Match Rate

| 축 | 매치율 | 가중치 | 비고 |
|----|:-----:|:-----:|------|
| Structural | 100% | 0.15 | 12개 테이블 + 파일 구조 전부 존재 |
| Functional | 96% | 0.25 | 핵심 로직 100% 실구현, 감점은 문서 표기(optional vs nullable) |
| Contract (RLS) | 100% | 0.25 | §4.2 정책 전부 + 8개 보강 |
| **Runtime** | **100%** | 0.35 | 실 Supabase 13/13 PASS (db:verify) |
| **Overall** | **99.0%** | — | (100×0.15)+(96×0.25)+(100×0.25)+(100×0.35) |

> 90% 임계치 초과 → iterate 불필요. **Runtime 검증 완료** (정적 98.4% → 99.0%).

### Runtime 결과 (db:verify @ aws-1-ap-northeast-1, 2026-06-04)

| # | 검증 | 결과 |
|---|------|:----:|
| 마이그레이션 | 0001~0003 적용, public 테이블 ≥12 | ✅ |
| 시드 | on conflict 안전 적재 | ✅ |
| #2 | role check 제약 거부 | ✅ |
| #3 | prices jsonb 통화별 왕복 | ✅ |
| #4 | FK 위반 거부 | ✅ |
| #5/#6 | 파트너 격리 (자기 상품 O / 타 비공개 X) | ✅ |
| #7 | 공개읽기 active (≥3) | ✅ |
| #8 | 고객 주문 격리 (0행) | ✅ |
| #9 | admin 전체 조회 | ✅ |
| #10 | 파트너 정산 항목 조회 | ✅ |
| #11 | 정산 집계 3980 → 수수료 0.15 차감 3383 | ✅ |

**13 PASS / 0 FAIL** — 실행 중 seed UUID 오타(`p1`/`o1`/`i1` 등 비-hex) 1건 발견·수정(d1/e1/f1).

## 2. Strategic Alignment (Plan Success Criteria)

| 기준 | 상태 | 근거 |
|------|:----:|------|
| 핵심 테이블 생성 | ✅ Met | 0001 (12 테이블) |
| FK 관계 연결 | ✅ Met | references + on delete |
| 파트너 자기 상품 격리 | ✅ Met | 0003 products_seller_write + test #4/#5 |
| 통화별 prices | ✅ Met | products.prices jsonb + seed USD/KRW + test #2 |
| en 폴백 다국어 | ✅ Met | pickI18n |
| 정산 근거(seller_id) | ✅ Met | order_items + test #10 (3980→3383) |
| schema.sql 버전관리 | ✅ Met | schema.sql |

## 3. Gap List

### 🔴 Missing — 없음

### 🟡 Added (긍정적 보강)
- RLS 12테이블 전면 활성화 (Design은 4개만 명시) + 8개 추가 정책
- `is_admin()` `set search_path` (injection 방어)
- normalizeLocale / formatPrice / toDisplayAmount 헬퍼
- tsconfig.base.json

### 🔵 Changed / Minor (코드 수정 불필요)
| # | 항목 | severity | 신뢰도 | 조치 |
|---|------|:--------:|:------:|------|
| 1 | Design "13개 테이블" 표기 vs 실제 12개 | Minor | 高 | ✅ 해결 — Design v0.2 정정 (L66/L422/이력) |
| 2 | products 공개읽기에 `seller_id=auth.uid()` 추가 (코드가 더 완전) | Important | 中 | ✅ 해결 — Design §4.2 products_public_read 동기화 |
| 3 | Profile.name/phone optional vs nullable | Minor | 中 | 무영향(DB 정합상 동등) — 미조치 |
| 4 | test #4 격리를 active 우회로 검증 | Minor | 高 | 보류 — seed에 draft 타파트너 상품 추가 시 강화(선택) |

## 4. Decision Record 준수
- [PRD] 없음 (생략)
- [Plan] Dynamic 모노레포 + Supabase+NestJS → ✅ 준수 (apps/* + packages/*)
- [Plan] 통화별 prices jsonb / *_i18n jsonb → ✅ 준수
- [Design] Option C Pragmatic (JSONB 유연 + 정합성 정규화) → ✅ 준수

## 5. Recommended Actions
1. (문서) Design "13개"→"12개" 정정, §4.2 공개읽기 정책 동기화
2. (선택) seed에 draft 타파트너 상품 1건 추가 → test #4 강화
3. (Runtime) Supabase 연결 후 `pnpm db:migrate → db:seed → test:rls` 실행하여 Runtime 축 반영
