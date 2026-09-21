#!/usr/bin/env node
// 배포 반영 점검 — "로컬에선 됐는데 사이트엔 안 나온다"의 원인을 한 번에 보여준다.
//
//   node scripts/deploy-check.mjs            (= pnpm deploy:check)
//
// 점검 항목
//   1) 커밋 안 된 변경           → 애초에 배포 대상이 아님
//   2) 푸시 안 된 커밋 / 브랜치  → 원격에 없어서 Vercel 이 볼 수 없음
//   3) main 에 머지 안 된 브랜치 → 프리뷰만 뜨고 프로덕션엔 안 감
//   4) 운영 사이트의 커밋 SHA    → origin/main 과 다르면 배포가 아직/실패
//
// 종료코드: 문제 없으면 0, 하나라도 걸리면 1.
import { execSync } from 'node:child_process';

const SITES = [
  { name: 'web(운영)', url: 'https://123band-web.vercel.app/api/version' },
];
// 커밋 여부를 따지지 않는 경로(로컬 도구 상태 파일 등)
const IGNORE_DIRTY = [/^\.bkit\//];

const gitRaw = (cmd) => execSync(`git ${cmd}`, { encoding: 'utf8' });
const git = (cmd) => gitRaw(cmd).trim();
const lines = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean);

let problems = 0;
const bad = (msg, detail) => {
  problems++;
  console.log(`  ✗ ${msg}`);
  for (const d of detail ?? []) console.log(`      ${d}`);
};
const good = (msg) => console.log(`  ✓ ${msg}`);

console.log('\n[1] 커밋 안 된 변경');
// porcelain 은 앞 2칸이 상태코드(' M ', '?? ') — trim 하면 첫 줄의 경로 앞이 잘리므로 원본을 쓴다.
const dirty = gitRaw('status --porcelain')
  .split('\n')
  .filter(Boolean)
  .map((l) => l.slice(3).replace(/^"|"$/g, ''))
  .filter((f) => !IGNORE_DIRTY.some((re) => re.test(f)));
if (dirty.length) bad(`${dirty.length}개 파일이 커밋되지 않았습니다`, dirty.slice(0, 15));
else good('작업 트리 깨끗함');

console.log('\n[2] 푸시 안 된 커밋');
git('fetch origin --quiet');
const branch = git('rev-parse --abbrev-ref HEAD');
let upstream = null;
try {
  upstream = git('rev-parse --abbrev-ref --symbolic-full-name @{u}');
} catch {
  /* 업스트림 없음 */
}
if (!upstream) {
  bad(`현재 브랜치 '${branch}' 가 원격에 없습니다 — git push -u origin ${branch}`);
} else {
  const ahead = lines(git(`log --oneline ${upstream}..HEAD`));
  if (ahead.length) bad(`${upstream} 보다 ${ahead.length}개 앞섬 — 푸시 필요`, ahead);
  else good(`${upstream} 와 동기화됨`);
}

console.log('\n[3] main 에 머지 안 된 로컬 브랜치');
const unmerged = lines(git('branch --format=%(refname:short)'))
  .filter((b) => b !== 'main')
  .map((b) => ({ b, n: lines(git(`log --oneline origin/main..${b}`)).length }))
  .filter((x) => x.n > 0);
if (unmerged.length) {
  bad(
    `${unmerged.length}개 브랜치의 작업이 origin/main 에 없습니다`,
    unmerged.map((x) => `${x.b} (+${x.n} 커밋)`),
  );
} else good('모든 로컬 브랜치가 origin/main 에 반영됨');

console.log('\n[4] 운영 사이트에 올라간 커밋');
const mainSha = git('rev-parse origin/main');
console.log(`  origin/main = ${mainSha.slice(0, 7)} ${git('log -1 --format=%s origin/main')}`);
for (const site of SITES) {
  try {
    const res = await fetch(site.url, { cache: 'no-store' });
    if (!res.ok) {
      bad(`${site.name}: /api/version 응답 ${res.status} (배포 후 이 엔드포인트가 생깁니다)`);
      continue;
    }
    const v = await res.json();
    if (!v.sha) bad(`${site.name}: 커밋 정보 없음 (VERCEL_GIT_COMMIT_SHA 미노출)`);
    else if (v.sha !== mainSha) {
      bad(`${site.name}: 배포된 커밋이 origin/main 과 다릅니다`, [
        `사이트 = ${v.short} (${v.ref ?? '?'} / ${v.env})`,
        `main   = ${mainSha.slice(0, 7)}`,
        '→ Vercel 배포가 아직 진행 중이거나 실패했습니다.',
      ]);
    } else good(`${site.name}: origin/main 과 동일 (${v.short})`);
  } catch (e) {
    bad(`${site.name}: 확인 실패 — ${e.message}`);
  }
}

console.log(
  problems === 0
    ? '\n결과: 로컬 = 원격 = 운영. 반영 누락 없음.\n'
    : `\n결과: ${problems}건 확인 필요. 위 항목을 순서대로 해결하세요.\n`,
);
process.exitCode = problems === 0 ? 0 : 1;
