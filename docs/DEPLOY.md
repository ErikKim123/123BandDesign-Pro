# 배포 규칙 — "로컬에선 됐는데 사이트엔 안 나온다" 방지

## 왜 이 문서가 있나

2026-08-05, 상품 카드 가격 정렬 수정이 로컬에서는 보이는데 운영 사이트에는 없었다.
원인은 코드가 아니라 **커밋이 로컬 브랜치에만 있고 원격에도, main 에도 없었던 것**이었다.
Vercel 은 `origin/main` 만 보고 프로덕션을 만든다. 로컬 브랜치는 존재 자체를 모른다.

## 배포 경로 (이 경로 말고는 없다)

```
작업 브랜치 → git push → PR → (Vercel 프리뷰 빌드 통과) → main 머지 → 프로덕션 자동 배포
```

| 앱 | 프로덕션 도메인 | Vercel 프로젝트 |
|----|----------------|----------------|
| web | www.worldoflatinfestivals.com | `wolf2` |
| admin | wolf-admin-phi.vercel.app | `wolf-admin` |
| partner | wolf-partner.vercel.app | `wolf-partner` |

> web 프로젝트 이름이 `wolf2` 다. `wolf-web` 을 찾다가 없다고 착각하기 쉬우니 주의.

- **프로덕션 브랜치는 `main` 하나**다. 다른 브랜치는 아무리 푸시해도 프리뷰까지만 간다.
- DB 마이그레이션은 코드 배포와 별개다. `packages/supabase/migrations/` 는 Supabase SQL Editor 에
  직접 적용해야 하며, **컬럼 추가는 배포 전에** 먼저 적용한다(구버전 코드가 새 컬럼을 몰라도 되게).

## 반영 여부 확인 — 추측하지 말 것

```bash
pnpm deploy:check
```

4가지를 한 번에 본다.

1. 커밋 안 된 변경 → 배포 대상이 아님
2. 푸시 안 된 커밋 / 원격에 없는 브랜치 → Vercel 이 볼 수 없음
3. `origin/main` 에 머지 안 된 로컬 브랜치 → 프리뷰까지만 감
4. 운영 사이트가 실제로 서빙 중인 커밋 SHA (`/api/version`) vs `origin/main`

4번이 초록이면 "사이트에 반영됨"이 사실로 확인된 것이다. 브라우저 새로고침으로 판단하지 않는다.
(캐시/CDN 때문에 반영됐는데 안 보이거나, 안 됐는데 보이는 일이 둘 다 생긴다.)

```bash
curl -s https://www.worldoflatinfestivals.com/api/version
# {"sha":"…","short":"926e646","ref":"main","env":"production","message":"…"}
```

## 자주 꼬이는 지점

- **브랜치를 여러 개 두고 작업** — 지금도 로컬에만 있는 브랜치가 여럿이다. 작업이 끝나면
  바로 PR → 머지까지 가거나, 아니면 브랜치를 지운다. 어중간하게 남기지 않는다.
- **여러 세션이 같은 트리를 만짐** — 커밋 전에 `git status` 로 남의 작업이 섞였는지 먼저 본다.
  섞였으면 기능 단위로 나눠 커밋한다(한 커밋에 두 기능을 담지 않는다).
- **`.bkit/` 런타임 파일** — 도구 상태 파일이라 계속 변한다. `deploy:check` 는 이 경로를 무시한다.
- **Vercel 빌드 실패를 못 보고 지나감** — 머지했다고 배포된 게 아니다. `deploy:check` 4번이
  빨간색이면 Vercel 대시보드에서 빌드 로그를 본다.
