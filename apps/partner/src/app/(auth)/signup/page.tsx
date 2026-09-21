// Design Ref: §5.4 — 오거나이저 회원가입 (Supabase Auth 이메일/비밀번호).
// 가입 시 account_type='partner' 를 메타데이터로 보존 → /api/account/ensure(웹 프록시)가
// 이메일 자동확인 + profiles(role=partner) + partners(status=pending) 생성 + 운영자 승인 메일.
// 승인 전에도 포털 접근은 가능하되(상품 draft 작성 등) 판매 활성화는 운영자 승인 후.
'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { PartnerFooter } from '@/components/layout/PartnerFooter';
import { DICT } from '@/i18n/dict';

type Lang = 'ko' | 'en';

// 세션이 있는데 프로필/오거나이저 행이 없을 때 보장 생성(클라이언트 폴백).
// 서버 ensure(service_role)나 DB 트리거가 못 만든 경우에도 로그인 가드를 통과하도록.
// RLS(profiles_self / partners_own)가 본인 행 삽입을 허용 → 멱등(이미 있으면 건너뜀).
async function ensurePartnerProfile(supabase: SupabaseClient, user: User) {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const str = (k: string) => {
    const v = meta[k];
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  };

  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  if (!existing) {
    await supabase.from('profiles').insert({
      id: user.id,
      email: user.email ?? null,
      name: str('name'),
      phone: str('phone'),
      role: 'partner',
    });
  }

  const { data: partner } = await supabase
    .from('partners')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!partner) {
    await supabase.from('partners').insert({
      user_id: user.id,
      company_name: str('company_name'),
      country: str('country'),
      biz_no: str('biz_no'),
      status: 'pending',
    });
  }
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>('en');
  const t = DICT[lang].signup;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [bizNo, setBizNo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();
    try {
      // Supabase 확인메일을 트리거하지 않도록 web(service_role) 서버에서 즉시 활성 계정 생성.
      const res = await fetch('/api/account/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          account_type: 'partner',
          name: name || null,
          phone: phone || null,
          company_name: companyName || null,
          country: country || null,
          biz_no: bizNo || null,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        noAdmin?: boolean;
        error?: string;
        code?: string;
      };

      if (j.noAdmin) {
        // web 미도달/ service_role 미설정 폴백 — 일반 signUp(확인메일 설정에 의존)
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              service: 'band123', // DB 트리거가 보고 123Band 회원 태그·프로필을 만든다
              account_type: 'partner',
              name: name || null,
              phone: phone || null,
              company_name: companyName || null,
              country: country || null,
              biz_no: bizNo || null,
            },
          },
        });
        if (err) throw err;
        if (data.session && data.user) {
          await ensurePartnerProfile(supabase, data.user);
          router.refresh();
          router.replace('/dashboard');
        } else {
          setInfo(t.infoEmailSent);
        }
        return;
      }
      if (!res.ok || !j.ok) {
        throw new Error(
          j.code === 'already_registered' ? t.errAlready : j.error || t.errGeneric,
        );
      }

      // 생성 성공 → 바로 로그인 (프로필/오거나이저 행은 DB 트리거가 생성, 폴백으로 보장도 호출)
      const { data: si, error: siErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (siErr || !si.user) throw siErr ?? new Error(t.errLoginFail);
      await ensurePartnerProfile(supabase, si.user);
      router.refresh();
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errGeneric);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-grey-50">
      <main className="flex flex-1 items-center justify-center px-4 py-10">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-5 rounded-lg border border-grey-200 bg-white p-8"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="font-display text-2xl uppercase tracking-tight">{t.title}</h1>
            <p className="text-sm text-grey-500">{t.subtitle}</p>
          </div>
          <div className="flex shrink-0 overflow-hidden rounded-md border border-grey-300 text-xs font-medium">
            {(['en', 'ko'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={`px-2.5 py-1 uppercase transition-colors ${
                  lang === l ? 'bg-black text-white' : 'bg-white text-grey-500 hover:bg-grey-50'
                }`}
                aria-pressed={lang === l}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        {info && <p className="text-sm text-success">{info}</p>}

        <div className="space-y-1.5">
          <label className="label-caps">{t.companyName}</label>
          <input
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="input"
          />
        </div>
        <div className="space-y-1.5">
          <label className="label-caps">{t.name}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </div>
        <div className="space-y-1.5">
          <label className="label-caps">{t.phone}</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input"
          />
        </div>
        <div className="space-y-1.5">
          <label className="label-caps">{t.country}</label>
          <input value={country} onChange={(e) => setCountry(e.target.value)} className="input" />
        </div>
        <div className="space-y-1.5">
          <label className="label-caps">{t.bizNo}</label>
          <input value={bizNo} onChange={(e) => setBizNo(e.target.value)} className="input" />
        </div>
        <div className="space-y-1.5">
          <label className="label-caps">{t.email}</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </div>
        <div className="space-y-1.5">
          <label className="label-caps">{t.password}</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </div>

        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? t.submitting : t.submit}
        </button>

        <p className="text-center text-sm text-grey-500">
          {t.haveAccount}{' '}
          <Link href="/login" className="font-medium text-black hover:underline">
            {t.login}
          </Link>
        </p>
      </form>
      </main>
      <PartnerFooter locale={lang} />
    </div>
  );
}
