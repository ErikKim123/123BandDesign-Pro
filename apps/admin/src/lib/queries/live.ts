// Design Ref: 라이브 방송 — 어드민 데이터 훅. anon 클라이언트 + RLS(is_admin) 로 쓴다.
// 서버 액션은 이 레포에서 쓰지 않는다(§ resource.ts 와 같은 react-query 패턴).
'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { I18n } from '@123band/shared';

export type LiveStatus = 'scheduled' | 'live' | 'ended' | 'archived';
export type LiveSource = 'youtube' | 'backup';
export type SwitchMode = 'a' | 'b';
export type BridgeStatus = 'offline' | 'connected' | 'error';
export type CameraHealth = 'unknown' | 'ok' | 'warning' | 'down';

export interface LiveBroadcastRow {
  id: string;
  event_product_id: string | null;
  /** 연결 J&J 대회(0071) — 방송 중이면 /jnj 그 대회 화면에 라이브 버튼이 뜬다. */
  jnj_edition_id: string | null;
  jnj_division_id: string | null;
  slug: string;
  title_i18n: I18n;
  yt_video_id: string | null;
  backup_hls_url: string | null;
  active_source: LiveSource;
  status: LiveStatus;
  scheduled_at: string | null;
  show_chat: boolean;
  notice_i18n: I18n;
  /** 진행 대시보드(0083) — 라이브 섹션 영상 아래에 끼워 넣을 별도 앱 화면. https 만. */
  dashboard_url: string | null;
  show_dashboard: boolean;
  dashboard_label_i18n: I18n;
  /** 대시보드 자동 새로고침 주기(초). 0 이면 끔, 켜면 10~3600. */
  dashboard_refresh_sec: number;
  program_camera_id: string | null;
  previous_camera_id: string | null;
  current_segment: string | null;
  switch_mode: SwitchMode;
  bridge_status: BridgeStatus;
  bridge_heartbeat_at: string | null;
  bridge_error: string | null;
  obs_scenes: string[] | null;
  started_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LiveCameraRow {
  id: string;
  broadcast_id: string;
  slot: number;
  label: string;
  obs_scene_name: string;
  operator_name: string | null;
  device_note: string | null;
  /** 스위처 프리뷰 재생 주소 — 유튜브 라이브/HLS/MJPEG/mp4. 송출 경로(SRT→OBS)와는 별개다. */
  preview_url: string | null;
  is_enabled: boolean;
  health: CameraHealth;
  health_updated_at: string | null;
}

export interface SwitchLogRow {
  id: string;
  broadcast_id: string;
  camera_id: string | null;
  camera_slot: number | null;
  camera_label: string | null;
  segment: string | null;
  switched_at: string;
  switched_by: string | null;
  mode: SwitchMode;
  result: 'ok' | 'failed';
  error: string | null;
}

export const LIVE_QKEY = 'live_broadcasts';
const BROADCAST_COLS =
  'id, event_product_id, jnj_edition_id, jnj_division_id, slug, title_i18n, yt_video_id, backup_hls_url, active_source, status, scheduled_at, show_chat, notice_i18n, program_camera_id, previous_camera_id, current_segment, switch_mode, bridge_status, bridge_heartbeat_at, bridge_error, obs_scenes, started_at, created_at, updated_at';
const CAMERA_COLS =
  'id, broadcast_id, slot, label, obs_scene_name, operator_name, device_note, preview_url, is_enabled, health, health_updated_at';

/** 방송 1건. 스위처가 realtime 으로 갱신할 때도 이 캐시를 쓴다. */
export function useLiveBroadcast(id: string | null) {
  return useQuery({
    queryKey: [LIVE_QKEY, 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('live_broadcasts')
        .select(BROADCAST_COLS)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as unknown as LiveBroadcastRow;
    },
  });
}

/** 방송 저장(신규/수정). 신규면 id 없이 넘긴다. */
export function useSaveLiveBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Partial<LiveBroadcastRow>) => {
      const { data, error } = await createClient()
        .from('live_broadcasts')
        .upsert(values as never)
        .select(BROADCAST_COLS)
        .single();
      if (error) throw error;
      return data as unknown as LiveBroadcastRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [LIVE_QKEY] }),
  });
}

/**
 * 지정한 필드만 갱신 — 상태 전환 버튼처럼 '한 가지'만 바꿔야 하는 조작에 쓴다.
 * 폼 전체를 upsert 하면 화면에 떠 있던 오래된 값이 다른 사람의 최신 수정을 덮어쓴다.
 */
export function usePatchLiveBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<LiveBroadcastRow> }) => {
      const { data, error } = await createClient()
        .from('live_broadcasts')
        .update(values as never)
        .eq('id', id)
        .select(BROADCAST_COLS)
        .single();
      if (error) throw error;
      return data as unknown as LiveBroadcastRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [LIVE_QKEY] }),
  });
}

/** 같은 행사에 이미 방송 중인 다른 방송이 있는지 — 있으면 경고만 띄운다(막지는 않는다). */
export function useOtherLiveInEvent(eventProductId: string | null, selfId: string | null) {
  return useQuery({
    queryKey: [LIVE_QKEY, 'other-live', eventProductId, selfId],
    enabled: !!eventProductId,
    queryFn: async () => {
      let q = createClient()
        .from('live_broadcasts')
        .select('id, slug')
        .eq('event_product_id', eventProductId)
        .eq('status', 'live');
      if (selfId) q = q.neq('id', selfId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as { id: string; slug: string }[];
    },
  });
}

/** 카메라 4대. 없는 슬롯은 화면에서 빈 줄로 채운다. */
export function useLiveCameras(broadcastId: string | null) {
  return useQuery({
    queryKey: [LIVE_QKEY, 'cameras', broadcastId],
    enabled: !!broadcastId,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('live_cameras')
        .select(CAMERA_COLS)
        .eq('broadcast_id', broadcastId)
        .order('slot', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as LiveCameraRow[];
    },
  });
}

/** 카메라 1대 저장 — (broadcast_id, slot) 유니크라 슬롯 기준 upsert 로 덮어쓴다. */
export function useSaveCamera() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Partial<LiveCameraRow> & { broadcast_id: string; slot: number }) => {
      const { data, error } = await createClient()
        .from('live_cameras')
        .upsert(values as never, { onConflict: 'broadcast_id,slot' })
        .select(CAMERA_COLS)
        .single();
      if (error) throw error;
      return data as unknown as LiveCameraRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [LIVE_QKEY, 'cameras'] }),
  });
}

export function useDeleteCamera() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient().from('live_cameras').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [LIVE_QKEY, 'cameras'] }),
  });
}

/** 탈리 화면 주소에 쓰는 토큰. 관리자만 읽을 수 있다(RLS). */
export function useTallyToken(broadcastId: string | null) {
  return useQuery({
    queryKey: [LIVE_QKEY, 'tally-token', broadcastId],
    enabled: !!broadcastId,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('live_tally_tokens')
        .select('token')
        .eq('broadcast_id', broadcastId)
        .maybeSingle();
      if (error) throw error;
      return (data as { token: string } | null)?.token ?? null;
    },
  });
}

/** 전환 로그 — 스위처 하단에 최근 N건. CSV 내보내기도 이 훅을 재사용한다. */
export function useSwitchLog(broadcastId: string | null, limit = 10) {
  return useQuery({
    queryKey: [LIVE_QKEY, 'switch-log', broadcastId, limit],
    enabled: !!broadcastId,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('live_switch_log')
        .select('*')
        .eq('broadcast_id', broadcastId)
        .order('switched_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as SwitchLogRow[];
    },
  });
}

/** CSV 내보내기용 — 전체 로그(오래된 순). 방송이 끝난 뒤 한 번 부른다. */
export async function fetchAllSwitchLog(broadcastId: string): Promise<SwitchLogRow[]> {
  const { data, error } = await createClient()
    .from('live_switch_log')
    .select('*')
    .eq('broadcast_id', broadcastId)
    .order('switched_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as SwitchLogRow[];
}

/**
 * 방송 복제 — 다음 대회 방송을 만들 때 '카메라 세팅'을 그대로 가져오는 것이 목적이다.
 *
 * 그대로 베끼면 안 되는 것들은 초기화한다:
 *   · 상태는 항상 '예정' — 복사하자마자 방송 중인 방송이 하나 더 생기면 안 된다
 *   · 유튜브 영상 ID 는 비운다 — 옛 영상이 새 방송에 붙는 것이 이 기능의 가장 큰 사고다
 *   · 슬러그는 뒤에 -copy(-2, -3 …)를 붙여 유니크를 지킨다
 *   · 진행 상황(현재 앵글·시작 시각·브리지 상태·전환 로그)은 새 방송의 것이 아니다
 * 카메라 4대는 이름·OBS 씬·담당자까지 그대로 복사한다(health 는 미확인으로).
 */
export function useDuplicateBroadcasts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]): Promise<{ copied: number; failed: number }> => {
      const supabase = createClient();
      let copied = 0;
      let failed = 0;

      for (const id of ids) {
        const { data: src, error } = await supabase
          .from('live_broadcasts')
          .select(BROADCAST_COLS)
          .eq('id', id)
          .single();
        if (error || !src) {
          failed++;
          continue;
        }
        const row = src as unknown as LiveBroadcastRow;

        // 슬러그 충돌 회피 — 이미 -copy 가 있으면 -copy-2, -copy-3 …
        const { data: taken } = await supabase
          .from('live_broadcasts')
          .select('slug')
          .like('slug', `${row.slug}-copy%`);
        const used = new Set(((taken ?? []) as { slug: string }[]).map((r) => r.slug));
        let slug = `${row.slug}-copy`;
        for (let n = 2; used.has(slug); n++) slug = `${row.slug}-copy-${n}`;

        const { data: inserted, error: insErr } = await supabase
          .from('live_broadcasts')
          .insert({
            event_product_id: row.event_product_id,
            jnj_edition_id: row.jnj_edition_id,
            jnj_division_id: row.jnj_division_id,
            slug,
            title_i18n: withCopySuffix(row.title_i18n),
            yt_video_id: null,
            backup_hls_url: row.backup_hls_url,
            active_source: row.active_source,
            status: 'scheduled',
            show_chat: row.show_chat,
            notice_i18n: {},
            switch_mode: row.switch_mode,
          } as never)
          .select('id')
          .single();
        if (insErr || !inserted) {
          failed++;
          continue;
        }
        const newId = (inserted as { id: string }).id;

        // 카메라 세팅 복사 — 이 기능의 본체.
        const { data: cams } = await supabase
          .from('live_cameras')
          .select(CAMERA_COLS)
          .eq('broadcast_id', id)
          .order('slot', { ascending: true });
        const rows = ((cams ?? []) as unknown as LiveCameraRow[]).map((c) => ({
          broadcast_id: newId,
          slot: c.slot,
          label: c.label,
          obs_scene_name: c.obs_scene_name,
          operator_name: c.operator_name,
          device_note: c.device_note,
          is_enabled: c.is_enabled,
          health: 'unknown',
        }));
        if (rows.length) await supabase.from('live_cameras').insert(rows as never);
        copied++;
      }
      return { copied, failed };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [LIVE_QKEY] }),
  });
}

/** 제목 뒤에 '복사'를 붙인다(언어별로). 비어 있는 언어는 건드리지 않는다. */
function withCopySuffix(title: I18n): I18n {
  const out: Record<string, string> = { ...(title as Record<string, string>) };
  if (out.ko?.trim()) out.ko = `${out.ko} 복사`;
  if (out.en?.trim()) out.en = `${out.en} (copy)`;
  return out as I18n;
}
