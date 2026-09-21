// 카메라(앵글) 1~4 등록 — 방송 편집 폼 안에서 한 화면에 다 보인다.
//
// 스위칭의 전제는 '123Band 카메라 목록'과 'OBS 씬 이름'이 1:1로 묶여 있는 것이다.
// 씬 이름에 오타가 있으면 전환이 조용히 실패하므로:
//   · 브리지가 붙어 있으면 OBS 의 실제 씬 목록을 드롭다운으로 고르게 한다
//   · 브리지가 없으면 자유 입력 + 대소문자까지 일치해야 한다는 안내를 붙인다
'use client';
import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { cn } from '@/lib/utils';
import { parsePreview } from '@/lib/live/preview';
import {
  useDeleteCamera,
  useLiveCameras,
  useSaveCamera,
  type LiveCameraRow,
} from '@/lib/queries/live';

const SLOTS = [1, 2, 3, 4] as const;

/** 슬롯별 기본 이름 — 비워 두면 이 이름이 자리를 잡는다(현장에서 가장 흔한 4앵글). */
const SLOT_HINT: Record<number, string> = {
  1: '메인무대',
  2: '플로어',
  3: '심사석',
  4: '와이드',
};

type Draft = {
  label: string;
  obs_scene_name: string;
  operator_name: string;
  device_note: string;
  preview_url: string;
  is_enabled: boolean;
};

const EMPTY: Draft = {
  label: '',
  obs_scene_name: '',
  operator_name: '',
  device_note: '',
  preview_url: '',
  is_enabled: true,
};

function toDraft(row: LiveCameraRow | undefined): Draft {
  if (!row) return { ...EMPTY };
  return {
    label: row.label ?? '',
    obs_scene_name: row.obs_scene_name ?? '',
    operator_name: row.operator_name ?? '',
    device_note: row.device_note ?? '',
    preview_url: row.preview_url ?? '',
    is_enabled: row.is_enabled,
  };
}

export function CameraRows({
  broadcastId,
  obsScenes,
}: {
  /** 저장 전(신규)이면 null — 그때는 안내만 띄운다. */
  broadcastId: string | null;
  /** 브리지가 올린 OBS 씬 목록. 없으면 자유 입력. */
  obsScenes: string[] | null;
}) {
  const { data: cameras = [], isLoading } = useLiveCameras(broadcastId);
  const save = useSaveCamera();
  const del = useDeleteCamera();
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [savedSlot, setSavedSlot] = useState<number | null>(null);

  // 서버 값이 오면 초안을 맞춘다(편집 중 덮어쓰지 않도록 목록이 바뀔 때만).
  useEffect(() => {
    const next: Record<number, Draft> = {};
    for (const slot of SLOTS) next[slot] = toDraft(cameras.find((c) => c.slot === slot));
    setDrafts(next);
  }, [cameras]);

  if (!broadcastId) {
    return (
      <div className="rounded-sm border border-grey-200 bg-grey-50 p-4 text-sm text-grey-600">
        {tr('방송을 먼저 저장하면 카메라 4대를 등록할 수 있습니다.')}
      </div>
    );
  }

  const scenes = (obsScenes ?? []).filter((s) => typeof s === 'string' && s.trim());

  function set(slot: number, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [slot]: { ...(prev[slot] ?? EMPTY), ...patch } }));
  }

  // 방금 바뀐 값을 인자로 받는다.
  // 체크박스·드롭다운처럼 '바꾸자마자 저장'하는 입력은 setDrafts 가 반영되기 전에 저장이 돌아서,
  // 이 함수가 클로저에 갇힌 옛 draft 를 읽고 바뀌기 전 값을 그대로 저장해 버렸다.
  async function commit(slot: number, override?: Partial<Draft>) {
    const base = drafts[slot];
    if (!base || !broadcastId) return;
    const d = { ...base, ...(override ?? {}) };
    const existing = cameras.find((c) => c.slot === slot);
    // 아무것도 안 채운 빈 줄은 저장하지 않는다(빈 카메라가 스위처에 뜨는 걸 막는다).
    if (!existing && !d.label.trim() && !d.obs_scene_name.trim()) return;
    await save.mutateAsync({
      ...(existing ? { id: existing.id } : {}),
      broadcast_id: broadcastId,
      slot,
      label: d.label.trim(),
      obs_scene_name: d.obs_scene_name.trim(),
      operator_name: d.operator_name.trim() || null,
      device_note: d.device_note.trim() || null,
      preview_url: d.preview_url.trim() || null,
      is_enabled: d.is_enabled,
    });
    setSavedSlot(slot);
    setTimeout(() => setSavedSlot((s) => (s === slot ? null : s)), 1600);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="label-caps">{tr('카메라 (앵글)')}</span>
        <p className="text-[11px] text-grey-500">
          {scenes.length > 0
            ? tr('브리지가 연결돼 OBS 씬 목록에서 고를 수 있습니다.')
            : tr('OBS 씬 이름은 대소문자·공백까지 정확히 같아야 전환됩니다.')}
        </p>
      </div>
      <div className="rounded-sm border border-grey-200 bg-grey-50 px-3 py-2 text-[11px] leading-relaxed text-grey-600">
        {tr(
          '프리뷰 주소는 스위처 안에서 그 앵글을 눈으로 보기 위한 주소입니다. 송출 경로(폰→OBS SRT)와는 별개이고, 앵글마다 웹에서 열리는 주소가 하나씩 있어야 합니다 — 앵글별 유튜브 라이브 주소, HLS(.m3u8), 카메라 스냅샷 주소 중 아무거나 됩니다. 비워 두면 그 칸만 비고 전환은 그대로 동작합니다.',
        )}
      </div>

      {isLoading && <p className="text-sm text-grey-500">{tr('불러오는 중…')}</p>}

      {SLOTS.map((slot) => {
        const d = drafts[slot] ?? EMPTY;
        const existing = cameras.find((c) => c.slot === slot);
        const sceneMissing =
          scenes.length > 0 && d.obs_scene_name.trim() && !scenes.includes(d.obs_scene_name.trim());
        const preview = parsePreview(d.preview_url);
        return (
          <div
            key={slot}
            className={cn(
              'rounded-sm border p-3',
              existing ? 'border-grey-200 bg-white' : 'border-dashed border-grey-300 bg-grey-50',
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-black text-xs font-medium text-white">
                {slot}
              </span>
              <input
                className="input h-9 flex-1 py-1 text-sm"
                value={d.label}
                placeholder={tr(SLOT_HINT[slot])}
                onChange={(e) => set(slot, { label: e.target.value })}
                onBlur={() => commit(slot)}
              />
              {scenes.length > 0 ? (
                <select
                  className="input h-9 w-56 py-1 text-sm"
                  value={d.obs_scene_name}
                  onChange={(e) => {
                    const obs_scene_name = e.target.value;
                    set(slot, { obs_scene_name });
                    // 드롭다운은 고른 즉시 저장한다(blur 를 기다리지 않는다)
                    void commit(slot, { obs_scene_name });
                  }}
                >
                  <option value="">{tr('OBS 씬 선택')}</option>
                  {scenes.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className={cn('input h-9 w-56 py-1 text-sm', sceneMissing && 'input-error')}
                  value={d.obs_scene_name}
                  placeholder={tr('OBS 씬 이름')}
                  onChange={(e) => set(slot, { obs_scene_name: e.target.value })}
                  onBlur={() => commit(slot)}
                />
              )}
              <label className="flex items-center gap-1.5 text-xs text-grey-600">
                <input
                  type="checkbox"
                  checked={d.is_enabled}
                  onChange={(e) => {
                    const is_enabled = e.target.checked;
                    set(slot, { is_enabled });
                    void commit(slot, { is_enabled });
                  }}
                />
                {tr('스위처에서 선택 가능')}
              </label>
              {existing && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm text-danger"
                  aria-label={tr('카메라 삭제')}
                  onClick={() => del.mutate(existing.id)}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 pl-9">
              <input
                className="input h-8 w-40 py-1 text-xs"
                value={d.operator_name}
                placeholder={tr('촬영 담당자')}
                onChange={(e) => set(slot, { operator_name: e.target.value })}
                onBlur={() => commit(slot)}
              />
              <input
                className="input h-8 flex-1 py-1 text-xs"
                value={d.device_note}
                placeholder={tr('기종·회선 메모 (현장 트러블슈팅용)')}
                onChange={(e) => set(slot, { device_note: e.target.value })}
                onBlur={() => commit(slot)}
              />
              {savedSlot === slot && (
                <span className="text-[11px] text-success">{tr('저장했습니다')}</span>
              )}
              {sceneMissing && (
                <span className="text-[11px] text-danger">
                  {tr('OBS 에 없는 씬 이름입니다')}
                </span>
              )}
            </div>

            {/* 프리뷰 주소 — 스위처 안에서 이 앵글을 눈으로 보기 위한 주소.
                송출(폰→OBS SRT)과는 완전히 별개다. 비워 두면 프리뷰만 안 나오고 전환은 그대로 된다. */}
            <div className="mt-2 flex flex-wrap items-center gap-2 pl-9">
              <input
                className="input h-8 flex-1 py-1 text-xs"
                value={d.preview_url}
                placeholder={tr('프리뷰 주소 (유튜브 라이브 / .m3u8 / 스냅샷) — 비우면 프리뷰 없음')}
                onChange={(e) => set(slot, { preview_url: e.target.value })}
                onBlur={() => commit(slot)}
              />
              {preview ? (
                <span
                  className={cn(
                    'shrink-0 text-[11px]',
                    preview.kind === 'unknown' ? 'text-live' : 'text-grey-500',
                  )}
                >
                  {preview.kind === 'unknown'
                    ? tr('형식을 못 알아봤습니다 — 그대로 넣어 봅니다')
                    : `${tr(preview.label)} ${tr('로 인식')}`}
                </span>
              ) : (
                <span className="shrink-0 text-[11px] text-grey-400">{tr('프리뷰 없음')}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
