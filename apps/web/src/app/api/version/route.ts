// 배포된 코드가 어느 커밋인지 밖에서 확인하기 위한 엔드포인트.
// "로컬에선 되는데 사이트엔 반영이 안 됐다"를 추측이 아니라 SHA 비교로 판별한다.
// (scripts/deploy-check.mjs 가 이 값을 origin/main 과 대조한다.)
export const dynamic = 'force-dynamic';

export function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? null;
  return Response.json(
    {
      sha,
      short: sha ? sha.slice(0, 7) : null,
      ref: process.env.VERCEL_GIT_COMMIT_REF ?? null, // 배포된 브랜치
      env: process.env.VERCEL_ENV ?? 'local', // production | preview | development | local
      message: process.env.VERCEL_GIT_COMMIT_MESSAGE ?? null,
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
