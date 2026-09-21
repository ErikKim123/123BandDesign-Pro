// 회원 로그인 상태 표시 — 목록용 점 아이콘(LoginStatusDot) + 수정 드로어용 상세(LoginStatusInfo).
// 데이터: GET /api/users/login-status (auth.users + 활성 auth.sessions 집계, 30초 폴링).
// 판별: 로그아웃 없이 브라우저만 닫아도 세션 행이 남으므로, 마지막 토큰 갱신(last_active_at)이
// 갱신 주기(1시간) 이내일 때만 tr('로그인 중')으로 본다. 세션은 있으나 오래 무활동이면 '세션 유지 중'.
'use client';
import { useQuery } from '@tanstack/react-query';
import { tr } from '@/i18n/tr';

interface LoginStatusRow {
  id: string;
  last_sign_in_at: string | null;
  last_active_at: string | null;
  active_sessions: number;
}

// Supabase 액세스 토큰 갱신 주기(1h) — 이 이내 활동이면 클라이언트가 열려 있다고 판단
const ONLINE_WINDOW_MS = 60 * 60 * 1000;

function useLoginStatus() {
  return useQuery({
    queryKey: ['login-status'],
    queryFn: async (): Promise<Map<string, LoginStatusRow>> => {
      const r = await fetch('/api/users/login-status');
      const j = (await r.json().catch(() => ({}))) as { users?: LoginStatusRow[]; error?: string };
      if (!r.ok) throw new Error(j.error || tr('로그인 상태 조회 실패'));
      return new Map((j.users ?? []).map((u) => [u.id, u]));
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

type Status = 'online' | 'idle' | 'offline';

function statusOf(row: LoginStatusRow | undefined): Status {
  if (!row || row.active_sessions === 0 || !row.last_active_at) return 'offline';
  const age = Date.now() - new Date(row.last_active_at).getTime();
  return age <= ONLINE_WINDOW_MS ? 'online' : 'idle';
}

function fmtDateTime(v: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v.slice(0, 19).replace('T', ' ');
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// "n분 전" 상대 시각 — 목록 툴팁/드로어 보조 표기용
function fmtAgo(v: string | null): string {
  if (!v) return '';
  const ms = Date.now() - new Date(v).getTime();
  if (Number.isNaN(ms) || ms < 0) return '';
  const min = Math.floor(ms / 60_000);
  if (min < 1) return tr('방금 전');
  if (min < 60) return `${min}${tr('분 전')}`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}${tr('시간 전')}`;
  return `${Math.floor(h / 24)}${tr('일 전')}`;
}

const DOT: Record<Status, { cls: string; label: string }> = {
  online: { cls: 'bg-success', label: tr('로그인 중') },
  idle: { cls: 'bg-live', label: tr('세션 유지 중 (무활동)') },
  offline: { cls: 'bg-grey-300', label: tr('로그아웃') },
};

function tooltip(status: Status, row: LoginStatusRow | undefined): string {
  const parts = [DOT[status].label];
  if (status === 'online' || status === 'idle') {
    const ago = fmtAgo(row?.last_active_at ?? null);
    if (ago) parts.push(`${tr('마지막 활동')} ${ago}`);
  } else if (row?.last_sign_in_at) {
    parts.push(`${tr('최근 로그인')} ${fmtDateTime(row.last_sign_in_at)}`);
  } else {
    return tr('로그인 기록 없음');
  }
  return parts.join(' · ');
}

/** 목록 셀용 상태 점 아이콘 — 호버 시 상세 툴팁 */
export function LoginStatusDot({ userId }: { userId: string }) {
  const { data, isLoading } = useLoginStatus();
  if (isLoading) {
    return <span className="inline-block h-2.5 w-2.5 rounded-full bg-grey-200" title="확인 중…" />;
  }
  const row = data?.get(userId);
  const status = statusOf(row);
  return (
    <span className="inline-flex items-center" title={tooltip(status, row)}>
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${DOT[status].cls}`} />
    </span>
  );
}

/** 수정 드로어용 최근 로그인 정보 블록 */
export function LoginStatusInfo({ userId }: { userId: string }) {
  const { data, isLoading } = useLoginStatus();
  const row = data?.get(userId);
  const status = statusOf(row);
  return (
    <div className="space-y-1.5">
      <label className="label-caps">{tr('최근 로그인')}</label>
      {isLoading ? (
        <p className="text-sm text-grey-400">{tr('확인 중…')}</p>
      ) : (
        <div className="space-y-1 text-sm text-grey-600">
          <p className="flex items-center gap-2">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${DOT[status].cls}`} />
            {DOT[status].label}
            {(status === 'online' || status === 'idle') && row?.last_active_at && (
              <span className="text-grey-400">마지막 활동 {fmtAgo(row.last_active_at)}</span>
            )}
          </p>
          <p>
            최근 로그인: {row?.last_sign_in_at ? fmtDateTime(row.last_sign_in_at) : '기록 없음'}
          </p>
        </div>
      )}
    </div>
  );
}
