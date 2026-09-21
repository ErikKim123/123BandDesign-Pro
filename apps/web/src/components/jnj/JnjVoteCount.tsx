// Design Ref: J&J 관객 심사위원 섹션의 '지금 몇 명' — 참가 신청 인원과 같은 숫자판을 쓴다.
//
// 참가 인원과 달리 이 값은 JNJ Dash 공개 메타 API 에 없다(그쪽은 참가자 통계만 내려준다).
// 대신 신청이 쌓이는 online_judges 테이블이 우리와 같은 Supabase 프로젝트에 있어 직접 센다.
// 남의 앱 테이블을 읽는 셈이라 이 파일 하나에 가둬 둔다 — Dash 가 나중에 심사위원 수를
// 메타에 실어주면 이 파일만 그쪽으로 갈아끼우면 된다.
//
// RLS 로 익명 키에는 행이 안 보여(빈 배열) service_role 로 센다. 서버 컴포넌트 전용이다.
// 실패해도 화면이 깨지지 않는다 — 못 가져오면 숫자 자리가 빠지고 버튼만 남는다.
// 참가 인원과 같은 이유로 60초 캐시.
import type { Dictionary } from '@/i18n/dictionaries';
import { JnjCountBoard } from './JnjCountBoard';
import { dashContestId } from './JnjSignupCount';

/**
 * 접수된 관객 심사위원 수. 개수만 필요하므로 행은 한 줄만 받고(limit=1) 총계는
 * count=exact 가 실어 보내는 Content-Range(`0-0/12`)의 뒷자리에서 읽는다.
 * 어떤 이유로든 못 가져오면 null — 0 으로 내려 '아무도 신청 안 했다'고 말하지 않는다.
 */
async function fetchJudgeCount(contestId: string): Promise<number | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    // 참가 인원과 같은 이유로 AbortSignal 을 쓰지 않는다(캐시가 꺼진다). 기다리는 쪽에 제한을 둔다.
    const req = fetch(
      `${url}/rest/v1/online_judges?select=id&contest_id=eq.${encodeURIComponent(contestId)}&limit=1`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Prefer: 'count=exact',
        },
        next: { revalidate: 60 },
      },
    ).catch(() => null);
    const res = await Promise.race([
      req,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);
    if (!res || !res.ok) return null;
    const total = Number(res.headers.get('content-range')?.split('/')[1]);
    return Number.isFinite(total) && total > 0 ? total : null;
  } catch {
    return null;
  }
}

/** 관객 심사위원 신청 인원 — 값이 없으면 아무것도 그리지 않는다(버튼만 남는다). */
export async function JnjVoteCount({ url, dict }: { url: string; dict: Dictionary }) {
  const contestId = dashContestId(url);
  if (!contestId) return null;
  const count = await fetchJudgeCount(contestId);
  if (count === null) return null;
  return <JnjCountBoard count={count} label={dict.jnj.voteCount} />;
}
