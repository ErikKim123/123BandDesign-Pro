// 설정 — 전역 설정(app_settings) 관리. 첫 섹션: SNS › Instagram (계정 핸들 + 액세스 토큰).
// 토큰 본문은 브라우저로 내려오지 않는다. 저장·조회 모두 /api/settings/instagram 을 거치고,
// 서버가 60일 장기 토큰으로 교환해 보관하며 만료 전 자동 갱신한다(재발급 불필요).
'use client';
import { useEffect, useState } from 'react';
import { tr } from '@/i18n/tr';
import { Instagram, Check, Eye, EyeOff, Wallet, Mail } from 'lucide-react';
import { useT } from '@/lib/locale/LocaleContext';
import { cn } from '@/lib/utils';

// 서버가 내려주는 연동 상태 — 토큰 본문은 포함되지 않는다.
interface IgStatus {
  handle: string;
  hasToken: boolean;
  longLived: boolean;
  expiresAt: string | null;
  daysLeft: number | null;
}

const EXPIRING_SOON_DAYS = 7;

export default function SettingsPage() {
  const t = useT();
  const s = t.settings;

  const [handle, setHandle] = useState('');
  const [token, setToken] = useState(''); // 입력칸(비우면 기존 토큰 유지)
  const [showToken, setShowToken] = useState(false); // 토큰 보이기/숨기기
  const [status, setStatus] = useState<IgStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // 알림 › 운영자 메일 수신자 — 빈 칸 포함 고정 5칸을 그대로 들고 있다가 저장할 때 걸러낸다.
  const NOTIFY_SLOTS = 5;
  const [notifyEmails, setNotifyEmails] = useState<string[]>(Array(NOTIFY_SLOTS).fill(''));
  const [notifyLoading, setNotifyLoading] = useState(true);
  const [notifySaving, setNotifySaving] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // 결제 › Wise 송금 링크
  const [wiseUrl, setWiseUrl] = useState('');
  const [wiseEnabled, setWiseEnabled] = useState(true);
  const [wiseLoading, setWiseLoading] = useState(true);
  const [wiseSaving, setWiseSaving] = useState(false);
  const [wiseMsg, setWiseMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // 저장값 로드 — 실패하면 조용히 빈 화면을 보여주지 않고 사유를 노출한다.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings/instagram');
        const json = (await res.json()) as IgStatus & { error?: string };
        if (!res.ok) throw new Error(json.error || s.saveFailed);
        setStatus(json);
        setHandle(json.handle);
      } catch (err) {
        setMsg({ type: 'err', text: err instanceof Error ? tr(err.message) : s.saveFailed });
      } finally {
        setLoading(false);
      }
    })();
    // 최초 1회만 로드 — s 는 로케일 전환 시에도 재요청이 필요 없다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connected = Boolean(handle.trim() && status?.hasToken);

  // Wise 설정 로드
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings/wise');
        const json = (await res.json()) as { url?: string; enabled?: boolean; error?: string };
        if (!res.ok) throw new Error(json.error || s.saveFailed);
        setWiseUrl(json.url ?? '');
        setWiseEnabled(json.enabled !== false);
      } catch (err) {
        setWiseMsg({ type: 'err', text: err instanceof Error ? tr(err.message) : s.saveFailed });
      } finally {
        setWiseLoading(false);
      }
    })();
    // 최초 1회만 로드
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 수신자 로드 — 저장된 개수가 5보다 적으면 남은 칸은 빈 칸으로 채운다.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings/notify-emails');
        const json = (await res.json()) as { emails?: string[]; error?: string };
        if (!res.ok) throw new Error(json.error || s.saveFailed);
        const got = json.emails ?? [];
        setNotifyEmails(
          Array.from({ length: NOTIFY_SLOTS }, (_, i) => got[i] ?? ''),
        );
      } catch (err) {
        setNotifyMsg({ type: 'err', text: err instanceof Error ? tr(err.message) : s.saveFailed });
      } finally {
        setNotifyLoading(false);
      }
    })();
    // 최초 1회만 로드
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveNotify() {
    setNotifySaving(true);
    setNotifyMsg(null);
    try {
      const res = await fetch('/api/settings/notify-emails', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ emails: notifyEmails }),
      });
      const json = (await res.json()) as { emails?: string[]; error?: string };
      if (!res.ok) throw new Error(json.error || s.saveFailed);
      // 서버가 걸러낸 결과를 그대로 되비춘다 — 빈 칸·중복이 어떻게 정리됐는지 눈에 보이게.
      const got = json.emails ?? [];
      setNotifyEmails(Array.from({ length: NOTIFY_SLOTS }, (_, i) => got[i] ?? ''));
      setNotifyMsg({ type: 'ok', text: s.saved });
    } catch (err) {
      setNotifyMsg({ type: 'err', text: err instanceof Error ? tr(err.message) : s.saveFailed });
    } finally {
      setNotifySaving(false);
    }
  }

  async function saveWise() {
    setWiseSaving(true);
    setWiseMsg(null);
    try {
      const res = await fetch('/api/settings/wise', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: wiseUrl.trim(), enabled: wiseEnabled }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || s.saveFailed);
      setWiseMsg({ type: 'ok', text: s.saved });
    } catch (err) {
      setWiseMsg({ type: 'err', text: err instanceof Error ? tr(err.message) : s.saveFailed });
    } finally {
      setWiseSaving(false);
    }
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/settings/instagram', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // 토큰 입력이 비어 있으면 서버가 기존 토큰을 유지한다.
        body: JSON.stringify({ handle: handle.trim(), token: token.trim() }),
      });
      const json = (await res.json()) as IgStatus & { error?: string; warning?: string };
      if (!res.ok) throw new Error(json.error || s.saveFailed);
      setStatus(json);
      setToken('');
      setMsg(json.warning ? { type: 'err', text: json.warning } : { type: 'ok', text: s.saved });
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? tr(err.message) : s.saveFailed });
    } finally {
      setSaving(false);
    }
  }

  // 토큰 상태 안내 — 만료일/남은 기간, 자동 갱신 여부, 임박·만료 경고.
  function tokenNote() {
    if (!status?.hasToken) return null;
    const { daysLeft, expiresAt, longLived } = status;

    if (daysLeft === null || !expiresAt) {
      return <p className="mt-2 text-xs text-amber-600">{longLived ? s.tokenSaved : s.tokenNoExpiry}</p>;
    }
    if (daysLeft <= 0) return <p className="mt-2 text-xs text-red-600">{s.tokenExpired}</p>;

    const date = new Date(expiresAt).toLocaleDateString();
    return (
      <>
        <p className="mt-2 text-xs text-grey-500">{s.tokenValidUntil(date, daysLeft)}</p>
        <p className="mt-1 text-xs text-grey-400">
          {daysLeft <= EXPIRING_SOON_DAYS ? s.tokenExpiringSoon : s.tokenAutoRenew}
        </p>
        <p className="mt-1 text-xs text-grey-400">{s.tokenSaved}</p>
      </>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl uppercase tracking-tight">{s.title}</h1>
        <p className="mt-1 text-sm text-grey-500">{s.intro}</p>
      </div>

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

      {/* ── SNS ── */}
      <section className="space-y-3">
        <h2 className="label-caps text-grey-500">{s.snsTitle}</h2>

        {/* Instagram */}
        <div className="rounded-2xl border border-grey-200 p-5">
          <div className="mb-1 flex items-center gap-2">
            <Instagram size={18} className="text-grey-700" />
            <h3 className="font-semibold text-grey-900">{s.instagram}</h3>
            {connected && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-pill bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                <Check size={12} /> {s.connected}
              </span>
            )}
          </div>
          <p className="mb-4 text-xs text-grey-500">{s.instagramDesc}</p>

          {loading ? (
            <p className="py-6 text-center text-sm text-grey-400">{s.loading}</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-grey-600">{s.igHandle}</span>
                  <input
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder={s.igHandlePh}
                    className="input w-full"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-grey-600">{s.igToken}</span>
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder={s.igTokenPh}
                      autoComplete="off"
                      className="input w-full pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken((v) => !v)}
                      aria-label={showToken ? s.hideToken : s.showToken}
                      title={showToken ? s.hideToken : s.showToken}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-grey-400 hover:text-grey-700"
                    >
                      {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>
              </div>
              {tokenNote()}

              <button
                onClick={save}
                disabled={saving}
                className="mt-4 rounded-pill bg-black px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {saving ? s.saving : s.save}
              </button>
            </>
          )}
        </div>
      </section>

      {/* ── 결제 › Wise 송금 링크 ── */}
      <section className="space-y-3">
        <h2 className="label-caps text-grey-500">{s.paymentsTitle}</h2>

        <div className="rounded-2xl border border-grey-200 p-5">
          <div className="mb-1 flex items-center gap-2">
            <Wallet size={18} className="text-grey-700" />
            <h3 className="font-semibold text-grey-900">{s.wise}</h3>
            {!wiseLoading && wiseEnabled && wiseUrl.trim() && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-pill bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                <Check size={12} /> {s.connected}
              </span>
            )}
          </div>
          <p className="mb-4 text-xs text-grey-500">{s.wiseDesc}</p>

          {wiseMsg && (
            <div
              className={cn(
                'mb-3 rounded-lg px-4 py-2.5 text-sm',
                wiseMsg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
              )}
            >
              {wiseMsg.text}
            </div>
          )}

          {wiseLoading ? (
            <p className="py-6 text-center text-sm text-grey-400">{s.loading}</p>
          ) : (
            <>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-grey-600">{s.wiseUrl}</span>
                <input
                  type="url"
                  inputMode="url"
                  value={wiseUrl}
                  onChange={(e) => setWiseUrl(e.target.value)}
                  placeholder={s.wiseUrlPh}
                  autoComplete="off"
                  className="input w-full"
                />
              </label>

              <label className="mt-3 flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={wiseEnabled}
                  onChange={(e) => setWiseEnabled(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-black"
                />
                <span>
                  <span className="block text-sm font-medium text-grey-700">{s.wiseEnabled}</span>
                  <span className="block text-xs text-grey-500">{s.wiseEnabledHint}</span>
                </span>
              </label>

              <button
                onClick={saveWise}
                disabled={wiseSaving}
                className="mt-4 rounded-pill bg-black px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {wiseSaving ? s.saving : s.save}
              </button>
            </>
          )}
        </div>
      </section>

      {/* ── 알림 › 운영자 메일 수신자 ── */}
      <section className="space-y-3">
        <h2 className="label-caps text-grey-500">{s.notifyTitle}</h2>

        <div className="rounded-2xl border border-grey-200 p-5">
          <div className="mb-1 flex items-center gap-2">
            <Mail size={18} className="text-grey-700" />
            <h3 className="font-semibold text-grey-900">{s.notifyEmails}</h3>
          </div>
          <p className="mb-4 text-xs text-grey-500">{s.notifyEmailsDesc}</p>

          {notifyMsg && (
            <div
              className={cn(
                'mb-3 rounded-lg px-4 py-2.5 text-sm',
                notifyMsg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
              )}
            >
              {notifyMsg.text}
            </div>
          )}

          {notifyLoading ? (
            <p className="py-6 text-center text-sm text-grey-400">{s.loading}</p>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                {notifyEmails.map((v, i) => (
                  <input
                    key={i}
                    type="email"
                    inputMode="email"
                    value={v}
                    onChange={(e) =>
                      setNotifyEmails((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))
                    }
                    placeholder={s.notifyEmailPh(i + 1)}
                    autoComplete="off"
                    className="input w-full"
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-grey-500">{s.notifyEmailsEmpty}</p>

              <button
                onClick={saveNotify}
                disabled={notifySaving}
                className="mt-4 rounded-pill bg-black px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {notifySaving ? s.saving : s.save}
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
