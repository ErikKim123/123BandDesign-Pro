# @123band/supabase — 스키마 단일 소스

Supabase(Postgres) 스키마/마이그레이션/RLS/seed 의 단일 소스. (Design §3.3, §4.2, §11.1)

## DB 구조 — 울프와 같은 Supabase, 스키마는 band123

123Band 는 울프·JNJ(public)·BATTLE(battle)·DIV(div)·AI심사(ai_judge) 와 **같은 Supabase 프로젝트**를 쓴다.
나중에 별도 프로젝트로 옮기기 쉽도록 123Band 것은 전부 이름으로 갈라 둔다.

| 구분 | 123Band | 울프 |
|------|---------|------|
| 테이블·함수·타입 | `band123` 스키마 | `public` |
| Storage 버킷 / 정책 | `band123-*` / `band123_*` | 접두사 없음 |
| auth.users 트리거 | `band123_*` (user_metadata.service = 'band123' 일 때만) | `on_auth_user_created` |
| 로그인 계정 | **공유** — `app_metadata.services` 에 `band123` 태그가 있어야 123Band 회원 | 태그 없음 |

- 가입: 모든 가입 경로가 `user_metadata.service = 'band123'` 을 넘긴다 → DB 트리거가 태그·`band123.profiles` 생성
- 로그인: 태그 없는 계정(울프 회원)은 로그인 화면·미들웨어에서 차단(`signOut({ scope: 'local' })` — 울프 세션은 유지)
- DB: RLS 가 켜진 band123 테이블에 restrictive 정책(`band123_members_only`) — 새 테이블을 만들면 0123 의 루프를 다시 적용
- 소셜(OAuth) 로그인은 태그를 달 수 없어 공유 기간 동안 숨긴다(`AuthForm` 의 `SHOW_SOCIAL_LOGIN`)

### 구축

1. API 노출 스키마에 `band123` 추가 (없으면 모든 요청이 PGRST106)
   - ⚠️ 이 프로젝트는 대시보드(Data API > Exposed schemas)가 아니라 **DB 의 `authenticator` 역할 설정이 우선**한다
     (`pgrst.db_schemas`, BATTLE·DIV 작업 때 SQL 로 넣은 것). 대시보드에서 저장해도 반영되지 않는다.
   - 확인: `select setconfig from pg_db_role_setting s join pg_roles r on r.oid = s.setrole where r.rolname = 'authenticator';`
   - 추가(2026-09-22 적용됨): `alter role authenticator set pgrst.db_schemas = 'public, graphql_public, div, battle, band123';`
     그 뒤 `notify pgrst, 'reload config'; notify pgrst, 'reload schema';`
   - 다른 서비스(BATTLE·DIV 등)가 이 값을 다시 설정할 때 `band123` 을 빠뜨리면 123Band API 가 전부 멈춘다 — 목록을 통째로 유지할 것
2. `pnpm db:bootstrap --wolf-side` — 시험 실행(전부 적용 후 ROLLBACK). 결과 확인
3. `pnpm db:bootstrap --wolf-side --commit` — 실제 반영(한 트랜잭션)
   - `--wolf-side`: 울프 가입 트리거가 123Band 가입을 건너뛰게 하는 변경(`wolf-side/`). 울프 저장소에도 같은 변경을 넣을 것
   - `--replace-existing`: 예전 시도가 남긴 band123 을 지우고 새로 만든다(행 10개 이하일 때만)
   - 적용 전 정적 검사로 public·공용 트리거/정책/버킷 이름을 쓰는 SQL 이 있으면 거부한다

⚠️ `seed.sql`·`schema.sql`·`tests/db/*.sql` 을 psql 로 직접 실행하지 말 것 — 검색 경로가 public 이라 울프 쪽에 쓴다.
⚠️ 마이그레이션을 새로 쓸 때는 `band123.` 을 붙이고, storage 정책·버킷·auth 트리거에는 band123 접두사를 붙인다.

## 마이그레이션 적용 순서

| 파일 | 내용 | 상태 |
|------|------|:----:|
| `migrations/0001_init_tables.sql` | 13개 테이블 + check 제약 | ✅ (module-2) |
| `migrations/0002_indexes_triggers.sql` | 인덱스 + updated_at 트리거 | ✅ (module-2) |
| `migrations/0003_rls_policies.sql` | RLS 정책 + `is_admin()` | ✅ (module-3) |
| `seed.sql` | 시드 데이터 (admin/partner/customer + 카테고리 3 + 상품 3종 + 정산용 주문) | ✅ (module-4) |
| `tests/db/rls.test.sql` | L1 DB/RLS 10 시나리오 (파트너 격리·정산 집계) | ✅ (module-4) |
| `schema.sql` | 확정 스냅샷(마이그레이션 순차 적용 진입점) | ✅ (module-4) |

> ℹ️ `0004` 이후 마이그레이션은 러너(`schema.sql` / `verify.mjs`)에 포함되어 있지 않다.
> **Supabase SQL Editor 에 번호 순서대로 직접 붙여넣어 적용**한다.
> 최근 추가분: `0030_app_settings.sql`(인스타 계정·토큰 저장), `0031_instagram_posts.sql`(인스타 예약 게시 + `instagram-media` 버킷),
> `0037_points.sql`(포인트 원장 + 가입 축하 포인트), `0038_point_coupon_exchange.sql`(포인트↔쿠폰 교환 + 결제확정 훅),
> `0039_content_point_events.sql`(후기·댓글 작성 포인트 이벤트), `0040_achievements.sql`(업적·뱃지 + `badges` 버킷),
> `0043_social_profile.sql`(캐릭터 시드·소셜 코드·내 QR / 소셜 하트 / 친구 추천 + 어드민 소셜관리 뷰·통계),
> `0044_social_avatar_style.sql`(캐릭터 성별 선택 `avatar_style` + 표시 이름 40자 제한 + 소셜 RPC 4종 갱신),
> `0045_avatar_animal_styles.sql`(캐릭터에 강아지·고양이 추가 — `avatar_style` 허용값 4종으로 확장) — **적용 완료(2026-08-04)**,
> `0046_social_reactions.sql`(소셜 반응 5종 — `social_hearts.kind` 추가, 하루 1회 기준을 종류별로 변경, 소셜 RPC 3종·어드민 뷰 갱신).
> ⚠️ `0046` 은 `give_social_heart(text, text)` 를 **삭제하고** 3인자 버전으로 대체한다. 웹 배포와 순서를 맞출 것
> (마이그레이션 먼저 → 웹 배포). 먼저 배포하면 구버전 웹이 2인자 호출로 404 를 받는다.
> `0047_social_notifications.sql`(하트 알림 — `social_hearts.read_at` 안읽음 표시, `push_subscriptions` 웹푸시 구독,
> `profiles.notify_email_digest` 이메일 요약 수신 설정, RPC 6종, `social_hearts` Realtime 게시).
> ℹ️ `0047` 은 전부 추가(additive)라 기존 동작을 바꾸지 않는다 — `0046` 과 순서 무관, 웹 배포 전후 아무 때나 적용 가능.
> `0056_page_views.sql`(어드민 방문자수/트래픽수 메뉴 — `page_views` 테이블 + 집계 RPC 3종
> `admin_traffic_daily`/`admin_traffic_top_paths`/`admin_traffic_top_referrers`. web 앱이 `/api/track` 에서
> service_role 로만 기록하므로 insert RLS 정책은 없다). ℹ️ 전부 추가(additive) — 순서 무관, 아무 때나 적용 가능.
> **web 배포와 함께(또는 먼저) 적용해야** 미들웨어가 발급하는 `band_vid` 쿠키 기반 수집이 시작된다(먼저 적용 안 해도
> 에러는 안 나고, 적용 전 방문은 그냥 집계되지 않는다).
> `0048_boards_i18n.sql`(게시판 다국어 — `boards.title_i18n`/`content_i18n` 추가 + 기존 글 이관(한글 포함→ko, 그 외→en)
> + 레거시 `title`/`content` 동기화 트리거 `trg_boards_sync_legacy`).
> ℹ️ `0048` 은 컬럼 추가 + 레거시 컬럼 유지라 구버전 웹도 그대로 동작한다 — 적용 순서 무관.
> 적용 후 어드민 게시판관리에서 "번역" 컬럼이 `한글 없음` 인 글을 열어 KO 탭을 채우면 된다.
> `0050_banner_images.sql`(배너 이미지 업로드용 `banners` 버킷 — 공개 읽기 + 어드민 쓰기).
> `0051_social_daily_one_per_friend.sql`(소셜 반응 하루 제한을 **친구당 1개**로 축소 — `0046` 의 종류별 1회를 되돌린다).
> ⚠️ `0051` 은 같은 (보낸이, 받는이, 날짜) 중복 행을 **가장 이른 1건만 남기고 삭제**한 뒤 유니크 인덱스를 건다.
> 웹 배포와 순서를 맞출 것(마이그레이션 먼저 → 웹 배포). 먼저 배포하면 구버전 UI 가 두 번째 반응을 보낼 수 있는 것처럼 보인다.
> ℹ️ `0050` 은 버킷·정책 추가뿐이라 순서 무관. **어드민 배너 이미지 업로드를 쓰려면 반드시 먼저 적용**해야 한다
> (미적용 시 업로드에서 `Bucket not found` 가 뜬다).
> ⚠️ `0037` → `0038` → `0039` → `0040` 순서로 적용해야 한다(뒤 파일이 앞 파일의 함수·제약·트리거를 참조).
> ⚠️ `0043` 은 `profiles` 에 컬럼 DEFAULT(`gen_social_code()`)와 BEFORE UPDATE 트리거(`profiles_social_guard`)를 건다.
> 이후 `profiles` 를 다루는 마이그레이션은 이 트리거가 `social_code`/`referred_by`/`social_blocked_at` 변경을
> 어드민이 아닌 주체에 대해 되돌린다는 점을 전제로 작성할 것.

## 적용 방법 (실제 Supabase)

### 방법 A — Node 러너 (psql 불필요, 권장)
1. Supabase 프로젝트 생성 → 루트 `.env` 에 키 + `DATABASE_URL` 기입 (`.env.example` 참고)
   - `DATABASE_URL` = Settings > Database > Connection string > URI (postgres 직접 연결)
2. `pnpm --filter @123band/supabase install` (pg 드라이버 설치)
3. `pnpm --filter @123band/supabase db:verify`
   → migrate(0001~0003) → seed → RLS 11 assert 자동 실행, `PASS/FAIL` 요약 출력
   - 건너뛰기: `SKIP_MIGRATE=1` / `SKIP_SEED=1`

### 방법 B — psql
1. `.env` 에 `DATABASE_URL` 기입
2. `pnpm --filter @123band/supabase migrate` → `seed` → `test:rls`
   - 핵심 검증: **#4/#5 파트너 격리**, **#7 고객 주문 격리**, **#10 정산 집계(3980 → 수수료 0.15 차감 3383)**

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` 는 서버 전용. 프런트/깃 노출 금지 (`.gitignore` 처리됨).
> ⚠️ `seed.sql` / `test:rls` 는 RLS 우회가 필요해 **service_role 또는 postgres** 연결로 실행.
