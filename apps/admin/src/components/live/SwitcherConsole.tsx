// 영상감독 스위처 콘솔 — 현장에서 8시간 동안 켜 두는 화면.
//
// 이 화면은 영상을 보여주지 않는다. 폰 4대는 로컬망으로 OBS 에만 보내므로 123Band 서버에
// 영상이 도달하지 않는다(멀티뷰는 OBS 화면으로 본다). 여기는 '어느 앵글을 내보낼지' 고르는 조작 패널이다.
//
// 레이아웃 원칙: 한 화면에 다 들어온다(페이지 스크롤 없음). 로그만 자기 영역에서 스크롤한다.
// 조작 원칙: 클릭 = 즉시 실행. 확인 대화상자를 넣지 않는다. 방송 중에는 한 번의 클릭이 곧 실행이다.
'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  Keyboard,
  Megaphone,
  Radio,
  RefreshCw,
  Users,
  X,
} from 'lucide-react';
import { pickI18n, type I18n } from '@123band/shared';
import { tr } from '@/i18n/tr';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import {
  fetchAllSwitchLog,
  useLiveBroadcast,
  useLiveCameras,
  useSwitchLog,
  type CameraHealth,
  type LiveBroadcastRow,
  type LiveCameraRow,
} from '@/lib/queries/live';
import { hhmmss, nextSegment, switchCamera, switchLogCsv } from '@/lib/live/switch';
import { CameraPreview } from './CameraPreview';
import {
  useBroadcastSync,
  useLeaveGuard,
  useSwitcherHotkeys,
  useSwitcherPresence,
  useTick,
  useWakeLock,
} from '@/lib/live/useConsole';

/** 같은 앵글이 이만큼 이어지면 은은하게 알린다(강제하지 않는다 — 판단은 감독이 한다). */
const STALE_SECONDS = 90;

/** 공지 원클릭 문구 — 한/영 쌍으로 넣는다(시청자 화면은 로케일에 맞는 쪽을 고른다). */
const NOTICE_PRESETS: { ko: string; en: string }[] = [
  { ko: '잠시 후 재개합니다', en: "We'll resume shortly" },
  { ko: '결승 시작', en: 'Finals starting now' },
  { ko: '기술적 문제로 잠시 중단', en: 'Paused for a technical issue' },
];

const HEALTH_LABEL: Record<CameraHealth, string> = {
  unknown: '미확인',
  ok: '정상',
  warning: '주의',
  down: '끊김',
};

export function SwitcherConsole({
  broadcastId,
  userId,
  userEmail,
}: {
  broadcastId: string;
  userId: string | null;
  userEmail: string;
}) {
  const { data: broadcast, isLoading } = useLiveBroadcast(broadcastId);
  const { data: cameras = [] } = useLiveCameras(broadcastId);
  const { data: log = [] } = useSwitchLog(broadcastId, 10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [segmentDraft, setSegmentDraft] = useState('');
  const [noticeDraft, setNoticeDraft] = useState('');

  const isLive = broadcast?.status === 'live';
  useBroadcastSync(broadcastId);
  useWakeLock(!!broadcast);
  useLeaveGuard(isLive);
  const others = useSwitcherPresence(broadcastId, userEmail);
  const now = useTick(true);

  useEffect(() => {
    if (broadcast) setSegmentDraft(broadcast.current_segment ?? '');
  }, [broadcast?.id, broadcast?.current_segment]);

  const program = cameras.find((c) => c.id === broadcast?.program_camera_id) ?? null;
  const previous = cameras.find((c) => c.id === broadcast?.previous_camera_id) ?? null;

  // 현재 앵글이 언제 걸렸는지 — 마지막 전환 기록이 기준. 없으면 방송 시작 시각.
  const programSince = useMemo(() => {
    const last = log[0];
    if (last && last.camera_id === program?.id) return new Date(last.switched_at).getTime();
    if (broadcast?.started_at) return new Date(broadcast.started_at).getTime();
    return null;
  }, [log, program?.id, broadcast?.started_at]);

  const holdSeconds = programSince ? Math.floor((now - programSince) / 1000) : null;
  const elapsed = broadcast?.started_at
    ? Math.floor((now - new Date(broadcast.started_at).getTime()) / 1000)
    : null;

  // 브리지 생존 — 하트비트가 90초 넘게 없으면 끊긴 것으로 본다(브리지는 1초마다 신호를 준다).
  const bridgeAlive =
    !!broadcast?.bridge_heartbeat_at &&
    now - new Date(broadcast.bridge_heartbeat_at).getTime() < 90_000;

  async function patch(values: Partial<LiveBroadcastRow>) {
    const { error: e } = await createClient()
      .from('live_broadcasts')
      .update(values)
      .eq('id', broadcastId);
    if (e) setError(e.message);
  }

  async function go(camera: LiveCameraRow | null | undefined) {
    if (!broadcast || !camera) return;
    if (!camera.is_enabled || camera.health === 'down') return;
    if (camera.id === broadcast.program_camera_id) return;
    setBusy(true);
    setError(null);
    try {
      await switchCamera({ broadcast, camera, userId });
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('전환에 실패했습니다.'));
    } finally {
      setBusy(false);
    }
  }

  useSwitcherHotkeys({
    enabled: !!broadcast && !helpOpen,
    onSlot: (slot) => void go(cameras.find((c) => c.slot === slot)),
    onToggle: () => void go(previous),
    onHelp: () => setHelpOpen(true),
  });

  async function exportCsv() {
    const rows = await fetchAllSwitchLog(broadcastId);
    const csv = switchLogCsv(rows, broadcast?.started_at ?? null);
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `switch-log-${broadcast?.slug ?? broadcastId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading || !broadcast) {
    return (
      <div className="flex h-screen items-center justify-center text-grey-500">
        {tr('불러오는 중…')}
      </div>
    );
  }

  const title = pickI18n(broadcast.title_i18n as I18n, 'ko') || broadcast.slug;
  const programDown = program && (program.health === 'down' || !program.is_enabled);
  // 프리뷰 주소가 하나도 없으면 '어디에 넣는지'를 알려 준다 — 빈 회색 칸만 보고 원인을 짐작하게 두지 않는다.
  const previewCount = cameras.filter((c) => c.preview_url?.trim()).length;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      {/* ── 상태 바 ─────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-grey-200 px-4 py-2.5">
        <Link href="/live" className="btn btn-secondary btn-sm shrink-0">
          <ArrowLeft size={14} /> {tr('목록')}
        </Link>

        <span className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex h-2.5 w-2.5 rounded-pill',
              isLive ? 'bg-live live-pulse' : 'bg-grey-300',
            )}
            aria-hidden
          />
          <span className="font-display text-lg uppercase tracking-tight">
            {isLive ? tr('방송중') : tr(broadcast.status === 'scheduled' ? '예정' : '종료')}
          </span>
          {elapsed != null && isLive && (
            <span className="font-mono text-lg tabular-nums">{hhmmss(elapsed)}</span>
          )}
        </span>

        <span className="text-sm text-grey-600">{title}</span>

        <span className="flex items-center gap-1.5 text-sm">
          <Radio size={14} className={bridgeAlive ? 'text-success' : 'text-grey-400'} />
          {broadcast.switch_mode === 'b'
            ? bridgeAlive
              ? tr('브리지: 연결됨')
              : tr('브리지: 끊김')
            : tr('모드 A (수동)')}
        </span>

        <select
          className="input h-8 w-auto py-0 text-xs"
          value={broadcast.switch_mode}
          onChange={(e) => patch({ switch_mode: e.target.value as 'a' | 'b' })}
        >
          <option value="a">{tr('모드 A — 탈리로 지시')}</option>
          <option value="b">{tr('모드 B — 브리지 자동 전환')}</option>
        </select>

        <span className="text-xs text-grey-500">
          {tr('유튜브')}: <span className="font-mono">{broadcast.yt_video_id ?? '—'}</span>
        </span>

        {others.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-live">
            <Users size={13} /> {tr('다른 사용자가 조작 중')}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setHelpOpen(true)}>
            <Keyboard size={14} /> ?
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={exportCsv}>
            <Download size={14} /> CSV
          </button>
        </div>
      </header>

      {(error || broadcast.bridge_error || programDown) && (
        <div className="flex flex-wrap items-center gap-3 border-b border-grey-200 bg-danger/10 px-4 py-2 text-sm text-danger">
          <AlertTriangle size={16} />
          {programDown && (
            <span>{tr('지금 나가는 카메라가 끊김 상태입니다. 다른 앵글로 바꾸세요.')}</span>
          )}
          {broadcast.bridge_error && (
            <span>
              {tr('브리지 오류')}: {broadcast.bridge_error}
            </span>
          )}
          {error && <span>{error}</span>}
        </div>
      )}

      {/* ── 카메라 4개 ──────────────────────────────────────────
          카드마다 프리뷰가 깔린다. 단, 어드민에서 앵글별 '프리뷰 주소'를 넣은 경우에만 나온다 —
          폰→OBS 는 SRT 라서 브라우저가 재생하지 못하고 123Band 서버로 오지도 않기 때문에,
          웹에서 열리는 주소가 앵글마다 따로 있어야 한다. 주소가 없으면 그 칸만 회색으로 남는다.

          프리뷰는 판단을 돕는 보조 화면이지 송출 화면이 아니다. 지연·화질은 주소에 달렸고,
          프리뷰가 깨져도 전환·탈리·브리지는 아무 영향을 받지 않는다.
          카드 높이를 고정한다 — 화면 높이만큼 늘리면 이름이 바닥에 붙어 빈 상자처럼 보인다. */}
      <p className="px-4 pt-3 text-xs text-grey-500">
        {previewCount > 0
          ? tr('프리뷰는 참고용입니다 — 실제 송출 화면과 지연 차이가 있습니다. 정밀 확인은 OBS 멀티뷰로 하세요.')
          : tr('프리뷰 주소가 없습니다 — 어드민 › 방송 편집 › 카메라의 「프리뷰 주소」에 앵글별 주소를 넣으면 여기에 화면이 뜹니다.')}
      </p>
      <div className="grid shrink-0 grid-cols-2 gap-3 p-4 pt-2 md:grid-cols-4">
        {[1, 2, 3, 4].map((slot) => {
          const cam = cameras.find((c) => c.slot === slot);
          const onAir = !!cam && cam.id === broadcast.program_camera_id;
          const disabled = !cam || !cam.is_enabled || cam.health === 'down';
          const stale = onAir && holdSeconds != null && holdSeconds > STALE_SECONDS;
          // 프리뷰가 깔린 카드는 글자를 흰색으로 뒤집는다 — 영상 위 검은 글씨는 읽히지 않는다.
          const hasPreview = !!cam?.preview_url?.trim();
          return (
            <div key={slot} className="flex flex-col">
              {/* 프리뷰(아래) 위에 조작 버튼(위)을 덮는 구조.
                  버튼 안에 iframe/video 를 넣으면 클릭이 프리뷰에 먹혀 전환이 안 된다. */}
              <div
                className={cn(
                  'relative h-40 overflow-hidden rounded-lg border-2 transition-colors md:h-48',
                  onAir
                    ? 'border-live'
                    : disabled
                      ? 'border-grey-200 opacity-60'
                      : 'border-grey-300 hover:border-black',
                )}
              >
                <div className="absolute inset-0">
                  <CameraPreview url={cam?.preview_url ?? null} />
                </div>
                <button
                  type="button"
                  disabled={disabled || busy}
                  onClick={() => void go(cam)}
                  className={cn(
                    'absolute inset-0 flex flex-col items-start justify-between p-4 text-left transition-colors',
                    hasPreview
                      ? 'bg-gradient-to-b from-black/60 via-black/15 to-black/70 text-white'
                      : onAir
                        ? 'bg-live/10'
                        : disabled
                          ? 'bg-grey-50/80'
                          : 'bg-white/70 hover:bg-grey-100/80',
                    disabled && 'cursor-not-allowed',
                  )}
                >
                  <span className="flex w-full items-center justify-between">
                    <span className="font-display text-3xl leading-none">{slot}</span>
                    {onAir && (
                      <span className="rounded-pill bg-live px-2 py-0.5 text-[11px] font-medium uppercase tracking-tight text-white">
                        ON AIR
                      </span>
                    )}
                  </span>
                  <span className="mt-2 w-full">
                    <span className="block truncate text-base font-medium">
                      {cam?.label || tr('미등록')}
                    </span>
                    <span
                      className={cn(
                        'mt-0.5 block truncate text-xs',
                        hasPreview ? 'text-white/75' : 'text-grey-500',
                      )}
                    >
                      {cam?.obs_scene_name || tr('OBS 씬 미지정')}
                      {cam?.operator_name ? ` · ${cam.operator_name}` : ''}
                    </span>
                  </span>
                  <span className="mt-2 flex w-full items-center justify-between text-xs">
                    <span
                      className={cn(
                        'font-mono tabular-nums',
                        stale ? 'text-live' : hasPreview ? 'text-white/75' : 'text-grey-500',
                      )}
                    >
                      {onAir && holdSeconds != null ? hhmmss(holdSeconds) : ''}
                    </span>
                    {disabled && cam && (
                      <span className={hasPreview ? 'text-white' : 'text-danger'}>
                        {cam.health === 'down' ? tr('끊김') : tr('사용 안 함')}
                      </span>
                    )}
                    {stale && <span className="text-live">{tr('오래 유지 중')}</span>}
                  </span>
                </button>
              </div>

              {/* 모드 A 에서는 감독이 카메라 상태를 손으로 표시한다(브리지가 없으면 아무도 못 알려준다) */}
              {cam && (
                <div className="mt-1.5 flex items-center gap-1">
                  {(['ok', 'warning', 'down'] as CameraHealth[]).map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() =>
                        createClient()
                          .from('live_cameras')
                          .update({ health: h, health_updated_at: new Date().toISOString() })
                          .eq('id', cam.id)
                          .then(() => undefined)
                      }
                      className={cn(
                        'rounded-pill px-2 py-0.5 text-[11px] transition-colors',
                        cam.health === h
                          ? h === 'ok'
                            ? 'bg-success/10 text-success'
                            : h === 'warning'
                              ? 'bg-live/10 text-live'
                              : 'bg-danger/10 text-danger'
                          : 'bg-grey-100 text-grey-500 hover:bg-grey-200',
                      )}
                    >
                      {tr(HEALTH_LABEL[h])}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── 진행 순서 · 공지 ────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-grey-200 px-4 py-2.5">
        <span className="label-caps shrink-0">{tr('현재 순서')}</span>
        <input
          className="input h-9 w-48 py-1 text-sm"
          value={segmentDraft}
          placeholder={tr('예선 3조')}
          onChange={(e) => setSegmentDraft(e.target.value)}
          onBlur={() => patch({ current_segment: segmentDraft.trim() || null })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={!nextSegment(segmentDraft)}
          onClick={() => {
            const next = nextSegment(segmentDraft);
            if (!next) return;
            setSegmentDraft(next);
            patch({ current_segment: next });
          }}
        >
          <RefreshCw size={14} /> {tr('다음 순서')}
        </button>

        <span className="label-caps ml-2 shrink-0">{tr('공지')}</span>
        <input
          className="input h-9 flex-1 py-1 text-sm"
          value={noticeDraft}
          placeholder={tr('시청자 화면 상단에 뜹니다')}
          onChange={(e) => setNoticeDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              patch({ notice_i18n: { ko: noticeDraft, en: noticeDraft } as I18n });
            }
          }}
        />
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => patch({ notice_i18n: { ko: noticeDraft, en: noticeDraft } as I18n })}
        >
          <Megaphone size={14} /> {tr('시청자에게 전송')}
        </button>
        {NOTICE_PRESETS.map((p) => (
          <button
            key={p.ko}
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setNoticeDraft(p.ko);
              patch({ notice_i18n: p as unknown as I18n });
            }}
          >
            {tr(p.ko)}
          </button>
        ))}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            setNoticeDraft('');
            patch({ notice_i18n: {} as I18n });
          }}
        >
          {tr('공지 지우기')}
        </button>
      </div>

      {/* ── 전환 로그 ───────────────────────────────────────── */}
      <div className="min-h-24 flex-1 overflow-y-auto border-t border-grey-200 bg-grey-50 px-4 py-2">
        <span className="label-caps">{tr('전환 로그')}</span>
        <div className="mt-1 space-y-0.5 text-xs text-grey-600">
          {log.length === 0 && <span className="text-grey-400">{tr('아직 전환 기록이 없습니다.')}</span>}
          {log.map((r) => (
            <div key={r.id} className="font-mono tabular-nums">
              {new Date(r.switched_at).toLocaleTimeString()} →{' '}
              <span className={cn(r.result === 'failed' ? 'text-danger' : 'text-black')}>
                {r.camera_label || `#${r.camera_slot ?? '?'}`}
                {r.result === 'failed' ? ` (${tr('실패')})` : ''}
              </span>
              {r.segment ? <span className="text-grey-400"> · {r.segment}</span> : null}
            </div>
          ))}
        </div>
      </div>

      {/* ── 단축키 도움말 ───────────────────────────────────── */}
      {helpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={tr('단축키')}
          onClick={() => setHelpOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl uppercase tracking-tight">{tr('단축키')}</h2>
              <button type="button" onClick={() => setHelpOpen(false)} aria-label={tr('닫기')}>
                <X size={20} />
              </button>
            </div>
            <dl className="space-y-2 text-sm">
              {[
                ['1 2 3 4', tr('해당 번호 카메라로 전환')],
                ['Space', tr('직전 카메라로 되돌리기')],
                ['?', tr('이 도움말')],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center gap-3">
                  <kbd className="rounded-sm bg-grey-100 px-2 py-1 font-mono text-xs">{k}</kbd>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-grey-500">
              {tr('입력칸에 커서가 있을 때는 단축키가 동작하지 않습니다. 전환은 되돌릴 수 없습니다.')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
