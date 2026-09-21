# bkit 상태 재동기화 — 2026-08-04

> **목적**: 2026-06-04 이후 두 달간 bkit 추적 밖에서 진행된 작업을 git 이력으로부터 복원해 `.bkit/state/pdca-status.json` 에 반영한다.
>
> **범위**: `main` 기준 2026-06-04 ~ 2026-08-04, merge 제외 254 커밋
> **수행**: Claude Opus 5 (사용자 승인: "전체 재동기화")

---

## 1. 재동기화 전 상태

| 항목 | 값 |
|---|---|
| `lastUpdated` | 2026-06-04T02:16:36Z |
| activeFeatures | `wolf-app`, `wolf-admin` — 둘 다 `completed` |
| history | 15건, 전부 동일 타임스탬프(6/4) |
| 설계 문서 | `docs/01-plan/features/` 2건, `docs/02-design/features/` 5건 |

6월 4일 이후 실제로 출시된 기능 — 파트너 포털, 행사패스 위저드, 결제 수단 확장, SEO, 인스타 마케팅, 선물하기, 포인트·업적, 법무 문서 — 은 **단 한 건도 상태 파일에 기록되지 않았다.**

## 2. 복원 방법과 그 한계

### 방법
`git log --since=2026-06-04 --no-merges` 의 커밋 제목을 키워드로 분류해 17개 피처로 묶고, 각 피처의 최초·최종 커밋일과 커밋 수를 집계했다. 커밋 수는 키워드가 중복 매칭되므로 **정확한 값이 아니라 규모의 지표**로만 사용한다.

### 한계 — 반드시 인지할 것

**back-fill 한 피처에는 matchRate 를 부여하지 않았다(`null`).**

bkit 의 matchRate 는 *구현 이전에 작성된 설계 문서*와 실제 코드를 대조해 산출하는 값이다. 이번에 복원한 피처들은 설계 문서 없이 구현이 먼저 끝났으므로, 지금 코드를 읽어 설계 문서를 역산하면 그 문서는 정의상 코드와 100% 일치한다. 그렇게 만든 수치는 검증의 의미가 없고, 오히려 "검증되었다"는 잘못된 신호를 준다.

따라서:

- `wolf-app`(99.0%), `wolf-admin`(96.4%) — 6/4 당시 실제 Check 를 거친 값이므로 **그대로 보존**
- 복원 피처 15종 — `matchRate: null`, `matchRateMode: "not-measured"`, `docsBackfilled: false`

설계 문서가 필요한 피처는 향후 변경 작업 시점에 정식으로 Plan/Design 을 작성하고 그때 Check 를 돌리는 것이 옳다.

## 3. 복원한 피처 목록

기존 2종 + 신규 15종 = 17종.

| # | feature | 기간 | 커밋 | phase | 비고 |
|---|---|---|---|---|---|
| 1 | `wolf-app` | ~2026-06-04 | — | completed | matchRate 99.0 (실측 보존) |
| 2 | `wolf-admin` | ~2026-06-04 | — | completed | matchRate 96.4 (실측 보존) |
| 3 | `partner-portal` | 06-09 ~ 07-31 | ~92 | completed | apps/partner 신설, i18n, 주문관리 |
| 4 | `event-pass` | 06-09 ~ 08-03 | ~37 | completed | 위저드, Price Hike 3구간, 다중티켓 |
| 5 | `ai-content` | 06-16 ~ 07-27 | ~15 | completed | 포스터 분석 자동채움, EN→KO 번역, 섹션 초안 |
| 6 | `payments` | 06-18 ~ 07-30 | ~25 | completed | PortOne 단일화, 다중 수단, 송금(Wise/SWIFT/위챗) |
| 7 | `auth-account` | 06-05 ~ 08-03 | ~32 | completed | 소셜·전화 로그인, 세션 분리, 탈퇴, 약관동의 |
| 8 | `checkin-gifts` | 06-25 ~ 07-23 | ~12 | completed | passes, QR 입장확인, 다회입장, 선물하기 |
| 9 | `community` | 06-09 ~ 08-03 | ~8 | completed | 상품 후기·QnA 게시판, 뉴스레터 채널 |
| 10 | `design-system` | 06-29 ~ 07-07 | ~2 | completed | Wolf Design System(선셋) 도입, JNJ 제거 |
| 11 | `mobile-ux` | 06-16 ~ 08-03 | ~16 | completed | 드로어, 캐러셀, PWA 북마크, 파비콘 |
| 12 | `seo` | 06-16 ~ 07-27 | ~11 | completed | 메타/canonical/sitemap/JSON-LD, 슬러그 URL, 로컬 시그널 |
| 13 | `instagram-marketing` | 07-13 ~ 07-23 | ~8 | completed | Graph API 게시, 예약, 구글시트 일괄 |
| 14 | `currency` | 06-28 ~ 07-28 | ~10 | completed | 표시 전용 서브통화(THB/VND/CNY/JPY) |
| 15 | `travel-affiliate` | 07-28 ~ 07-30 | ~7 | completed | 항공·숙박 어필리에이트 섹션 |
| 16 | `points-achievements` | 08-03 | ~4 | completed | 포인트 적립·쿠폰 교환·업적 뱃지 |
| 17 | `legal-docs` | 08-04 | 1 | check | 법무 문서 7종 — PR #13, 머지 대기 |
| 18 | `social-profile` | 진행 중 | 0 | do | 미커밋. 공개 프로필·하트·친구 추천 |

`seo` 는 예외적으로 설계 문서가 존재한다 — `docs/02-design/features/seo-{title,url,local-signal}.md` 3건. 해당 경로를 연결했다.

## 4. 진행 중인 작업 2건

**`legal-docs`** — 오늘 작업. Drive 법무 문서 7종을 반영해 [PR #13](https://github.com/ErikKim123/Wolf/pull/13) 생성. 신규 4페이지(`/cookies`, `/guidelines`, `/ip`, `/organizer-terms`) + 기존 3종 개정 + `customerTerms.ts` 병합. 타입체크 통과, 머지 대기 상태이므로 `phase: "check"`.

**`social-profile`** — 별도 세션에서 개발 중이며 워킹트리에 미커밋 상태. `0043_social_profile.sql`(avatar_seed / social_code / social_hearts / referred_by), `/u/[code]` 공개 프로필, admin 소셜 관리 화면. `phase: "do"`.

두 작업은 서로 맞물린다 — `legal-docs` 의 개인정보처리방침·약관에 `social-profile` 의 공개 범위가 이미 반영되어 있다. `social-profile` 이 머지되면 법무 문언과 구현이 일치하고, 반대로 `social-profile` 의 공개 범위가 바뀌면 법무 문서도 함께 고쳐야 한다.

## 5. 후속 권고

1. **매칭률 없는 피처는 다음 변경 때 정식 PDCA 를 태울 것.** 지금 소급해서 설계 문서를 만드는 것은 권장하지 않는다(§2 참조).
2. **`social-profile` 은 지금이라도 Plan/Design 을 작성할 수 있다.** 아직 머지 전이므로 설계-구현 대조가 의미를 가진다.
3. **상태 파일이 다시 두 달 방치되지 않게 할 것.** 기능 단위 작업 시작 시 `/pdca plan {feature}` 을 태우는 것만으로도 이력이 남는다.
