// 새 비밀번호 설정 — 메일 링크(?token=…)로 들어온 사람만.
//   1) 토큰을 확인해 임시 세션을 만든다(verifyOtp type:'recovery')
//   2) 새 비밀번호를 저장하고 로그아웃 → 로그인 화면으로 (새 비밀번호로 다시 들어오게)
// 웹은 고객 전용이므로 운영자·오거나이저 계정이면 막는다(로그인 규칙과 동일).
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { Locale } from '@123band/shared';
import { createClient } from '@/lib/supabase/client';
import type { Dictionary } from '@/i18n/dictionaries';

type Stage = 'checking' | 'ready' | 'invalid' | 'done';

export function ResetPasswordForm({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [stage, setStage] = useState<Stage>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 링크 확인 — 만료·이미 쓴 토큰이면 여기서 걸린다.
  useEffect(() => {
    if (!token) {
      setStage('invalid');
      return;
    }
    let alive = true;
    void (async () => {
      const supabase = createClient();
      const { data, error: err } = await supabase.auth.verifyOtp({
        type: 'recovery',
        token_hash: token,
      });
      if (!alive) return;
      if (err || !data.user) {
        setStage('invalid');
        return;
      }
      // 고객 계정만 — 그 외는 임시 세션을 끊고 안내한다.
      const { data: prof } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle();
      if (prof && prof.role !== 'customer') {
        await supabase.auth.signOut({ scope: 'local' });
        setError(dict.auth.forbiddenRole);
        setStage('invalid');
        return;
      }
      setStage('ready');
    })();
    return () => {
      alive = false;
    };
  }, [token, dict.auth.forbiddenRole]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(dict.auth.passwordMismatch);
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.updateUser({ password });
      // Supabase 는 '이전과 같은 비밀번호'를 영어 원문으로 거절한다 — 우리 문구로 바꿔 보여준다.
      if (err) throw new Error(/different from the old/i.test(err.message) ? dict.auth.resetSame : dict.auth.resetFailed);
      // 새 비밀번호로 다시 로그인하게 한다 — 메일 링크 세션을 그대로 쓰지 않는다.
      await supabase.auth.signOut({ scope: 'local' });
      setStage('done');
      setTimeout(() => window.location.replace(`/${locale}/login`), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.auth.resetFailed);
      setLoading(false);
    }
  }

  return (
    <div className="container-band flex min-h-[60vh] items-center justify-center">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-5 rounded-lg border border-grey-200 p-8"
      >
        <h1 className="section-title">{dict.auth.resetTitle}</h1>

        {stage === 'checking' && <p className="text-sm text-grey-500">…</p>}

        {stage === 'invalid' && (
          <>
            <p className="text-sm text-danger">{error ?? dict.auth.resetInvalid}</p>
            <Link href={`/${locale}/forgot-password`} className="btn btn-secondary w-full">
              {dict.auth.forgotTitle}
            </Link>
          </>
        )}

        {stage === 'done' && <p className="text-sm text-success">{dict.auth.resetSuccess}</p>}

        {stage === 'ready' && (
          <>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="space-y-1.5">
              <label className="label-caps">{dict.auth.newPassword}</label>
              <input
                type="password"
                required
                minLength={6}
                autoFocus
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="label-caps">{dict.auth.passwordConfirm}</label>
              <input
                type="password"
                required
                minLength={6}
                className="input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              {confirm.length > 0 && password !== confirm && (
                <p className="text-xs text-danger">{dict.auth.passwordMismatch}</p>
              )}
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? '…' : dict.auth.resetSubmit}
            </button>
          </>
        )}

        <p className="text-center text-sm text-grey-500">
          <Link href={`/${locale}/login`} className="hover:text-black">
            {dict.auth.backToLogin}
          </Link>
        </p>
      </form>
    </div>
  );
}
