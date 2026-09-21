// Design Ref: J&J 참가 신청 섹션의 '지금 몇 명' — 신청 버튼 옆에 큰 숫자로 선다.
//
// 신청은 이 서비스가 아니라 JNJ Dash(별도 앱)가 받는다. 그래서 인원은 우리 DB 에 없고,
// JNJ Dash 의 공개 메타 API 에서 그때그때 가져온다. 링크에 박힌 대회 코드가 열쇠다:
//   https://jnj-dash-db.vercel.app/join/JNJ-BLF2026-1 → JNJ-BLF2026-1
//
// 실패해도 화면이 깨지지 않는다 — 못 가져오면 숫자 자리가 통째로 빠지고 버튼만 남는다.
// 신청은 초 단위로 늘어나는 값이 아니라 60초 캐시로 충분하고, 그래야 대회 페이지가
// 남의 서버 응답 속도에 묶이지 않는다.
import type { Dictionary } from '@/i18n/dictionaries';
import { JnjCountBoard } from './JnjCountBoard';

/** JNJ Dash 로 인정하는 호스트. 서버가 아무 주소나 호출하지 않게 화이트리스트로 묶는다. */
const DASH_HOSTS = new Set(['jnj-dash-db.vercel.app']);

/**
 * 신청 링크에서 대회 코드를 뽑는다. 참가 신청은 /join/{code}, 관객 심사위원 등록은 /ojudge/{code},
 * 심사위원 로그인은 /ovote/{code} — 어느 쪽이든 뒤쪽 코드는 같은 대회를 가리킨다.
 *
 * ovote 까지 받는 이유: 운영자가 등록 링크(/ojudge) 대신 로그인 링크(/ovote)를 붙여 두는 일이 있다.
 * 여기서 코드를 못 뽑으면 인원 표시가 빠지고, 회원 바로 입장(judge-sso)도 꺼져 PIN 을 다시 묻게 된다.
 */
const DASH_JOIN_PATHS = new Set(['join', 'ojudge', 'ovote']);

export function dashContestId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!DASH_HOSTS.has(u.hostname)) return null;
    const [path, code] = u.pathname.split('/').filter(Boolean);
    if (!path || !DASH_JOIN_PATHS.has(path) || !code) return null;
    return decodeURIComponent(code);
  } catch {
    return null;
  }
}

interface MetaResponse {
  data?: { participantStats?: { leaders?: number; followers?: number } | null } | null;
}

/**
 * 접수된 참가자 수 — 리더 + 팔로워. 헬퍼(인원 맞추려 함께 추는 사람)는 경쟁자가 아니라 뺀다.
 * 어떤 이유로든 못 가져오면 null — 0 으로 내려 '아무도 신청 안 했다'고 말하지 않는다.
 */
async function fetchEntryCount(contestId: string): Promise<number | null> {
  try {
    // 타임아웃을 AbortSignal 로 걸지 않는다 — signal 이 붙은 fetch 는 Next 가 캐시하지 않아
    // 페이지를 열 때마다 남의 서버를 두드리게 된다. 대신 기다리는 쪽에 제한을 둔다:
    // 3초 안에 안 오면 숫자를 포기하고, 응답은 그대로 캐시에 담긴다(다음 사람이 받는다).
    const req = fetch(
      `https://jnj-dash-db.vercel.app/api/contests/${encodeURIComponent(contestId)}/meta`,
      { next: { revalidate: 60 } },
    ).catch(() => null);
    const res = await Promise.race([
      req,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);
    if (!res || !res.ok) return null;
    const json = (await res.json()) as MetaResponse;
    const s = json.data?.participantStats;
    if (!s) return null;
    const n = Number(s.leaders ?? 0) + Number(s.followers ?? 0);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** 신청 인원 — 값이 없으면 아무것도 그리지 않는다(버튼만 남는다). */
export async function JnjSignupCount({ url, dict }: { url: string; dict: Dictionary }) {
  const contestId = dashContestId(url);
  if (!contestId) return null;
  const count = await fetchEntryCount(contestId);
  if (count === null) return null;
  return <JnjCountBoard count={count} label={dict.jnj.signupCount} />;
}
