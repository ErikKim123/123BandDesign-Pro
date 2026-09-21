// 라이브 방송 등록/편집 폼 — 목록 드로어 안에서 연다.
// 제네릭 ResourceFormPage 대신 전용 폼을 쓰는 이유: 유튜브 미리보기·카메라 4대·상태 버튼처럼
// 이 화면에만 있는 조작이 많다(행사패스 마법사와 같은 선례).
'use client';
import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Copy, Check, AlertTriangle } from 'lucide-react';
import { slugify, type I18n } from '@123band/shared';
import { tr } from '@/i18n/tr';
import { useLocale } from '@/lib/locale/LocaleContext';
import { I18nField } from '@/components/form/I18nField';
import { DateTimePicker } from '@/components/form/DateTimePicker';
import {
  useEventProductOptions,
  useJnjDivisionOptions,
  useJnjEditionOptions,
} from '@/lib/queries/options';
import {
  useOtherLiveInEvent,
  usePatchLiveBroadcast,
  useSaveLiveBroadcast,
  useTallyToken,
  type LiveBroadcastRow,
  type LiveSource,
  type LiveStatus,
} from '@/lib/queries/live';
import { YoutubeField } from './YoutubeField';
import { CameraRows } from './CameraRows';
import { GoLiveButtons } from './GoLiveButtons';
import { cn } from '@/lib/utils';

// 고객 웹 주소 — 탈리/시청 링크 안내용(행사패스 미리보기와 같은 환경변수를 쓴다).
const WEB_BASE = process.env.NEXT_PUBLIC_WEB_URL ?? 'https://123band-web.vercel.app';

type Draft = {
  id?: string;
  event_product_id: string | null;
  jnj_edition_id: string | null;
  jnj_division_id: string | null;
  slug: string;
  title_i18n: I18n;
  yt_video_id: string | null;
  backup_hls_url: string;
  active_source: LiveSource;
  status: LiveStatus;
  scheduled_at: string | null;
  show_chat: boolean;
  notice_i18n: I18n;
  dashboard_url: string;
  show_dashboard: boolean;
  dashboard_label_i18n: I18n;
  dashboard_refresh_sec: number;
  obs_scenes: string[] | null;
};

function toDraft(row: Partial<LiveBroadcastRow> | null): Draft {
  return {
    id: row?.id,
    event_product_id: row?.event_product_id ?? null,
    jnj_edition_id: row?.jnj_edition_id ?? null,
    jnj_division_id: row?.jnj_division_id ?? null,
    slug: row?.slug ?? '',
    title_i18n: (row?.title_i18n as I18n) ?? {},
    yt_video_id: row?.yt_video_id ?? null,
    backup_hls_url: row?.backup_hls_url ?? '',
    active_source: row?.active_source ?? 'youtube',
    status: row?.status ?? 'scheduled',
    scheduled_at: row?.scheduled_at ?? null,
    show_chat: row?.show_chat ?? true,
    notice_i18n: (row?.notice_i18n as I18n) ?? {},
    dashboard_url: row?.dashboard_url ?? '',
    show_dashboard: row?.show_dashboard ?? false,
    dashboard_label_i18n: (row?.dashboard_label_i18n as I18n) ?? {},
    dashboard_refresh_sec: row?.dashboard_refresh_sec ?? 0,
    obs_scenes: (row?.obs_scenes as string[] | null) ?? null,
  };
}

/** timestamptz ↔ DateTimePicker 값('YYYY-MM-DDTHH:mm', 브라우저 로컬시각) */
function toPickerValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromPickerValue(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function LiveBroadcastForm({
  initial,
  onDone,
}: {
  initial: Partial<LiveBroadcastRow> | null;
  onDone: () => void;
}) {
  const { locale } = useLocale();
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [dashboardPreview, setDashboardPreview] = useState(false);
  const { data: eventOptions = [] } = useEventProductOptions();
  const { data: jnjOptions = [] } = useJnjEditionOptions();
  const { data: allDivisions = [] } = useJnjDivisionOptions();
  // 부문은 대회에 속한다 — 고른 대회의 부문만 보여준다. 대회를 안 골랐으면 고를 것이 없다.
  const divisionOptions = useMemo(
    () => allDivisions.filter((d) => d.editionId === draft.jnj_edition_id),
    [allDivisions, draft.jnj_edition_id],
  );
  const save = useSaveLiveBroadcast();
  const patch = usePatchLiveBroadcast();
  const { data: tallyToken } = useTallyToken(draft.id ?? null);
  const { data: otherLive = [] } = useOtherLiveInEvent(draft.event_product_id, draft.id ?? null);

  useEffect(() => {
    setDraft(toDraft(initial));
    setError(null);
  }, [initial]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  // slug 는 제목(EN 우선)에서 자동으로 만들고, 사람이 고치면 그 값을 존중한다.
  const suggestedSlug = useMemo(() => {
    const base = (draft.title_i18n.en || draft.title_i18n.ko || '').trim();
    return base ? slugify(base) : '';
  }, [draft.title_i18n]);

  const tallyUrl =
    tallyToken && draft.slug
      ? `${WEB_BASE}/${locale}/live/${draft.slug}/tally-board?t=${tallyToken}`
      : null;
  const watchUrl = draft.slug ? `${WEB_BASE}/${locale}/live/${draft.slug}` : null;
  const dashboardUrlValid = /^https:\/\/\S+$/.test(draft.dashboard_url.trim());

  async function persist(patch: Partial<LiveBroadcastRow> = {}) {
    setError(null);
    const slug = (draft.slug || suggestedSlug).trim();
    if (!slug) {
      setError(tr('URL 슬러그를 입력하세요.'));
      return null;
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      setError(tr('URL 슬러그는 영문 소문자·숫자·하이픈만 쓸 수 있습니다.'));
      return null;
    }
    // 대시보드는 남의 앱 화면을 데려오는 것이라, 잘못된 주소는 저장 전에 걸러야 한다 —
    // 저장되고 나면 방송 중인 화면에 빈 프레임이 뜨고, 그때는 고칠 여유가 없다.
    const dashboardUrl = draft.dashboard_url.trim();
    if (dashboardUrl && !/^https:\/\//.test(dashboardUrl)) {
      setError(tr('대시보드 주소는 https:// 로 시작해야 합니다. 시청 화면이 https 라 http 는 브라우저가 막습니다.'));
      return null;
    }
    if (draft.show_dashboard && !dashboardUrl) {
      setError(tr('대시보드를 노출하려면 주소를 입력하세요.'));
      return null;
    }
    if (draft.dashboard_refresh_sec !== 0 && (draft.dashboard_refresh_sec < 10 || draft.dashboard_refresh_sec > 3600)) {
      setError(tr('자동 새로고침은 0(끔) 이거나 10~3600초 사이여야 합니다.'));
      return null;
    }
    const payload: Partial<LiveBroadcastRow> = {
      ...(draft.id ? { id: draft.id } : {}),
      event_product_id: draft.event_product_id,
      jnj_edition_id: draft.jnj_edition_id,
      jnj_division_id: draft.jnj_division_id,
      slug,
      title_i18n: draft.title_i18n,
      yt_video_id: draft.yt_video_id,
      backup_hls_url: draft.backup_hls_url.trim() || null,
      active_source: draft.active_source,
      status: draft.status,
      scheduled_at: draft.scheduled_at,
      show_chat: draft.show_chat,
      notice_i18n: draft.notice_i18n,
      dashboard_url: dashboardUrl || null,
      show_dashboard: draft.show_dashboard,
      dashboard_label_i18n: draft.dashboard_label_i18n,
      dashboard_refresh_sec: draft.dashboard_refresh_sec,
      ...patch,
    };
    try {
      const saved = await save.mutateAsync(payload);
      setDraft(toDraft(saved));
      return saved;
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      // DB CHECK(live_broadcasts_live_needs_source)에 걸린 경우를 사람 말로 바꿔 준다.
      setError(
        msg.includes('live_needs_source')
          ? tr('영상 소스가 지정되지 않아 방송을 시작할 수 없습니다.')
          : msg.includes('dashboard_url_https')
            ? tr('대시보드 주소는 https:// 로 시작해야 합니다.')
            : msg.includes('dashboard_refresh_range')
              ? tr('자동 새로고침은 0(끔) 이거나 10~3600초 사이여야 합니다.')
              : msg.includes('duplicate key')
                ? tr('이미 같은 URL 슬러그를 쓰는 방송이 있습니다.')
                : tr(msg) || tr('저장에 실패했습니다.'),
      );
      return null;
    }
  }

  return (
    <div className="space-y-5">
      {error && <p className="text-sm text-danger">{error}</p>}

      {otherLive.length > 0 && (
        <p className="flex items-start gap-2 rounded-sm bg-danger/10 p-3 text-sm text-danger">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {tr('이 행사에 이미 방송 중인 라이브가 있습니다. 시청자에게 어느 쪽이 보일지 확인하세요.')}
        </p>
      )}

      {/* ── 상태 전환 (제일 위 — 현장에서 제일 급한 버튼) ── */}
      <GoLiveButtons
        row={draft}
        saving={save.isPending || patch.isPending}
        onChange={async (values) => {
          setDraft((prev) => ({ ...prev, ...values }) as Draft);
          // 저장된 방송이면 상태 필드만 갱신한다 — 폼 전체를 쓰면 화면에 떠 있던 옛 값이
          // 다른 사람(또는 스위처)의 최신 수정을 덮어쓴다.
          if (draft.id) {
            try {
              const saved = await patch.mutateAsync({ id: draft.id, values });
              setDraft(toDraft(saved));
            } catch (e) {
              const msg = e instanceof Error ? e.message : '';
              setError(
                msg.includes('live_needs_source')
                  ? tr('영상 소스가 지정되지 않아 방송을 시작할 수 없습니다.')
                  : tr(msg) || tr('저장에 실패했습니다.'),
              );
            }
            return;
          }
          // 아직 저장 전인 새 방송이면 먼저 행을 만들어야 한다.
          persist(values);
        }}
      />

      {/* ── 기본 정보 ── */}
      <div className="space-y-1.5">
        <label className="label-caps">{tr('연결 행사')}</label>
        <select
          className="input"
          value={draft.event_product_id ?? ''}
          onChange={(e) => set('event_product_id', e.target.value || null)}
        >
          <option value="">{tr('연결 안 함')}</option>
          {eventOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-grey-400">
          {tr('연결하면 행사 상세 페이지에 LIVE 시청 버튼이 뜹니다.')}
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="label-caps">{tr('연결 J&J 대회')}</label>
        <select
          className="input"
          value={draft.jnj_edition_id ?? ''}
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              jnj_edition_id: e.target.value || null,
              // 대회를 바꾸면 부문은 남의 대회 것이 된다 — 같이 비운다.
              jnj_division_id: null,
            }))
          }
        >
          <option value="">{tr('연결 안 함')}</option>
          {jnjOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-grey-400">
          {tr('연결하면 J&J 대회 화면에 라이브 시청 버튼이 뜹니다.')}
        </p>
      </div>

      {/* 부문 — 대회를 고른 뒤에만 고를 수 있다. 안 고르면 그 대회 전 부문에 공통으로 뜬다. */}
      {draft.jnj_edition_id && (
        <div className="space-y-1.5">
          <label className="label-caps">{tr('연결 J&J 부문')}</label>
          <select
            className="input"
            value={draft.jnj_division_id ?? ''}
            onChange={(e) => set('jnj_division_id', e.target.value || null)}
          >
            <option value="">{tr('전 부문 공통')}</option>
            {divisionOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-grey-400">
            {divisionOptions.length === 0
              ? tr('이 대회에 등록된 부문이 없습니다. 부문관리에서 먼저 만들어 주세요.')
              : tr('고른 부문 화면에만 라이브 섹션이 뜹니다. 비우면 전 부문에 뜹니다.')}
          </p>
        </div>
      )}

      <I18nField
        label={tr('방송 제목')}
        required
        bilingual
        value={draft.title_i18n as Record<string, string>}
        onChange={(v) => set('title_i18n', v as I18n)}
      />

      <div className="space-y-1.5">
        <label className="label-caps">{tr('URL 슬러그')} *</label>
        <input
          className="input"
          value={draft.slug}
          placeholder={suggestedSlug || 'jlcf-2026-final'}
          onChange={(e) => set('slug', e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] text-grey-400">
            {watchUrl ? watchUrl : tr('고객몰 주소 /live/슬러그 가 됩니다.')}
          </p>
          {suggestedSlug && draft.slug !== suggestedSlug && (
            <button
              type="button"
              className="text-[11px] underline"
              onClick={() => set('slug', suggestedSlug)}
            >
              {tr('제목에서 자동 생성')}
            </button>
          )}
        </div>
      </div>

      {/* ── 영상 소스 ── */}
      <div className="space-y-2 rounded-sm border border-grey-200 p-4">
        <span className="label-caps">{tr('영상 소스')}</span>
        <div className="flex flex-wrap gap-4">
          {(['youtube', 'backup'] as LiveSource[]).map((src) => (
            <label key={src} className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="active_source"
                checked={draft.active_source === src}
                onChange={() => set('active_source', src)}
              />
              {src === 'youtube' ? tr('유튜브') : tr('백업 (HLS)')}
            </label>
          ))}
        </div>

        <YoutubeField value={draft.yt_video_id} onChange={(id) => set('yt_video_id', id)} />

        <div className="space-y-1.5 pt-1">
          <label className="label-caps">{tr('백업 HLS 주소 (선택)')}</label>
          <input
            className="input"
            value={draft.backup_hls_url}
            placeholder="https://…/index.m3u8"
            onChange={(e) => set('backup_hls_url', e.target.value)}
          />
          <p className="text-[11px] text-grey-400">
            {tr('유튜브가 막혔을 때 소스를 백업으로 바꾸면 이 주소로 재생됩니다. 이때 채팅은 숨겨집니다.')}
          </p>
        </div>
      </div>

      {/* ── 시청 화면 옵션 ── */}
      <div className="space-y-3 rounded-sm border border-grey-200 p-4">
        <span className="label-caps">{tr('시청 화면')}</span>
        <div className="space-y-1.5">
          <label className="label-caps text-grey-400">{tr('방송 예정 시각')}</label>
          <DateTimePicker
            value={toPickerValue(draft.scheduled_at)}
            onChange={(v) => set('scheduled_at', fromPickerValue(v))}
            locale={locale}
          />
          <p className="text-[11px] text-grey-400">
            {tr('예정 상태에서 시청자에게 카운트다운으로 보입니다.')}
          </p>
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={draft.show_chat}
            onChange={(e) => set('show_chat', e.target.checked)}
          />
          <span className="label-caps">{tr('유튜브 채팅 노출')}</span>
        </label>
        <I18nField
          label={tr('공지 (시청자 배너)')}
          bilingual
          value={draft.notice_i18n as Record<string, string>}
          onChange={(v) => set('notice_i18n', v as I18n)}
        />
      </div>

      {/* ── 진행 대시보드 ──
          현장 스크린에 띄우는 진행 화면(라운드·단계)을 온라인 시청자에게도 보여주는 설정.
          영상 소스와 나란히 두지 않고 '시청 화면' 다음에 둔 이유: 이건 송출이 아니라
          시청자에게 무엇을 더 보여줄지의 문제다. */}
      <div className="space-y-3 rounded-sm border border-grey-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="label-caps">{tr('진행 대시보드')}</span>
          {dashboardUrlValid && (
            <a
              className="btn btn-secondary btn-sm"
              href={draft.dashboard_url.trim()}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={14} /> {tr('새 창에서 열기')}
            </a>
          )}
        </div>
        <p className="text-[11px] text-grey-400">
          {tr('현장 진행 화면을 라이브 섹션의 영상 아래에 같이 띄웁니다. 시청자는 보기만 할 수 있습니다 — 화면 안의 조작 버튼은 눌리지 않습니다.')}
        </p>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={draft.show_dashboard}
            onChange={(e) => set('show_dashboard', e.target.checked)}
          />
          <span className="label-caps">{tr('대시보드 노출')}</span>
        </label>

        <div className="space-y-1.5">
          <label className="label-caps text-grey-400">{tr('대시보드 주소')}</label>
          <input
            className="input"
            value={draft.dashboard_url}
            placeholder="https://…/dashboard/JNJ-Cebu2026?round=semi&step=prep"
            onChange={(e) => set('dashboard_url', e.target.value)}
          />
          <p className="text-[11px] text-grey-400">
            {tr('https 주소만 됩니다. 라운드·단계가 주소에 들어가는 대시보드라면, 진행이 넘어갈 때 이 주소도 같이 바꿔 주세요.')}
          </p>
        </div>

        <I18nField
          label={tr('대시보드 제목 (선택)')}
          bilingual
          value={draft.dashboard_label_i18n as Record<string, string>}
          onChange={(v) => set('dashboard_label_i18n', v as I18n)}
        />

        <div className="space-y-1.5">
          <label className="label-caps text-grey-400">{tr('자동 새로고침 (초)')}</label>
          <input
            className="input"
            type="number"
            min={0}
            max={3600}
            step={10}
            value={draft.dashboard_refresh_sec}
            onChange={(e) => set('dashboard_refresh_sec', Number(e.target.value) || 0)}
          />
          <p className="text-[11px] text-grey-400">
            {tr('0 이면 새로고침하지 않습니다. 대시보드 내용이 바뀌어도 시청 화면은 알 수 없으니, 진행이 자주 바뀌면 30~60초를 권합니다.')}
          </p>
        </div>

        {/* 미리보기 — 저장 전에 '프레임에 뜨는지'를 확인하는 자리다. 대시보드 쪽이 임베드를
            막아 두면(X-Frame-Options) 시청 화면에서도 빈 프레임이 되는데, 방송 중에 알면 늦다.
            무거운 프레임이라 접어 두고, 누를 때만 불러온다. */}
        {dashboardUrlValid && (
          <div className="space-y-2">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setDashboardPreview((v) => !v)}
            >
              {dashboardPreview ? tr('미리보기 닫기') : tr('미리보기')}
            </button>
            {dashboardPreview && (
              <>
                <div className="aspect-video w-full overflow-hidden rounded-sm border border-grey-200 bg-black">
                  <iframe
                    title={tr('진행 대시보드 미리보기')}
                    src={draft.dashboard_url.trim()}
                    sandbox="allow-scripts allow-same-origin"
                    referrerPolicy="no-referrer"
                    className="h-full w-full border-0"
                  />
                </div>
                <p className="text-[11px] text-grey-400">
                  {tr('화면이 비어 있으면 대시보드 쪽이 외부 삽입을 막고 있는 것입니다. 그 앱에서 삽입을 허용해야 시청 화면에도 뜹니다.')}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── 카메라 ── */}
      <CameraRows broadcastId={draft.id ?? null} obsScenes={draft.obs_scenes} />

      {/* ── 현장 링크 ── */}
      {draft.id && (
        <div className="space-y-2 rounded-sm border border-grey-200 p-4">
          <span className="label-caps">{tr('현장 링크')}</span>
          <div className="flex flex-wrap items-center gap-2">
            <a
              className="btn btn-secondary btn-sm"
              href={`/live/${draft.id}/switcher`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={14} /> {tr('스위처 콘솔 열기')}
            </a>
            {tallyUrl && (
              <>
                <a
                  className="btn btn-secondary btn-sm"
                  href={tallyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink size={14} /> {tr('탈리 화면 열기')}
                </a>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    navigator.clipboard?.writeText(tallyUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1600);
                  }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? tr('복사했습니다') : tr('탈리 주소 복사')}
                </button>
              </>
            )}
          </div>
          <p className="text-[11px] text-grey-400">
            {tr('탈리 주소는 로그인 없이 열립니다. 현장 노트북에만 전달하세요.')}
          </p>
        </div>
      )}

      {/* ── 저장 ── */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={save.isPending}
          className={cn('btn btn-primary btn-sm', save.isPending && 'opacity-60')}
          onClick={async () => {
            const saved = await persist();
            if (saved) onDone();
          }}
        >
          {save.isPending ? tr('저장 중…') : tr('저장')}
        </button>
        {draft.id && (
          <button
            type="button"
            disabled={save.isPending}
            className="btn btn-secondary btn-sm"
            onClick={() => persist()}
          >
            {tr('저장하고 계속 편집')}
          </button>
        )}
        <button type="button" className="btn btn-secondary btn-sm" onClick={onDone}>
          {tr('닫기')}
        </button>
      </div>
    </div>
  );
}
