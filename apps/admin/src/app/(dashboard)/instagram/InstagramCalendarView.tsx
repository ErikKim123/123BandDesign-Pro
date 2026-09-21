// 인스타그램 예약 캘린더 — 월 그리드에서 날짜를 눌러 게시물을 만들고, 칩을 눌러 수정한다.
// 예약은 서버(instagram_posts)에 저장되고 cron 이 발행하므로 브라우저를 닫아도 정시에 올라간다.
'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tr } from '@/i18n/tr';
import Link from 'next/link';
import {
  ChevronLeft, ChevronRight, Plus, X, Upload, Link2, Image as ImageIcon, Video,
  Trash2, Zap, ExternalLink, AlertCircle, Instagram,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { downscaleImageToBlob, blobExt, UPLOAD_CACHE_CONTROL } from '@/lib/image';
import { useT } from '@/lib/locale/LocaleContext';
import { cn } from '@/lib/utils';

const BUCKET = 'band123-instagram-media';
const CAPTION_MAX = 2200;
const MAX_IMAGE_MB = 8;
const MAX_VIDEO_MB = 100;
const DEFAULT_HOUR = 19; // 빈 날짜를 눌렀을 때 기본 게시 시각(저녁 도달률이 높다)
const CHIPS_PER_DAY = 3; // 셀에 직접 보여줄 칩 수(넘치면 "+n건 더")

type MediaType = 'IMAGE' | 'REELS';
type PostStatus = 'scheduled' | 'publishing' | 'posted' | 'failed' | 'canceled';

interface IgPost {
  id: string;
  scheduled_at: string;
  caption: string;
  media_type: MediaType;
  media_url: string;
  thumb_url: string | null;
  status: PostStatus;
  permalink: string | null;
  error: string | null;
  published_at: string | null;
}

// 일괄 업데이트 미리보기 — 서버 /api/instagram/import 응답 형태(클라이언트용 최소 정의).
interface PreviewRow {
  externalRef: string;
  postId: string;
  scheduledAt: string | null;
  whenLabel: string;
  caption: string;
  mediaUrl: string;
  account: string;
  topic: string;
  platforms: string;
  error: string | null;
}
interface ImportPreview {
  rows: PreviewRow[];
  importable: number;
  invalid: number;
  totalRows: number;
}
interface ImportResult {
  created: number;
  updated: number;
  skippedPosted: number;
  invalid: number;
}

// ── 날짜 유틸 ── 모두 로컬 시간 기준. 서버에는 ISO(UTC)로 오간다.
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isSameDay = (a: Date, b: Date) => dayKey(a) === dayKey(b);

/** datetime-local 입력값(YYYY-MM-DDTHH:mm) ↔ Date */
const toLocalInput = (d: Date) => `${dayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** 월 그리드 — 해당 달을 감싸는 일요일 시작 6주(42칸). */
function monthGrid(month: Date): Date[] {
  const first = startOfMonth(month);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

const STATUS_STYLE: Record<PostStatus, string> = {
  scheduled: 'bg-green-600 text-white', // 발행 전 예약 — 녹색
  publishing: 'bg-amber-500 text-white',
  posted: 'bg-violet-200 text-violet-800', // 게시 완료 — 라이트 퍼플
  failed: 'bg-red-600 text-white',
  canceled: 'bg-grey-300 text-grey-600',
};

interface Draft {
  id: string | null; // null = 신규
  when: string; // datetime-local
  mediaType: MediaType;
  source: 'upload' | 'url';
  mediaUrl: string;
  thumbUrl: string;
  caption: string;
  status: PostStatus;
  permalink: string | null;
  error: string | null;
}

function emptyDraft(when: string): Draft {
  return {
    id: null,
    when,
    mediaType: 'IMAGE',
    source: 'upload',
    mediaUrl: '',
    thumbUrl: '',
    caption: '',
    status: 'scheduled',
    permalink: null,
    error: null,
  };
}

function draftFromPost(p: IgPost): Draft {
  return {
    id: p.id,
    when: toLocalInput(new Date(p.scheduled_at)),
    mediaType: p.media_type,
    source: 'url', // 저장된 건 이미 URL 형태 — 바꾸려면 업로드 탭으로 전환
    mediaUrl: p.media_url,
    thumbUrl: p.thumb_url ?? '',
    caption: p.caption,
    status: p.status,
    permalink: p.permalink,
    error: p.error,
  };
}

export function InstagramCalendarView({ connected, handle }: { connected: boolean; handle: string }) {
  const t = useT();
  const m = t.instagram;

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [posts, setPosts] = useState<IgPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState<'save' | 'post' | 'upload' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── 일괄 업데이트(구글 시트) ──
  const [sheetUrl, setSheetUrl] = useState('');
  const [importBusy, setImportBusy] = useState<'preview' | 'commit' | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  // 마지막으로 쓴 시트 링크를 이 브라우저에 기억.
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ig.sheetUrl');
      if (saved) setSheetUrl(saved);
    } catch {
      /* localStorage 접근 불가 무시 */
    }
  }, []);

  const updateSheetUrl = (v: string) => {
    setSheetUrl(v);
    try {
      localStorage.setItem('ig.sheetUrl', v);
    } catch {
      /* 무시 */
    }
  };

  async function onPreviewSheet() {
    const url = sheetUrl.trim();
    if (!url) return setMsg({ type: 'err', text: m.importPlaceholder });
    setImportBusy('preview');
    setMsg(null);
    try {
      const res = await fetch('/api/instagram/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const json = (await res.json()) as { preview?: ImportPreview; error?: string };
      if (!res.ok || !json.preview) throw new Error(json.error || m.loadFailed);
      setPreview(json.preview);
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? tr(err.message) : m.loadFailed });
    } finally {
      setImportBusy(null);
    }
  }

  async function onCommitSheet() {
    setImportBusy('commit');
    setMsg(null);
    try {
      const res = await fetch('/api/instagram/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: sheetUrl.trim(), commit: true }),
      });
      const json = (await res.json()) as { result?: ImportResult; error?: string };
      if (!res.ok || !json.result) throw new Error(json.error || t.settings.saveFailed);
      const r = json.result;
      setPreview(null);
      await load();
      setMsg({ type: 'ok', text: m.importDone(r.created, r.updated, r.skippedPosted) });
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? tr(err.message) : t.settings.saveFailed });
    } finally {
      setImportBusy(null);
    }
  }

  const grid = useMemo(() => monthGrid(month), [month]);
  const today = new Date();

  // 그리드 전체 범위를 한 번에 조회(앞뒤 달 걸친 칸도 채워진다).
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = grid[0]!;
      const to = new Date(grid[41]!);
      to.setDate(to.getDate() + 1);
      const res = await fetch(`/api/instagram/posts?from=${from.toISOString()}&to=${to.toISOString()}`);
      const json = (await res.json()) as { posts?: IgPost[]; error?: string };
      if (!res.ok) throw new Error(json.error || m.loadFailed);
      setPosts(json.posts ?? []);
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? tr(err.message) : m.loadFailed });
    } finally {
      setLoading(false);
    }
    // grid 는 month 에서 파생 — month 변경 시에만 다시 조회한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  // 날짜별 묶음 — 셀 렌더링에서 O(1) 조회.
  const byDay = useMemo(() => {
    const map = new Map<string, IgPost[]>();
    for (const p of posts) {
      const k = dayKey(new Date(p.scheduled_at));
      const arr = map.get(k);
      if (arr) arr.push(p);
      else map.set(k, [p]);
    }
    return map;
  }, [posts]);

  const statusLabel = (s: PostStatus) =>
    ({
      scheduled: m.statusScheduled,
      publishing: m.statusPublishing,
      posted: m.statusPosted,
      failed: m.statusFailed,
      canceled: m.statusCanceled,
    })[s];

  function openNew(day: Date) {
    const d = new Date(day);
    d.setHours(DEFAULT_HOUR, 0, 0, 0);
    setMsg(null);
    setDraft(emptyDraft(toLocalInput(d)));
  }

  function openEdit(p: IgPost) {
    setMsg(null);
    setDraft(draftFromPost(p));
  }

  const patch = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));

  // ── 업로드 ── Storage 에 올리고 공개 URL 을 미디어 주소로 사용(인스타가 직접 받아간다).
  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !draft) return;
    setMsg(null);

    const isVideo = draft.mediaType === 'REELS';
    if (isVideo && !file.type.startsWith('video/')) return setMsg({ type: 'err', text: m.onlyVideoFile });
    if (!isVideo && !file.type.startsWith('image/')) return setMsg({ type: 'err', text: m.onlyImageFile });

    const limitMb = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB;
    if (file.size > limitMb * 1024 * 1024) return setMsg({ type: 'err', text: m.fileTooLarge(limitMb) });

    setBusy('upload');
    try {
      // 이미지는 업로드 전 축소(용량·비용). 동영상은 원본 그대로.
      const blob = isVideo ? file : await downscaleImageToBlob(file, 1440, 0.9);
      const ext = isVideo ? file.name.split('.').pop()?.toLowerCase() || 'mp4' : blobExt(blob);
      const path = `${dayKey(new Date())}/${Date.now()}.${ext}`;
      const supabase = createClient();
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
        cacheControl: UPLOAD_CACHE_CONTROL,
        upsert: true,
        contentType: isVideo ? file.type : blob.type || 'image/jpeg',
      });
      if (upErr) throw upErr;
      patch({ mediaUrl: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl });
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? tr(err.message) : m.uploadFailed });
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function save(): Promise<string | null> {
    if (!draft) return null;
    if (!draft.when) {
      setMsg({ type: 'err', text: m.needWhen });
      return null;
    }
    if (!draft.mediaUrl.trim()) {
      setMsg({ type: 'err', text: m.needMedia });
      return null;
    }

    const body = {
      scheduledAt: new Date(draft.when).toISOString(),
      caption: draft.caption,
      mediaType: draft.mediaType,
      mediaUrl: draft.mediaUrl.trim(),
      thumbUrl: draft.mediaType === 'REELS' ? draft.thumbUrl.trim() || null : null,
    };
    const res = await fetch(draft.id ? `/api/instagram/posts/${draft.id}` : '/api/instagram/posts', {
      method: draft.id ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { post?: IgPost; error?: string };
    if (!res.ok || !json.post) throw new Error(json.error || t.settings.saveFailed);
    return json.post.id;
  }

  async function onSchedule() {
    setBusy('save');
    setMsg(null);
    try {
      const wasNew = !draft?.id;
      const id = await save();
      if (!id) return;
      await load();
      setDraft(null);
      setMsg({ type: 'ok', text: wasNew ? m.scheduled : m.updated });
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? tr(err.message) : t.settings.saveFailed });
    } finally {
      setBusy(null);
    }
  }

  // 지금 게시 — 저장(신규면 생성)한 뒤 곧바로 발행한다.
  async function onPostNow() {
    setBusy('post');
    setMsg(null);
    try {
      const id = await save();
      if (!id) return;
      const res = await fetch(`/api/instagram/posts/${id}/publish`, { method: 'POST' });
      const json = (await res.json()) as { ok?: boolean; post?: IgPost; error?: string };
      await load();
      if (!res.ok || !json.ok) {
        // 발행 실패해도 예약 자체는 남아 있으므로 패널을 열어 사유를 보여준다.
        if (json.post) setDraft(draftFromPost(json.post));
        throw new Error(json.error || t.settings.saveFailed);
      }
      setDraft(null);
      setMsg({ type: 'ok', text: m.postedOk });
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? tr(err.message) : t.settings.saveFailed });
    } finally {
      setBusy(null);
    }
  }

  async function onDelete() {
    if (!draft?.id || !window.confirm(m.deleteConfirm)) return;
    setBusy('save');
    try {
      const res = await fetch(`/api/instagram/posts/${draft.id}`, { method: 'DELETE' });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || t.settings.saveFailed);
      await load();
      setDraft(null);
      setMsg({ type: 'ok', text: m.deleted });
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? tr(err.message) : t.settings.saveFailed });
    } finally {
      setBusy(null);
    }
  }

  const monthLabel = month.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
  const isPosted = draft?.status === 'posted';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl uppercase tracking-tight">{m.title}</h1>
          <p className="mt-1 text-sm text-grey-500">{m.intro}</p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          {connected && (
            <span className="inline-flex items-center gap-1.5 self-end rounded-pill bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700">
              <Instagram size={13} /> {m.connectedAs(handle.replace(/^@/, ''))}
            </span>
          )}
          {/* ── 일괄 업데이트 ── 구글 시트 링크를 붙여넣고 IG 행을 예약 등록. */}
          <div className="flex w-full items-center gap-2 sm:w-[440px]">
            <input
              value={sheetUrl}
              onChange={(e) => updateSheetUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !importBusy) void onPreviewSheet();
              }}
              placeholder={m.importPlaceholder}
              className="input h-9 min-w-0 flex-1 text-sm"
            />
            <button
              onClick={onPreviewSheet}
              disabled={importBusy !== null}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-pill bg-black px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Upload size={14} />
              {importBusy === 'preview' ? m.importLoading : m.importLabel}
            </button>
          </div>
        </div>
      </div>

      {!connected && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1">{m.notConnected}</span>
          <Link href="/settings" className="rounded-pill bg-amber-800 px-3 py-1.5 text-xs font-medium text-white">
            {m.goToSettings}
          </Link>
        </div>
      )}

      {msg && (
        <div
          className={cn(
            'rounded-lg px-4 py-2.5 text-sm',
            msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
          )}
        >
          {msg.text}
        </div>
      )}

      {/* ── 캘린더 ── */}
      <section className="rounded-2xl border border-grey-200">
        <header className="flex items-center justify-between gap-3 border-b border-grey-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-grey-900">{monthLabel}</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMonth(addMonths(month, -1))}
              aria-label={m.prevMonth}
              className="rounded-lg p-2 text-grey-500 hover:bg-grey-50 hover:text-black"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setMonth(startOfMonth(new Date()))}
              className="rounded-pill px-3 py-1.5 text-xs font-medium text-grey-600 hover:bg-grey-50 hover:text-black"
            >
              {m.today}
            </button>
            <button
              onClick={() => setMonth(addMonths(month, 1))}
              aria-label={m.nextMonth}
              className="rounded-lg p-2 text-grey-500 hover:bg-grey-50 hover:text-black"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </header>

        <div className="grid grid-cols-7 border-b border-grey-100">
          {m.weekdays.map((w, i) => (
            <div
              key={w}
              className={cn(
                'px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide',
                i === 0 ? 'text-red-500' : 'text-grey-400',
              )}
            >
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {grid.map((day) => {
            const inMonth = day.getMonth() === month.getMonth();
            const dayPosts = byDay.get(dayKey(day)) ?? [];
            const shown = dayPosts.slice(0, CHIPS_PER_DAY);
            const rest = dayPosts.length - shown.length;

            return (
              <div
                key={dayKey(day)}
                className={cn(
                  'group relative min-h-[104px] border-b border-r border-grey-100 p-1.5',
                  !inMonth && 'bg-grey-50/60',
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px]',
                      isSameDay(day, today)
                        ? 'bg-black font-semibold text-white'
                        : inMonth
                          ? day.getDay() === 0
                            ? 'text-red-500'
                            : 'text-grey-600'
                          : 'text-grey-300',
                    )}
                  >
                    {day.getDate()}
                  </span>
                  <button
                    onClick={() => openNew(day)}
                    aria-label={m.addOnDay}
                    title={m.addOnDay}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-grey-100 text-grey-500 shadow-sm ring-1 ring-grey-200 transition-colors hover:bg-black hover:text-white hover:ring-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-1 group-hover:bg-black group-hover:text-white group-hover:ring-black"
                  >
                    <Plus size={14} strokeWidth={2.5} />
                  </button>
                </div>

                <ul className="space-y-1">
                  {shown.map((p) => (
                    <li key={p.id}>
                      <button
                        onClick={() => openEdit(p)}
                        title={`${statusLabel(p.status)} · ${p.caption.slice(0, 60) || m.newPost}`}
                        className={cn(
                          'flex w-full items-center gap-1 rounded px-1.5 py-1 text-left text-[10px] leading-tight transition-opacity hover:opacity-85',
                          STATUS_STYLE[p.status],
                        )}
                      >
                        {p.media_type === 'REELS' ? (
                          <Video size={9} className="shrink-0" />
                        ) : (
                          <ImageIcon size={9} className="shrink-0" />
                        )}
                        <span className="shrink-0 tabular-nums opacity-80">
                          {pad(new Date(p.scheduled_at).getHours())}:{pad(new Date(p.scheduled_at).getMinutes())}
                        </span>
                        <span className="truncate">{p.caption || statusLabel(p.status)}</span>
                      </button>
                    </li>
                  ))}
                  {rest > 0 && <li className="px-1.5 text-[10px] text-grey-400">{m.morePosts(rest)}</li>}
                </ul>
              </div>
            );
          })}
        </div>

        <p className="px-5 py-3 text-xs text-grey-400">
          {loading ? t.settings.loading : posts.length === 0 ? m.emptyMonth : m.cronNote}
        </p>
      </section>

      {/* ── 작성/수정 패널 ── 화면 중앙 모달. */}
      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            aria-label={m.cancel}
            onClick={() => setDraft(null)}
            className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
          />
          <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-grey-100 bg-white px-5 py-4">
              <h3 className="font-semibold text-grey-900">{draft.id ? m.editPost : m.newPost}</h3>
              <button
                onClick={() => setDraft(null)}
                aria-label={m.cancel}
                className="rounded-lg p-1.5 text-grey-400 hover:bg-grey-50 hover:text-black"
              >
                <X size={18} />
              </button>
            </header>

            <div className="space-y-5 px-5 py-5">
              {draft.error && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-700">
                  <AlertCircle size={14} className="mt-px shrink-0" />
                  <span>{draft.error}</span>
                </div>
              )}
              {isPosted && (
                <div className="flex items-center justify-between gap-2 rounded-lg bg-green-50 px-3 py-2.5 text-xs text-green-700">
                  <span>{m.statusPosted}</span>
                  {draft.permalink && (
                    <a
                      href={draft.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium underline"
                    >
                      {m.openPost} <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              )}

              {/* 게시 일시 */}
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-grey-600">{m.when}</span>
                <input
                  type="datetime-local"
                  value={draft.when}
                  disabled={isPosted}
                  onChange={(e) => patch({ when: e.target.value })}
                  className="input w-full disabled:bg-grey-50 disabled:text-grey-400"
                />
              </label>

              {/* 미디어 종류 */}
              <div>
                <span className="mb-1.5 block text-xs font-medium text-grey-600">{m.mediaKind}</span>
                <div className="flex gap-2">
                  {(
                    [
                      { v: 'IMAGE' as const, label: m.kindImage, Icon: ImageIcon },
                      { v: 'REELS' as const, label: m.kindVideo, Icon: Video },
                    ]
                  ).map(({ v, label, Icon }) => (
                    <button
                      key={v}
                      disabled={isPosted}
                      onClick={() => patch({ mediaType: v, mediaUrl: '' })}
                      className={cn(
                        'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors disabled:opacity-50',
                        draft.mediaType === v
                          ? 'border-black bg-black text-white'
                          : 'border-grey-200 text-grey-600 hover:border-grey-300',
                      )}
                    >
                      <Icon size={14} /> {label}
                    </button>
                  ))}
                </div>
                {draft.mediaType === 'REELS' && <p className="mt-1.5 text-xs text-grey-400">{m.videoHint}</p>}
              </div>

              {/* 미디어 소스 */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-grey-600">{m.source}</span>
                  <div className="flex rounded-lg bg-grey-100 p-0.5">
                    {(
                      [
                        { v: 'upload' as const, label: m.sourceUpload, Icon: Upload },
                        { v: 'url' as const, label: m.sourceUrl, Icon: Link2 },
                      ]
                    ).map(({ v, label, Icon }) => (
                      <button
                        key={v}
                        disabled={isPosted}
                        onClick={() => patch({ source: v })}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50',
                          draft.source === v ? 'bg-white text-black shadow-sm' : 'text-grey-500 hover:text-black',
                        )}
                      >
                        <Icon size={11} /> {label}
                      </button>
                    ))}
                  </div>
                </div>

                {draft.source === 'upload' ? (
                  <>
                    <input
                      ref={fileRef}
                      type="file"
                      accept={draft.mediaType === 'REELS' ? 'video/*' : 'image/*'}
                      onChange={onPickFile}
                      className="hidden"
                    />
                    <button
                      disabled={isPosted || busy === 'upload'}
                      onClick={() => fileRef.current?.click()}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-grey-300 px-3 py-3 text-sm text-grey-500 transition-colors hover:border-grey-400 hover:text-black disabled:opacity-50"
                    >
                      <Upload size={14} />
                      {busy === 'upload' ? m.uploading : m.upload}
                    </button>
                  </>
                ) : (
                  <input
                    value={draft.mediaUrl}
                    disabled={isPosted}
                    onChange={(e) => patch({ mediaUrl: e.target.value })}
                    placeholder={m.mediaUrlPh}
                    className="input w-full disabled:bg-grey-50"
                  />
                )}
              </div>

              {/* 릴스 커버 */}
              {draft.mediaType === 'REELS' && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-grey-600">{m.coverUrl}</span>
                  <input
                    value={draft.thumbUrl}
                    disabled={isPosted}
                    onChange={(e) => patch({ thumbUrl: e.target.value })}
                    placeholder={m.coverUrlPh}
                    className="input w-full disabled:bg-grey-50"
                  />
                </label>
              )}

              {/* 미리보기 */}
              <div>
                <span className="mb-1.5 block text-xs font-medium text-grey-600">{m.previewTitle}</span>
                <div
                  className={cn(
                    'flex items-center justify-center overflow-hidden rounded-xl border border-grey-200 bg-grey-50',
                    draft.mediaType === 'REELS' ? 'aspect-[9/16] max-h-80' : 'aspect-square',
                  )}
                >
                  {draft.mediaUrl ? (
                    draft.mediaType === 'REELS' ? (
                      <video src={draft.mediaUrl} controls className="h-full w-full object-cover" />
                    ) : (
                      // 관리자 내부 도구 + 외부 URL 허용이라 next/image 대신 img 사용
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={draft.mediaUrl} alt={m.previewTitle} className="h-full w-full object-cover" />
                    )
                  ) : (
                    <p className="px-6 text-center text-xs text-grey-400">{m.previewEmpty}</p>
                  )}
                </div>
              </div>

              {/* 캡션 */}
              <label className="block">
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="text-xs font-medium text-grey-600">{m.caption}</span>
                  <span
                    className={cn(
                      'text-[11px] tabular-nums',
                      draft.caption.length > CAPTION_MAX ? 'text-red-600' : 'text-grey-400',
                    )}
                  >
                    {m.captionCount(draft.caption.length, CAPTION_MAX)}
                  </span>
                </div>
                <textarea
                  value={draft.caption}
                  disabled={isPosted}
                  onChange={(e) => patch({ caption: e.target.value })}
                  placeholder={m.captionPh}
                  rows={7}
                  className="input w-full resize-y leading-relaxed disabled:bg-grey-50"
                />
              </label>
            </div>

            {/* 액션 */}
            {!isPosted && (
              <footer className="sticky bottom-0 flex items-center gap-2 border-t border-grey-100 bg-white px-5 py-4">
                {draft.id && (
                  <button
                    onClick={onDelete}
                    disabled={busy !== null}
                    aria-label={m.deletePost}
                    title={m.deletePost}
                    className="rounded-lg p-2.5 text-grey-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <button
                  onClick={onSchedule}
                  disabled={busy !== null}
                  className="flex-1 rounded-pill bg-black px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {busy === 'save' ? m.scheduleSaving : m.schedule}
                </button>
                <button
                  onClick={onPostNow}
                  disabled={busy !== null || !connected}
                  title={connected ? undefined : m.notConnected}
                  className="inline-flex items-center gap-1.5 rounded-pill border border-grey-300 px-4 py-2.5 text-sm font-medium text-grey-700 transition-colors hover:border-black hover:text-black disabled:opacity-50"
                >
                  <Zap size={14} />
                  {busy === 'post' ? m.posting : m.postNow}
                </button>
              </footer>
            )}
          </div>
        </div>
      )}

      {/* ── 일괄 업데이트 미리보기 ── 등록 전에 어떤 게시물이 올라갈지 확인. */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            aria-label={m.importClose}
            onClick={() => setPreview(null)}
            className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
          />
          <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-3 border-b border-grey-100 px-5 py-4">
              <div>
                <h3 className="font-semibold text-grey-900">{m.importTitle}</h3>
                <p className="mt-0.5 text-xs text-grey-500">
                  {m.importSummary(preview.importable, preview.invalid, preview.totalRows)}
                </p>
              </div>
              <button
                onClick={() => setPreview(null)}
                aria-label={m.importClose}
                className="rounded-lg p-1.5 text-grey-400 hover:bg-grey-50 hover:text-black"
              >
                <X size={18} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {preview.rows.length === 0 ? (
                <p className="py-10 text-center text-sm text-grey-500">{m.importNoRows}</p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="text-grey-400">
                    <tr className="border-b border-grey-100">
                      <th className="py-2 pr-3 font-medium">{m.importColWhen}</th>
                      <th className="py-2 pr-3 font-medium">{m.importColCaption}</th>
                      <th className="py-2 font-medium">{m.importColMedia}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr
                        key={r.externalRef}
                        className={cn('border-b border-grey-50 align-top', r.error && 'opacity-50')}
                      >
                        <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-grey-600">
                          {r.whenLabel || '—'}
                        </td>
                        <td className="py-2 pr-3 text-grey-700">
                          <span className="block max-w-[360px] truncate">{r.caption || '—'}</span>
                        </td>
                        <td className="py-2">
                          {r.error ? (
                            <span
                              title={r.error}
                              className="inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-600"
                            >
                              <AlertCircle size={10} /> {m.importExcluded}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-green-50 px-1.5 py-0.5 text-[10px] text-green-700">
                              <Video size={10} /> {m.importHasVideo}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-grey-100 px-5 py-4">
              <p className="max-w-[60%] text-xs text-grey-400">{m.importHint}</p>
              <button
                onClick={onCommitSheet}
                disabled={importBusy !== null || preview.importable === 0}
                className="shrink-0 rounded-pill bg-black px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {importBusy === 'commit' ? m.importCommitting : m.importConfirm(preview.importable)}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
