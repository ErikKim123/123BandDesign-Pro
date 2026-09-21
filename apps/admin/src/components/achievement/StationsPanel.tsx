// Design Ref: 업적관리 — 현장 QR(업적 스테이션).
//
// 행사장에 붙일 QR 을 만든다. 참가자가 폰 카메라로 찍으면 웹의 /{locale}/qr/{code} 가 열리고,
// 로그인한 회원에게 연결된 업적이 지급된다(DB claim_station). 여러 곳을 찍어야 하는 업적은
// 업적 조건 '현장 QR 스캔 N곳' 의 N 만큼 서로 다른 QR 을 만들면 된다.
//
// 코드는 URL 에 그대로 노출된다 — 목록은 운영진만 보고(RLS), 유효 시간을 짧게 잡는 것이 부정 방지의 핵심.
'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import { Copy, Download, Pencil, Plus, Power, QrCode, Trash2 } from 'lucide-react';
import { tr, trI18n } from '@/i18n/tr';
import { FormDrawer } from '@/components/resource/FormDrawer';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const WEB_BASE = (process.env.NEXT_PUBLIC_WEB_URL ?? 'https://123band-web.vercel.app').replace(/\/$/, '');

interface AchievementOpt {
  id: string;
  code: string;
  name_i18n: Record<string, string>;
  conditions: { type: string; count?: number }[] | null;
  is_active: boolean;
}

interface EventOpt {
  id: string;
  name_i18n: Record<string, string>;
}

interface Station {
  id: string;
  code: string;
  name: string;
  achievement_id: string;
  product_id: string | null;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

const needsQr = (a: AchievementOpt) =>
  Array.isArray(a.conditions) && a.conditions.some((c) => c?.type === 'station_scan');
const requiredCount = (a: AchievementOpt | undefined) =>
  Math.max(1, Number(a?.conditions?.find((c) => c.type === 'station_scan')?.count ?? 1));

/** datetime-local 값 → ISO. 입력은 관리자 브라우저 시간대 기준이다. */
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);
/** ISO → datetime-local 값(브라우저 시간대). 수정 폼에 저장된 시각을 되돌려 넣을 때. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

export function StationsPanel() {
  const supabase = useMemo(() => createClient(), []);
  const [stations, setStations] = useState<Station[]>([]);
  const [achievements, setAchievements] = useState<AchievementOpt[]>([]);
  const [events, setEvents] = useState<EventOpt[]>([]);
  const [scans, setScans] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Station | null>(null);
  const [qrOf, setQrOf] = useState<Station | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [st, ac, ev, sc] = await Promise.all([
      supabase
        .from('achievement_stations')
        .select('id, code, name, achievement_id, product_id, valid_from, valid_until, is_active, created_at')
        .order('created_at', { ascending: false }),
      supabase.from('achievements').select('id, code, name_i18n, conditions, is_active').order('sort_order'),
      supabase
        .from('products')
        .select('id, name_i18n')
        .eq('product_type', 'ticket')
        .order('created_at', { ascending: false }),
      supabase.from('achievement_station_scans').select('station_id'),
    ]);
    if (st.error) setError(st.error.message);
    setStations((st.data ?? []) as Station[]);
    setAchievements((ac.data ?? []) as AchievementOpt[]);
    setEvents((ev.data ?? []) as EventOpt[]);
    const counts: Record<string, number> = {};
    for (const r of (sc.data ?? []) as { station_id: string }[]) counts[r.station_id] = (counts[r.station_id] ?? 0) + 1;
    setScans(counts);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const achById = useMemo(() => new Map(achievements.map((a) => [a.id, a])), [achievements]);
  const evById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const shown = filter ? stations.filter((s) => s.achievement_id === filter) : stations;

  async function toggle(s: Station) {
    const { error: e } = await supabase.from('achievement_stations').update({ is_active: !s.is_active }).eq('id', s.id);
    if (e) setError(e.message);
    await load();
  }

  async function remove(s: Station) {
    if (!window.confirm(`${s.name} — ${tr('이 QR 을 삭제할까요? 찍은 기록도 함께 지워지고, 이미 붙인 QR 은 더 이상 열리지 않습니다.')}`)) return;
    const { error: e } = await supabase.from('achievement_stations').delete().eq('id', s.id);
    if (e) setError(e.message);
    await load();
  }

  /** 업적 칸 — 이름 + '여러 곳 중 하나' · '업적 꺼짐' 같은 단서. 카드와 표가 같은 내용을 쓴다. */
  const achLabel = (s: Station) => {
    const a = achById.get(s.achievement_id);
    if (!a) return '—';
    return (
      <>
        {trI18n(a.name_i18n) || a.code}
        {requiredCount(a) > 1 && (
          <span className="ml-1 text-xs text-grey-400">
            ({requiredCount(a)}
            {tr('곳 중 하나')})
          </span>
        )}
        {!a.is_active && <span className="ml-1 text-xs text-amber-700">· {tr('업적 꺼짐')}</span>}
      </>
    );
  };
  const eventLabel = (s: Station) => (s.product_id ? trI18n(evById.get(s.product_id)?.name_i18n) || '—' : '—');
  const windowLabel = (s: Station) =>
    s.valid_from || s.valid_until ? `${fmt(s.valid_from) || '…'} ~ ${fmt(s.valid_until) || '…'}` : tr('제한 없음');

  const status = (s: Station) => {
    const now = Date.now();
    if (!s.is_active) return { text: tr('꺼짐'), tone: 'off' };
    if (s.valid_from && now < new Date(s.valid_from).getTime()) return { text: tr('대기'), tone: 'wait' };
    if (s.valid_until && now > new Date(s.valid_until).getTime()) return { text: tr('종료'), tone: 'off' };
    return { text: tr('열림'), tone: 'on' };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-sm text-grey-600">
          {tr('행사장에 붙일 QR 을 만듭니다. 참가자가 폰 카메라로 찍으면 로그인한 회원에게 연결된 업적이 지급됩니다. 여러 곳을 찍어야 하는 업적은 조건의 곳 수만큼 QR 을 만드세요.')}
        </p>
        <div className="flex w-full gap-2 sm:w-auto">
          <select
            className="input min-w-0 flex-1 py-2 text-sm sm:flex-none"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">{tr('업적: 전체')}</option>
            {achievements.filter(needsQr).map((a) => (
              <option key={a.id} value={a.id}>
                {trI18n(a.name_i18n) || a.code}
              </option>
            ))}
          </select>
          <button className="btn btn-primary btn-sm shrink-0" onClick={() => setCreating(true)}>
            <Plus size={14} /> {tr('QR 만들기')}
          </button>
        </div>
      </div>

      {error && <p className="rounded-md bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p>}

      {shown.length === 0 ? (
        <div className="rounded-lg border border-dashed border-grey-300 py-14 text-center text-sm text-grey-500">
          <QrCode size={28} className="mx-auto mb-2 text-grey-300" />
          {tr('아직 만든 현장 QR 이 없습니다.')}
        </div>
      ) : (
        <div className="rounded-lg border border-grey-200">
          {/* 폰: 카드. 열이 7개라 표를 그대로 두면 칸이 좁아 글자가 한 자씩 쪼개진다(어드민 목록과 같은 규칙). */}
          <ul className="md:hidden">
            {shown.map((s) => {
              const st = status(s);
              return (
                <li key={s.id} className="border-b border-grey-100 px-4 py-3 last:border-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-medium text-ink">{s.name}</p>
                      <p className="font-mono text-[11px] text-grey-400">{s.code}</p>
                    </div>
                    <StatusPill text={st.text} tone={st.tone} />
                  </div>

                  <dl className="mt-2 grid grid-cols-[minmax(4rem,auto)_1fr] gap-x-3 gap-y-1 text-xs">
                    <dt className="label-caps pt-0.5 !text-[10px]">{tr('업적')}</dt>
                    <dd className="min-w-0 break-words text-grey-700">{achLabel(s)}</dd>
                    <dt className="label-caps pt-0.5 !text-[10px]">{tr('행사')}</dt>
                    <dd className="min-w-0 break-words text-grey-700">{eventLabel(s)}</dd>
                    <dt className="label-caps pt-0.5 !text-[10px]">{tr('유효 시간')}</dt>
                    <dd className="min-w-0 break-words text-grey-700">{windowLabel(s)}</dd>
                    <dt className="label-caps pt-0.5 !text-[10px]">{tr('스캔')}</dt>
                    <dd className="tabular-nums text-grey-700">{(scans[s.id] ?? 0).toLocaleString()}</dd>
                  </dl>

                  <div className="mt-2.5 flex justify-end gap-1 border-t border-grey-100 pt-2">
                    <RowActions s={s} onQr={setQrOf} onEdit={setEditing} onToggle={toggle} onRemove={remove} />
                  </div>
                </li>
              );
            })}
          </ul>

          {/* 태블릿 이상: 표 */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-grey-50 text-left text-xs text-grey-500">
                <tr>
                  <th className="px-3 py-2">{tr('QR 이름')}</th>
                  <th className="px-3 py-2">{tr('업적')}</th>
                  <th className="px-3 py-2">{tr('행사')}</th>
                  <th className="px-3 py-2">{tr('유효 시간')}</th>
                  <th className="px-3 py-2 text-right">{tr('스캔')}</th>
                  <th className="px-3 py-2">{tr('상태')}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-grey-100">
                {shown.map((s) => {
                  const st = status(s);
                  return (
                    <tr key={s.id} className="align-middle">
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-ink">{s.name}</p>
                        <p className="font-mono text-[11px] text-grey-400">{s.code}</p>
                      </td>
                      <td className="px-3 py-2.5">{achLabel(s)}</td>
                      <td className="px-3 py-2.5 text-grey-600">{eventLabel(s)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-grey-600">{windowLabel(s)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{(scans[s.id] ?? 0).toLocaleString()}</td>
                      <td className="px-3 py-2.5">
                        <StatusPill text={st.text} tone={st.tone} />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-1">
                          <RowActions s={s} onQr={setQrOf} onEdit={setEditing} onToggle={toggle} onRemove={remove} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <FormDrawer open={creating} title={tr('현장 QR 만들기')} onClose={() => setCreating(false)}>
        {creating && (
          <StationForm
            achievements={achievements}
            events={events}
            onDone={async () => {
              setCreating(false);
              await load();
            }}
          />
        )}
      </FormDrawer>

      {/* 수정 — 코드(URL)는 그대로 두고 이름·업적·행사·유효 시간만 바꾼다. 이미 붙인 QR 이 계속 열려야 하므로. */}
      <FormDrawer open={!!editing} title={tr('현장 QR 수정')} onClose={() => setEditing(null)}>
        {editing && (
          <StationForm
            key={editing.id}
            achievements={achievements}
            events={events}
            initial={editing}
            onDone={async () => {
              setEditing(null);
              await load();
            }}
          />
        )}
      </FormDrawer>

      <FormDrawer open={!!qrOf} title={tr('QR 보기·인쇄')} onClose={() => setQrOf(null)}>
        {qrOf && (
          <QrSheet
            station={qrOf}
            achievementName={trI18n(achById.get(qrOf.achievement_id)?.name_i18n) || ''}
            eventName={qrOf.product_id ? trI18n(evById.get(qrOf.product_id)?.name_i18n) || '' : ''}
          />
        )}
      </FormDrawer>
    </div>
  );
}

/** 상태 알약 — 좁은 칸에서 '열림' 이 두 줄로 쪼개지지 않게 줄바꿈을 막는다. */
function StatusPill({ text, tone }: { text: string; tone: string }) {
  return (
    <span
      className={cn(
        'shrink-0 whitespace-nowrap rounded-pill px-2 py-0.5 text-[11px] font-medium',
        tone === 'on' && 'bg-success/10 text-success',
        tone === 'wait' && 'bg-amber-100 text-amber-800',
        tone === 'off' && 'bg-grey-100 text-grey-500',
      )}
    >
      {text}
    </span>
  );
}

/** 한 행의 버튼 묶음 — 카드와 표가 같은 버튼을 쓴다. */
function RowActions({
  s,
  onQr,
  onEdit,
  onToggle,
  onRemove,
}: {
  s: Station;
  onQr: (s: Station) => void;
  onEdit: (s: Station) => void;
  onToggle: (s: Station) => void;
  onRemove: (s: Station) => void;
}) {
  return (
    <>
      <IconBtn label={tr('QR 보기·인쇄')} onClick={() => onQr(s)}>
        <QrCode size={15} />
      </IconBtn>
      <IconBtn label={tr('수정')} onClick={() => onEdit(s)}>
        <Pencil size={15} />
      </IconBtn>
      <IconBtn label={s.is_active ? tr('끄기') : tr('켜기')} onClick={() => onToggle(s)}>
        <Power size={15} />
      </IconBtn>
      <IconBtn label={tr('삭제')} onClick={() => onRemove(s)} danger>
        <Trash2 size={15} />
      </IconBtn>
    </>
  );
}

function IconBtn({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'rounded-md p-1.5 text-grey-500 transition-colors hover:bg-grey-100',
        danger ? 'hover:text-danger' : 'hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

function StationForm({
  achievements,
  events,
  initial,
  onDone,
}: {
  achievements: AchievementOpt[];
  events: EventOpt[];
  /** 있으면 수정 모드 — 이 행을 고친다. 없으면 새로 만든다. */
  initial?: Station | null;
  onDone: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  // QR 조건이 걸린 업적을 위에 — 그게 이 화면의 주 용도다.
  const ordered = [...achievements.filter(needsQr), ...achievements.filter((a) => !needsQr(a))];
  const [achievementId, setAchievementId] = useState(initial?.achievement_id ?? ordered[0]?.id ?? '');
  const [productId, setProductId] = useState(initial?.product_id ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [from, setFrom] = useState(toLocalInput(initial?.valid_from ?? null));
  const [until, setUntil] = useState(toLocalInput(initial?.valid_until ?? null));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const selected = achievements.find((a) => a.id === achievementId);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  async function save() {
    if (!achievementId || !name.trim()) return setErr(tr('업적과 QR 이름을 입력해 주세요.'));
    if (from && until && new Date(from) >= new Date(until)) return setErr(tr('끝나는 시각이 시작보다 뒤여야 합니다.'));
    setBusy(true);
    setErr('');
    const values = {
      achievement_id: achievementId,
      product_id: productId || null,
      name: name.trim(),
      valid_from: fromLocalInput(from),
      valid_until: fromLocalInput(until),
    };
    const { error } = initial
      ? await supabase.from('achievement_stations').update(values).eq('id', initial.id)
      : await supabase.from('achievement_stations').insert(values);
    setBusy(false);
    if (error) return setErr(error.message);
    onDone();
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <label className="label-caps">{tr('업적')}</label>
        <select className="input" value={achievementId} onChange={(e) => setAchievementId(e.target.value)}>
          {ordered.map((a) => (
            <option key={a.id} value={a.id}>
              {needsQr(a) ? '[QR] ' : ''}
              {trI18n(a.name_i18n) || a.code}
              {a.is_active ? '' : ` (${tr('꺼짐')})`}
            </option>
          ))}
        </select>
        {selected && !needsQr(selected) && (
          <p className="text-xs text-amber-700">
            {tr("이 업적에는 '현장 QR 스캔' 조건이 없어 QR 을 찍어도 지급되지 않습니다. 업적 수정에서 조건을 먼저 켜 주세요.")}
          </p>
        )}
        {selected && needsQr(selected) && requiredCount(selected) > 1 && (
          <p className="text-xs text-grey-500">
            {tr('이 업적은 서로 다른 QR 을 {n}곳 찍어야 지급됩니다. QR 을 {n}개 이상 만드세요.').split('{n}').join(String(requiredCount(selected)))}
          </p>
        )}
        {selected && !selected.is_active && (
          <p className="text-xs text-amber-700">{tr('업적이 꺼져 있습니다. 행사 전에 업적을 켜야 참가자가 받을 수 있습니다.')}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="label-caps">{tr('QR 이름 (운영용)')}</label>
        <input className="input" value={name} placeholder={tr('예: Bohol 조식 뷔페 1일차')} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <label className="label-caps">{tr('행사 (선택)')}</label>
        <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">{tr('지정 안 함')}</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {trI18n(e.name_i18n) || e.id}
            </option>
          ))}
        </select>
        <p className="text-xs text-grey-500">{tr('스캔 화면에 행사 이름이 함께 나옵니다.')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="label-caps">{tr('시작 (선택)')}</label>
          <input type="datetime-local" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="label-caps">{tr('끝 (선택)')}</label>
          <input type="datetime-local" className="input" value={until} onChange={(e) => setUntil(e.target.value)} />
        </div>
      </div>
      <p className="-mt-2 text-xs text-grey-500">
        {tr('이 컴퓨터의 시간대 기준입니다')}: <b>{tz}</b>.{' '}
        {tr("'새벽 3시 이후', '소셜 시작 1시간' 같은 조건은 이 시간으로 정합니다. 사진으로 돌려 찍는 것을 막으려면 시간을 짧게 잡으세요.")}
      </p>

      {err && <p className="text-sm text-danger">{err}</p>}
      <button className="btn btn-primary w-full" onClick={save} disabled={busy}>
        {busy ? tr('저장 중…') : initial ? tr('저장') : tr('QR 만들기')}
      </button>
    </div>
  );
}

/** QR 크게 보기 + 인쇄용 PNG 내려받기 + 링크 복사. */
function QrSheet({
  station,
  achievementName,
  eventName,
}: {
  station: Station;
  achievementName: string;
  eventName: string;
}) {
  const [lang, setLang] = useState<'en' | 'ko'>('en');
  const [copied, setCopied] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  const url = `${WEB_BASE}/${lang}/qr/${station.code}`;

  async function copy() {
    await navigator.clipboard.writeText(url).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  /** 인쇄용 카드(1080×1350) — 업적 이름 · QR · 안내 문구. 현장에 그대로 붙일 수 있게. */
  async function download() {
    const svg = holder.current?.querySelector('svg');
    if (!svg) return;
    const qr = new Image();
    qr.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
    await qr.decode();

    const W = 1080;
    const H = 1350;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fffaeb';
    g.fillRect(0, 0, W, H);
    // 시그니처 선셋 띠
    const grad = g.createLinearGradient(0, 0, W, 0);
    const stops: [number, string][] = [[0, '#fa520f'], [0.28, '#ff8105'], [0.5, '#ffa110'], [0.78, '#ffd900'], [1, '#fff8e0']];
    stops.forEach(([o, col]) => grad.addColorStop(o, col));
    g.fillStyle = grad;
    g.fillRect(0, 0, W, 18);

    g.textAlign = 'center';
    g.fillStyle = '#fa520f';
    g.font = '600 30px Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
    g.fillText((eventName || '123Band').toUpperCase(), W / 2, 120);
    g.fillStyle = '#1f1f1f';
    g.font = '800 76px Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
    g.fillText(achievementName, W / 2, 220, W - 120);

    const size = 700;
    const x = (W - size) / 2;
    const y = 290;
    g.fillStyle = '#ffffff';
    g.fillRect(x - 30, y - 30, size + 60, size + 60);
    g.drawImage(qr, x, y, size, size);

    g.fillStyle = '#1f1f1f';
    g.font = '700 44px Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
    // 인쇄물 문구는 QR 이 여는 화면의 언어를 따른다 — 영어 QR 에 한글이 섞이지 않게.
    g.fillText(lang === 'en' ? 'Scan to earn a badge' : '스캔하고 뱃지 받기', W / 2, 1110, W - 100);
    g.fillStyle = '#6a6a6a';
    g.font = '400 28px Pretendard, sans-serif';
    g.fillText('123Band', W / 2, 1170);
    g.font = '400 22px ui-monospace, monospace';
    g.fillText(station.name, W / 2, 1290, W - 100);

    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = `band-qr-${station.code}.png`;
    a.click();
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-lg font-semibold">{station.name}</p>
        <p className="text-sm text-grey-500">
          {achievementName}
          {eventName ? ` · ${eventName}` : ''}
        </p>
      </div>

      <div className="flex gap-1">
        {(['en', 'ko'] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            className={cn(
              'rounded-pill px-3 py-1 text-xs font-semibold uppercase',
              lang === l ? 'bg-black text-white' : 'bg-grey-100 text-grey-500',
            )}
          >
            {l}
          </button>
        ))}
        <span className="ml-2 self-center text-xs text-grey-500">{tr('QR 이 여는 화면의 언어')}</span>
      </div>

      <div ref={holder} className="flex justify-center rounded-lg border border-grey-200 bg-white p-6">
        <QRCode value={url} size={240} level="M" />
      </div>

      <div className="flex items-center gap-2">
        <input readOnly value={url} className="input py-2 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        <button className="btn btn-secondary btn-sm shrink-0" onClick={copy}>
          <Copy size={14} /> {copied ? tr('복사됨') : tr('복사')}
        </button>
      </div>
      <button className="btn btn-primary w-full" onClick={download}>
        <Download size={14} /> {tr('인쇄용 PNG 내려받기')}
      </button>
      <p className="text-xs text-grey-500">
        {tr('휴대폰 카메라로 찍으면 바로 열립니다. 인쇄 전에 직접 한 번 찍어 확인하세요.')}
      </p>
    </div>
  );
}
