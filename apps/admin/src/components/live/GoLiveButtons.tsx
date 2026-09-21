// 방송 상태 전환 — 현장에서 급하게 누르는 버튼이라 드롭다운에 묻지 않고 크게 내놓는다.
//
//   scheduled ──[방송 시작]──> live ──[방송 종료]──> ended ──[다시보기 공개]──> archived
//
// '방송 시작'은 소스가 준비됐을 때만 눌린다(DB CHECK 로도 막히지만, 여기서 먼저 이유를 알려준다).
'use client';
import { PlayCircle, StopCircle, Video, Undo2 } from 'lucide-react';
import { tr } from '@/i18n/tr';
import type { LiveBroadcastRow, LiveStatus } from '@/lib/queries/live';

export function GoLiveButtons({
  row,
  saving,
  onChange,
}: {
  row: Pick<LiveBroadcastRow, 'status' | 'active_source' | 'yt_video_id' | 'backup_hls_url'>;
  saving?: boolean;
  onChange: (patch: { status: LiveStatus; started_at?: string | null }) => void;
}) {
  const sourceReady =
    row.active_source === 'youtube' ? !!row.yt_video_id : !!row.backup_hls_url?.trim();
  const isLive = row.status === 'live';

  return (
    <div className="rounded-sm border border-grey-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {!isLive && (
          <button
            type="button"
            disabled={!sourceReady || saving}
            onClick={() => onChange({ status: 'live', started_at: new Date().toISOString() })}
            className="btn btn-primary px-8 py-4 text-base"
          >
            <PlayCircle size={20} /> {tr('방송 시작')}
          </button>
        )}
        {isLive && (
          <button
            type="button"
            disabled={saving}
            onClick={() => onChange({ status: 'ended' })}
            className="btn px-8 py-4 text-base bg-danger text-white hover:bg-danger/90"
          >
            <StopCircle size={20} /> {tr('방송 종료')}
          </button>
        )}
        {row.status === 'ended' && (
          <button
            type="button"
            disabled={saving}
            onClick={() => onChange({ status: 'archived' })}
            className="btn btn-secondary btn-sm"
          >
            <Video size={15} /> {tr('다시보기 공개')}
          </button>
        )}
        {(row.status === 'ended' || row.status === 'archived') && (
          <button
            type="button"
            disabled={saving}
            onClick={() => onChange({ status: 'scheduled', started_at: null })}
            className="btn btn-secondary btn-sm"
          >
            <Undo2 size={15} /> {tr('예정 상태로 되돌리기')}
          </button>
        )}
      </div>

      {!sourceReady && !isLive && (
        <p className="mt-2 text-[11px] text-danger">
          {row.active_source === 'youtube'
            ? tr('유튜브 영상을 먼저 지정해야 방송을 시작할 수 있습니다.')
            : tr('백업 HLS 주소를 먼저 입력해야 방송을 시작할 수 있습니다.')}
        </p>
      )}
      {isLive && (
        <p className="mt-2 text-[11px] text-grey-500">
          {tr('방송 중입니다. 종료를 누르면 시청자 화면이 종료 안내로 바뀝니다.')}
        </p>
      )}
    </div>
  );
}
