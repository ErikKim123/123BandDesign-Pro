// 인스타그램 — 캘린더에서 게시물을 만들고 예약한다.
// 연결 상태는 서버에서 미리 읽어 넘긴다(토큰 본문은 넘기지 않는다).
import { readIgSetting } from '@/lib/instagram/token';
import { InstagramCalendarView } from './InstagramCalendarView';

// 저장된 설정을 매번 새로 읽는다(설정 페이지에서 방금 연결했을 수 있다).
export const dynamic = 'force-dynamic';

export default async function InstagramPage() {
  let handle = '';
  let connected = false;
  try {
    const s = await readIgSetting();
    handle = s.handle;
    connected = Boolean(s.handle && s.token);
  } catch {
    // 설정을 못 읽어도 캘린더 자체는 열리게 둔다(배너로 미연결 안내).
  }

  return <InstagramCalendarView connected={connected} handle={handle} />;
}
