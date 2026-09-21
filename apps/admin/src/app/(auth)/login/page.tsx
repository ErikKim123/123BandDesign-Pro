// Design Ref: §5.4 로그인 — Supabase Auth 이메일/비밀번호
'use client';
import { isBand123Member } from '@123band/shared/supabase/schema';
import { Suspense, useState } from 'react';
import { tr } from '@/i18n/tr';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ExternalLink } from 'lucide-react';

// 운영자가 자주 오가는 다른 앱들 — 로그인 화면 옆에 바로가기로 둔다(Vercel 프로젝트 기준).
const SHORTCUTS: { name: string; desc: string; href: string }[] = [
  { name: '123Band', desc: '고객 사이트', href: 'https://123band-web.vercel.app' },
  { name: '123Band Organizer', desc: '오거나이저(파트너) 포털', href: 'https://123band-partner.vercel.app' },
  { name: 'J&J Dash', desc: 'J&J 진행 대시보드', href: 'https://jnj-dash-db.vercel.app' },
  { name: 'BATTLE Dash', desc: '배틀 진행 대시보드', href: 'https://battle-dash-db.vercel.app' },
  { name: 'DIV Dash', desc: '디비전 대시보드', href: 'https://div-dash-db.vercel.app' },
];

// useSearchParams 는 Suspense 경계 필요 (Next.js CSR bailout)
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(
    params.get('error') === 'forbidden'
      ? tr('관리자 권한이 없는 계정입니다.')
      : params.get('error') === 'not_member'
        ? tr('123Band 회원 계정이 아닙니다.')
        : null,
  );
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    console.info('[auth] 로그인 시도', { email });
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      // 실제 원인(자격증명/미확인/네트워크 등)을 콘솔에 그대로 남긴다.
      console.error('[auth] 로그인 실패', {
        email,
        name: error.name,
        status: (error as { status?: number }).status,
        code: (error as { code?: string }).code,
        message: error.message,
      });
      setError(tr('로그인 실패: 이메일/비밀번호를 확인하세요.'));
      return;
    }
    // 로그인 계정은 울프·JNJ 와 공유한다 — 123Band 회원이 아니면 이 기기 세션만 끊고 차단
    // (scope: 'local' — 기본값 global 은 울프 쪽 세션까지 전부 끊는다)
    if (!isBand123Member(data.user)) {
      await supabase.auth.signOut({ scope: 'local' });
      setError(tr('123Band 회원 계정이 아닙니다.'));
      return;
    }
    console.info('[auth] 로그인 성공 → /dashboard 이동', { email, userId: data.user?.id });
    // 하드 내비게이션: 서버 컴포넌트가 새 세션 쿠키로 즉시 재렌더되도록 보장
    // (소프트 내비는 로그인 전 RSC 캐시가 남아 새로고침 전까지 이전 화면이 보임)
    window.location.replace('/dashboard');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-grey-50 px-4 py-8 md:flex-row md:items-start md:gap-10 md:pt-[28vh]">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-5 rounded-lg border border-grey-200 bg-white p-8"
      >
        <h1 className="font-display text-2xl uppercase tracking-tight">123Band Admin</h1>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="space-y-1.5">
          <label className="label-caps">{tr('이메일')}</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </div>
        <div className="space-y-1.5">
          <label className="label-caps">{tr('비밀번호')}</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </div>
        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? tr('로그인 중…') : tr('로그인')}
        </button>
      </form>

      {/* 바로가기 — 로그인 전에도 다른 앱으로 넘어갈 수 있게. 새 탭으로 연다. */}
      <nav aria-label={tr('바로가기')} className="w-full max-w-sm rounded-lg border border-grey-200 bg-white p-5 md:w-64">
        <p className="label-caps mb-3">{tr('바로가기')}</p>
        <ul className="space-y-1.5">
          {SHORTCUTS.map((s) => (
            <li key={s.href}>
              <a
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-grey-100"
              >
                <span className="min-w-0">
                  <span className="block font-medium">{s.name}</span>
                  <span className="block truncate text-xs text-grey-500">{tr(s.desc)}</span>
                </span>
                <ExternalLink size={14} className="shrink-0 text-grey-400" />
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
