// Design Ref: 라이브 방송관리 — 목록 설정. 편집은 전용 폼(LiveBroadcastForm)이 맡는다.
// (formFields 를 비워 둔 이유: 유튜브 미리보기·카메라 4대·상태 버튼이 제네릭 폼에 안 들어간다)
import type { ColumnDef } from '@tanstack/react-table';
import type { ResourceConfig } from '@/lib/resource/types';
import { StatusBadge } from '@/components/form/StatusBadge';
import type { I18n } from '@123band/shared';
import { trI18n, tr } from '@/i18n/tr';
import type { LiveBroadcastRow } from '@/lib/queries/live';

/** 상태 라벨 — StatusBadge 의 톤 규칙에 맞춰 방송중만 강조색(live)으로 뜬다. */
const STATUS_LABEL: Record<string, string> = {
  scheduled: '예정',
  live: '방송중',
  ended: '종료',
  archived: '다시보기',
};
const STATUS_TONE: Record<string, 'success' | 'warn' | 'danger' | 'default'> = {
  scheduled: 'default',
  live: 'warn', // warn 톤 = live 색(오렌지) — 백오피스 배지 규칙 그대로
  ended: 'default',
  archived: 'default',
};

export const LIVE_STATUS_OPTS = Object.entries(STATUS_LABEL).map(([value, label]) => ({
  value,
  label,
}));

const columns: ColumnDef<LiveBroadcastRow, unknown>[] = [
  {
    accessorKey: 'title_i18n',
    header: '방송 제목',
    cell: (c) => trI18n(c.getValue() as I18n) || '—',
  },
  { accessorKey: 'slug', header: 'URL 슬러그' },
  {
    accessorKey: 'status',
    header: '상태',
    cell: (c) => {
      const s = String(c.getValue());
      return StatusBadge({ status: tr(STATUS_LABEL[s] ?? s), tone: STATUS_TONE[s] ?? 'default' });
    },
  },
  {
    accessorKey: 'yt_video_id',
    header: '유튜브 ID',
    cell: (c) => String(c.getValue() ?? '—'),
  },
  {
    accessorKey: 'updated_at',
    header: '최근 수정',
    cell: (c) => {
      const v = c.getValue();
      return v ? new Date(String(v)).toLocaleString() : '—';
    },
  },
];

export const liveBroadcastsConfig: ResourceConfig<LiveBroadcastRow> = {
  key: 'live_broadcasts',
  table: 'live_broadcasts',
  title: '라이브 방송관리',
  canCreate: true,
  selectColumns:
    'id, event_product_id, jnj_edition_id, slug, title_i18n, yt_video_id, backup_hls_url, active_source, status, scheduled_at, show_chat, notice_i18n, dashboard_url, show_dashboard, dashboard_label_i18n, dashboard_refresh_sec, program_camera_id, previous_camera_id, current_segment, switch_mode, bridge_status, bridge_heartbeat_at, bridge_error, obs_scenes, started_at, created_at, updated_at',
  defaultSort: { column: 'updated_at', asc: false },
  listColumns: columns,
  filters: [
    { name: 'status', label: '상태', kind: 'select', options: LIVE_STATUS_OPTS },
    {
      name: 'q',
      label: '제목·슬러그 검색',
      kind: 'search',
      searchColumns: ['slug', 'title_i18n->>ko', 'title_i18n->>en'],
    },
  ],
  formFields: [],
};
