// 비밀번호 찾기 — 이메일을 받아 재설정 링크 메일을 요청한다.
// 계정이 있든 없든 같은 안내를 보여준다(계정 존재 여부 노출 금지 — 서버도 같은 응답).
'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { Locale } from '@123band/shared';
import type { Dictionary } from '@/i18n/dictionaries';

export function ForgotPasswordForm({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/account/reset-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), locale }),
      });
    } catch {
      /* 네트워크 실패도 같은 안내 — 다시 눌러 보면 된다 */
    }
    setSent(true);
    setLoading(false);
  }

  return (
    <div className="container-band flex min-h-[60vh] items-center justify-center">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-5 rounded-lg border border-grey-200 p-8"
      >
        <h1 className="section-title">{dict.auth.forgotTitle}</h1>
        {sent ? (
          <>
            <p className="text-sm text-success">{dict.auth.forgotSent}</p>
            <p className="text-sm text-grey-500">{dict.auth.forgotSentHint}</p>
          </>
        ) : (
          <>
            <p className="text-sm text-grey-500">{dict.auth.forgotHint}</p>
            <div className="space-y-1.5">
              <label className="label-caps">{dict.auth.email}</label>
              <input
                type="email"
                required
                autoFocus
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? '…' : dict.auth.forgotSubmit}
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
