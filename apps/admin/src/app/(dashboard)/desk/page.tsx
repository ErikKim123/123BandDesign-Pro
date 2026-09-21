// Design Ref: 현장 데스크 — 행사장 부스에서 고객 QR 을 찍어 그 자리에서 처리하는 화면.
//
// 고객이 보여 주는 것은 세 가지다: 마이페이지의 내 QR(/{locale}/u/{회원코드}), 패스 QR(?pass=<시크릿>),
// 주문번호(ORD…). 무엇이든 찍으면 '회원' 하나로 모은 뒤, 그 회원에 대해 ① 입장(패스 소각) ② 업적 지급
// ③ 포인트 충전/차감을 한 화면에서 한다. 오거나이저 입장확인(apps/partner checkin)이 '내가 판 패스'만
// 다루는 것과 달리, 운영진은 판매자를 가리지 않는다(0106 admin_checkin_pass).
'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Activity, Award, Camera, CheckCircle2, Coins, QrCode, ScanLine, Ticket, XCircle,
} from 'lucide-react';
import { pickI18n, type I18n } from '@123band/shared';
import { tr, trLocale } from '@/i18n/tr';
import { createClient } from '@/lib/supabase/client';
import { CharacterAvatar } from '@/components/member/CharacterAvatar';
import { ManualGrantPanel } from '@/components/achievement/ManualGrant';
import { QrScanner } from '@/components/desk/QrScanner';
import { cn } from '@/lib/utils';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// gen_social_code() 알파벳(혼동문자 0/1/I/O 제외) 8자리 — web HeartScanner 와 같은 규칙
const CODE_RE = /^[2-9A-HJ-NP-Z]{8}$/;

type Scan =
  | { mode: 'pass'; secret: string }
  | { mode: 'member'; code: string }
  | { mode: 'order'; token: string }
  | { mode: 'email'; email: string };

/** QR 원문/입력값 → 무엇을 찍었는지. 패스 → 회원 코드 → 주문 순으로 본다. */
function extractScan(raw: string): Scan {
  const t = raw.trim();
  const pass = t.match(/[?&]pass=([^&#]+)/);
  if (pass?.[1]) return { mode: 'pass', secret: decodeURIComponent(pass[1]) };
  if (UUID_RE.test(t)) return { mode: 'pass', secret: t };
  if (CODE_RE.test(t.toUpperCase())) return { mode: 'member', code: t.toUpperCase() };
  const u = t.match(/\/u\/([^/?#]+)/);
  if (u?.[1] && CODE_RE.test(u[1].toUpperCase())) return { mode: 'member', code: u[1].toUpperCase() };
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t)) return { mode: 'email', email: t.toLowerCase() };
  const o = t.match(/[?&]order=([^&#]+)/);
  if (o?.[1]) return { mode: 'order', token: decodeURIComponent(o[1]) };
  const p = t.match(/\/checkin\/([^/?#]+)/);
  if (p?.[1]) return { mode: 'order', token: decodeURIComponent(p[1]) };
  return { mode: 'order', token: t };
}

interface Member {
  id: string;
  email: string | null;
  name: string | null;
  social_code: string | null;
  point_balance: number | null;
  avatar_url: string | null;
  avatar_seed: string | null;
  avatar_traits: unknown;
}
const MEMBER_COLS = 'id, email, name, social_code, point_balance, avatar_url, avatar_seed, avatar_traits';

interface Pass {
  id: string;
  redemption_secret: string;
  status: 'valid' | 'used' | 'revoked';
  used_at: string | null;
  product_id: string | null;
  orders: { order_no: string } | null;
  products: { name_i18n: I18n } | null;
}

type Flash = { tone: 'ok' | 'warn' | 'err'; text: string };

export default function DeskPage() {
  const supabase = useMemo(() => createClient(), []);
  const [scanning, setScanning] = useState(false);
  const [camError, setCamError] = useState(false);
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [passes, setPasses] = useState<Pass[]>([]);
  const [badgeCount, setBadgeCount] = useState(0);
  const [recent, setRecent] = useState<{ at: string; text: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const log = useCallback((text: string) => {
    setRecent((r) => [{ at: new Date().toLocaleTimeString(), text }, ...r].slice(0, 8));
  }, []);

  /** 회원 한 명의 패스·뱃지 수·포인트를 다시 읽는다 — 처리 뒤마다 부른다. */
  const refresh = useCallback(
    async (id: string) => {
      const [{ data: m }, { data: ps }, { count }] = await Promise.all([
        supabase.from('profiles').select(MEMBER_COLS).eq('id', id).maybeSingle(),
        supabase
          .from('passes')
          .select('id, redemption_secret, status, used_at, product_id, orders(order_no), products(name_i18n)')
          .eq('owner_id', id)
          .order('created_at', { ascending: false }),
        supabase.from('user_achievements').select('id', { count: 'exact', head: true }).eq('user_id', id),
      ]);
      if (m) setMember(m as unknown as Member);
      setPasses((ps ?? []) as unknown as Pass[]);
      setBadgeCount(count ?? 0);
    },
    [supabase],
  );

  const showMember = useCallback(
    async (id: string) => {
      await refresh(id);
    },
    [refresh],
  );

  /** 찍은 값 하나를 처리한다 — 패스는 바로 소각까지, 나머지는 회원을 찾아 띄운다. */
  const process = useCallback(
    async (raw: string) => {
      if (busy) return;
      setBusy(true);
      setFlash(null);
      try {
        const scan = extractScan(raw);
        if (scan.mode === 'pass') {
          const { data, error } = await supabase.rpc('admin_checkin_pass', { p_secret: scan.secret });
          if (error) {
            const msg = error.message || '';
            setFlash({
              tone: 'err',
              text: msg.includes('pass_not_found') ? tr('이 QR 은 유효하지 않습니다(회전됨/위조).') : msg,
            });
            return;
          }
          const row = (Array.isArray(data) ? data[0] : data) as {
            order_no: string; product_name: I18n; owner_id: string; owner_name: string; already: boolean;
          } | null;
          if (!row) return;
          const name = pickI18n(row.product_name, trLocale()) || row.order_no;
          setFlash(
            row.already
              ? { tone: 'warn', text: `${tr('이미 사용된 패스입니다')} — ${name} · ${row.owner_name}` }
              : { tone: 'ok', text: `${tr('패스 입장 처리했습니다')} — ${name} · ${row.owner_name}` },
          );
          log(`${row.already ? '⚠' : '✓'} ${tr('입장')} · ${row.owner_name} · ${name}`);
          await showMember(row.owner_id);
          return;
        }

        let q = supabase.from('profiles').select(MEMBER_COLS);
        if (scan.mode === 'member') q = q.eq('social_code', scan.code);
        else if (scan.mode === 'email') q = q.eq('email', scan.email);
        else {
          // 주문번호/주문 id → 구매자
          const byId = UUID_RE.test(scan.token);
          const { data: o } = await supabase
            .from('orders')
            .select('buyer_id, order_no')
            .eq(byId ? 'id' : 'order_no', scan.token)
            .maybeSingle();
          if (!o?.buyer_id) {
            setFlash({ tone: 'err', text: tr('찾을 수 없습니다. 회원 코드(8자) · 주문번호(ORD…) · 패스 QR 값 · 이메일을 확인해 주세요.') });
            return;
          }
          q = q.eq('id', o.buyer_id as string);
        }
        const { data: m } = await q.maybeSingle();
        if (!m) {
          setFlash({ tone: 'err', text: tr('찾을 수 없습니다. 회원 코드(8자) · 주문번호(ORD…) · 패스 QR 값 · 이메일을 확인해 주세요.') });
          return;
        }
        const mm = m as unknown as Member;
        log(`👤 ${mm.name || mm.email}`);
        await showMember(mm.id);
      } finally {
        setBusy(false);
      }
    },
    [busy, supabase, showMember, log],
  );

  const onDecode = useCallback(
    (text: string) => {
      setScanning(false);
      void process(text);
    },
    [process],
  );

  // 스캔 뒤 입력칸에 초점 — 다음 고객은 바로 입력할 수 있게
  useEffect(() => {
    if (!scanning && !busy) inputRef.current?.focus();
  }, [scanning, busy]);

  async function checkinPass(p: Pass) {
    if (busy || !member) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('admin_checkin_pass', { p_secret: p.redemption_secret });
      const row = (Array.isArray(data) ? data[0] : data) as { already: boolean; product_name: I18n } | null;
      if (error) setFlash({ tone: 'err', text: error.message });
      else if (row?.already) setFlash({ tone: 'warn', text: tr('이미 사용된 패스입니다') });
      else {
        setFlash({ tone: 'ok', text: tr('패스 입장 처리했습니다') });
        log(`✓ ${tr('입장')} · ${member.name || member.email} · ${pickI18n(row?.product_name, trLocale())}`);
      }
      await refresh(member.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl uppercase tracking-tight">
          <ScanLine size={22} /> {tr('현장 데스크')}
        </h1>
        <p className="mt-1 text-sm text-grey-600">
          {tr('고객이 보여 주는 QR(마이페이지 QR · 패스 QR)이나 주문번호를 찍으면 그 회원의 입장 처리 · 업적 지급 · 포인트 충전/차감을 한 화면에서 합니다.')}
        </p>
      </div>

      {/* 폰에서는 grid-cols-1 을 꼭 준다 — 열을 안 정하면 열 폭이 내용 최대폭(max-content)이 되어 화면을 넘친다. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[22rem_1fr]">
        {/* ── 왼쪽: 스캔 · 입력 · 최근 처리 ── */}
        <div className="min-w-0 space-y-4">
          {scanning ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-grey-200 p-3">
              <QrScanner
                onDecode={onDecode}
                onError={() => {
                  setCamError(true);
                  setScanning(false);
                }}
              />
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setScanning(false)}>
                {tr('스캔 중지')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-primary w-full"
              onClick={() => {
                setCamError(false);
                setScanning(true);
              }}
            >
              <Camera size={18} /> {tr('카메라로 QR 찍기')}
            </button>
          )}
          {camError && (
            <p className="text-xs text-danger">{tr('카메라를 열 수 없습니다. 브라우저의 카메라 권한을 확인해 주세요.')}</p>
          )}

          <div className="flex gap-2">
            <input
              ref={inputRef}
              className="input"
              placeholder={tr('회원 코드 · 주문번호 · 패스 QR 값 · 이메일')}
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && manual.trim()) {
                  void process(manual.trim());
                  setManual('');
                }
              }}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm shrink-0"
              disabled={busy || !manual.trim()}
              onClick={() => {
                void process(manual.trim());
                setManual('');
              }}
            >
              {tr('조회')}
            </button>
          </div>

          {flash && (
            <p
              className={cn(
                'flex items-start gap-2 rounded-md px-3 py-2 text-sm',
                flash.tone === 'ok' && 'bg-success/10 text-success',
                flash.tone === 'warn' && 'bg-amber-100 text-amber-800',
                flash.tone === 'err' && 'bg-danger/10 text-danger',
              )}
            >
              {flash.tone === 'err' ? <XCircle size={16} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={16} className="mt-0.5 shrink-0" />}
              <span>{flash.text}</span>
            </p>
          )}

          {recent.length > 0 && (
            <div className="rounded-lg border border-grey-200 p-3">
              <p className="label-caps mb-1.5">{tr('최근 처리')}</p>
              <ul className="space-y-1 text-xs text-grey-600">
                {recent.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="shrink-0 font-mono text-grey-400">{r.at}</span>
                    <span className="min-w-0 truncate">{r.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* ── 오른쪽: 회원 처리판 ── */}
        {!member ? (
          <div className="flex min-h-[16rem] items-center justify-center rounded-lg border border-dashed border-grey-300 p-6 text-center text-sm text-grey-500">
            <span className="flex flex-col items-center gap-2">
              <QrCode size={28} className="text-grey-300" />
              {tr('QR 을 찍거나 값을 입력하면 회원 정보가 여기에 나옵니다.')}
            </span>
          </div>
        ) : (
          <div className="min-w-0 space-y-5">
            {/* 회원 카드 */}
            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-grey-200 p-4">
              <CharacterAvatar
                seed={member.avatar_seed}
                traits={member.avatar_traits}
                photoUrl={member.avatar_url}
                size={64}
                className="shrink-0 rounded-full"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-medium">{member.name || member.email}</p>
                <p className="truncate text-sm text-grey-500">{member.email}</p>
                <p className="mt-0.5 font-mono text-xs text-grey-400">{member.social_code ?? '—'}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <span className="rounded-pill bg-grey-100 px-3 py-1 text-sm">
                  <Coins size={13} className="mr-1 inline" />
                  {Number(member.point_balance ?? 0).toLocaleString()} P
                </span>
                <span className="rounded-pill bg-grey-100 px-3 py-1 text-sm">
                  <Award size={13} className="mr-1 inline" />
                  {badgeCount}
                </span>
              </div>
              <div className="flex w-full items-center gap-3 border-t border-grey-100 pt-3 text-xs">
                <Link href={`/member-activity?member=${member.id}`} className="inline-flex items-center gap-1 text-grey-500 underline hover:text-black">
                  <Activity size={12} /> {tr('회원활동 보기')}
                </Link>
                <button
                  type="button"
                  className="ml-auto text-grey-500 underline hover:text-black"
                  onClick={() => {
                    setMember(null);
                    setPasses([]);
                    setFlash(null);
                  }}
                >
                  {tr('다른 회원')}
                </button>
              </div>
            </div>

            {/* ① 입장 */}
            <section className="rounded-lg border border-grey-200 p-4">
              <h2 className="mb-2 flex items-center gap-2 text-base uppercase tracking-tight">
                <Ticket size={16} /> {tr('입장 (패스)')}
              </h2>
              {passes.length === 0 ? (
                <p className="text-sm text-grey-500">{tr('이 회원 명의의 패스가 없습니다.')}</p>
              ) : (
                <ul className="divide-y divide-grey-100">
                  {passes.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {pickI18n(p.products?.name_i18n, trLocale()) || '—'}
                        </span>
                        <span className="block font-mono text-[11px] text-grey-400">{p.orders?.order_no ?? '—'}</span>
                      </span>
                      {p.status === 'valid' ? (
                        <button type="button" className="btn btn-primary btn-sm shrink-0" disabled={busy} onClick={() => void checkinPass(p)}>
                          <CheckCircle2 size={14} /> {tr('입장 처리')}
                        </button>
                      ) : (
                        <span
                          className={cn(
                            'shrink-0 rounded-pill px-2.5 py-0.5 text-xs font-medium',
                            p.status === 'used' ? 'bg-success/10 text-success' : 'bg-grey-100 text-grey-500',
                          )}
                        >
                          {p.status === 'used' ? `${tr('입장 완료')} ${p.used_at ? p.used_at.slice(5, 16).replace('T', ' ') : ''}` : tr('무효')}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* ② 포인트 */}
            <PointsQuick member={member} onDone={() => void refresh(member.id)} onLog={log} />

            {/* ③ 업적 */}
            <section className="rounded-lg border border-grey-200 p-4">
              <h2 className="mb-2 flex items-center gap-2 text-base uppercase tracking-tight">
                <Award size={16} /> {tr('업적 지급')}
              </h2>
              {/* 회원이 바뀌면 패널을 새로 만든다 — key 로 내부 상태(보유 목록)를 초기화 */}
              <ManualGrantPanel key={member.id} initialMemberId={member.id} hideSearch />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

/** 현장에서 자주 쓰는 메모 — 줄 선 고객 앞에서 타이핑할 틈이 없어 한 번 눌러 고른다. 직접 입력은 그대로 남긴다. */
const MEMO_PRESETS: Record<'deduct' | 'grant', string[]> = {
  deduct: ['생수 교환', '음료 교환', '굿즈 교환', '워크숍 참가', '현장 할인', '입장료'],
  grant: ['이벤트 참여', '부스 미션', '현장 보상', '오류 정정', '사과 보상'],
};

/** 포인트 충전/차감 — 포인트관리의 PointAdjustForm 과 같은 RPC(admin_adjust_points). 현장용으로 한 줄. */
function PointsQuick({
  member,
  onDone,
  onLog,
}: {
  member: Member;
  onDone: () => void;
  onLog: (text: string) => void;
}) {
  const [mode, setMode] = useState<'grant' | 'deduct'>('deduct');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const n = Number(amount);
  const valid = Number.isInteger(n) && n > 0;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setMsg(null);
    const { error } = await createClient().rpc('admin_adjust_points', {
      p_user_id: member.id,
      p_delta: mode === 'grant' ? n : -n,
      p_memo: memo.trim() || null,
    });
    setBusy(false);
    if (error) {
      const m = error.message || '';
      setMsg({
        tone: 'err',
        text: m.includes('insufficient_points') ? tr('보유 포인트보다 많이 차감할 수 없습니다.') : m,
      });
      return;
    }
    const sign = mode === 'grant' ? '+' : '−';
    setMsg({ tone: 'ok', text: `${tr('포인트를 반영했습니다')} (${sign}${n.toLocaleString()} P)` });
    onLog(`${sign}${n.toLocaleString()} P · ${member.name || member.email}${memo.trim() ? ` · ${memo.trim()}` : ''}`);
    setAmount('');
    setMemo('');
    onDone();
  }

  return (
    <section className="rounded-lg border border-grey-200 p-4">
      <h2 className="mb-2 flex items-center gap-2 text-base uppercase tracking-tight">
        <Coins size={16} /> {tr('포인트 충전 / 차감')}
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {(['deduct', 'grant'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn('btn btn-sm', mode === m ? 'btn-primary' : 'btn-secondary')}
            >
              {m === 'grant' ? tr('충전 (+)') : tr('차감 (−)')}
            </button>
          ))}
        </div>
        <input
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          className="input w-32"
          placeholder={tr('금액')}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
        />
      </div>
      {/* 메모 — 칩을 누르면 채워지고, 같은 칩을 다시 누르면 비운다. 칩에 없는 사유만 직접 적는다. */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {MEMO_PRESETS[mode].map((p) => {
          const on = memo === tr(p);
          return (
            <button
              key={p}
              type="button"
              onClick={() => setMemo(on ? '' : tr(p))}
              className={cn(
                'rounded-pill border px-2.5 py-1 text-xs font-medium transition-colors',
                on ? 'border-black bg-black text-white' : 'border-grey-200 bg-white text-grey-600 hover:border-grey-400',
              )}
            >
              {tr(p)}
            </button>
          );
        })}
      </div>
      <input
        className="input mt-2 w-full"
        placeholder={tr('메모 직접 입력 (선택)')}
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && void submit()}
      />
      {/* 적용은 맨 아래 — 폰에서 금액 옆에 두면 줄이 꺾여 어중간한 자리에 걸린다. */}
      <button
        type="button"
        className="btn btn-primary mt-2 w-full sm:w-auto"
        disabled={!valid || busy}
        onClick={() => void submit()}
      >
        {tr('적용')}
      </button>
      {msg && (
        <p className={cn('mt-2 text-sm', msg.tone === 'ok' ? 'text-success' : 'text-danger')}>{msg.text}</p>
      )}
    </section>
  );
}
