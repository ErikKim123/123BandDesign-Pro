// 앵글 전환 한 번에 일어나는 일 — 스위처와 단축키가 공유하는 단일 진입점.
//
//   1) live_broadcasts.program_camera_id 를 바꾸고, 직전 값을 previous_camera_id 로 민다(Space 토글용)
//   2) live_switch_log 에 기록을 남긴다 (VOD 챕터링·클립 추출의 기준 데이터)
//
// 모드 A(지시)든 모드 B(브리지)든 여기까지는 완전히 같다. 다른 점은 그 뒤:
//   A = 탈리 화면이 이 값을 읽어 오퍼레이터에게 보여준다
//   B = 현장 브리지가 이 값을 읽어 OBS 씬을 직접 바꾼다
// 그래서 브리지가 없어도 스위처는 그 자체로 완결된다.
'use client';
import { createClient } from '@/lib/supabase/client';
import type { LiveBroadcastRow, LiveCameraRow } from '@/lib/queries/live';

export async function switchCamera(opts: {
  broadcast: Pick<
    LiveBroadcastRow,
    'id' | 'program_camera_id' | 'current_segment' | 'switch_mode'
  >;
  camera: Pick<LiveCameraRow, 'id' | 'slot' | 'label'>;
  userId: string | null;
}): Promise<void> {
  const { broadcast, camera, userId } = opts;
  const supabase = createClient();

  const { error } = await supabase
    .from('live_broadcasts')
    .update({
      program_camera_id: camera.id,
      previous_camera_id: broadcast.program_camera_id,
    })
    .eq('id', broadcast.id);
  if (error) throw error;

  // 로그 실패가 전환을 되돌리지는 않는다 — 화면은 이미 바뀌었고, 기록은 부가 정보다.
  await supabase.from('live_switch_log').insert({
    broadcast_id: broadcast.id,
    camera_id: camera.id,
    camera_slot: camera.slot,
    camera_label: camera.label,
    segment: broadcast.current_segment,
    switched_by: userId,
    mode: broadcast.switch_mode,
    // 명령을 낸 시점의 결과다. 모드 B 에서 OBS 가 거부하면 브리지가 이 행을 failed 로 정정한다.
    result: 'ok',
  });
}

// 표시·내보내기 헬퍼는 format.ts 에 있다. 호출부가 한 곳에서 가져다 쓰도록 여기서 다시 내보낸다.
export { hhmmss, nextSegment, switchLogCsv } from './format';
