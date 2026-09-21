// 계정 차단/해제 버튼 (회원·오거나이저 공용) — 아이콘 + 호버 툴팁. userId = auth.users.id.
'use client';
import { useState } from 'react';
import { Ban, RotateCcw } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { useT } from '@/lib/locale/LocaleContext';

export function BanButtons({ userId }: { userId: string }) {
  const t = useT();
  const a = t.actions;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function call(ban: boolean) {
    if (ban && !window.confirm(a.confirmBan)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/users/ban', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId, ban }),
      });
      const d = await res.json().catch(() => ({}));
      setMsg(res.ok ? (ban ? a.banned : a.unbanned) : d.error || a.failed);
    } catch {
      setMsg(a.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <IconButton icon={Ban} label={a.ban} danger disabled={busy} onClick={() => call(true)} />
      <IconButton icon={RotateCcw} label={a.unban} disabled={busy} onClick={() => call(false)} />
      {msg && <span className="text-xs text-grey-500">{msg}</span>}
    </div>
  );
}
