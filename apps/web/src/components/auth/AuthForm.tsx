// Design Ref: §5 Phase 4 — 고객 로그인/회원가입 (Supabase Auth).
// 가입 시 계정 유형(일반사용자/오거나이저)을 선택 → auth user_metadata 에 저장(이메일 확인 흐름 보존),
// ensureProfile 이 메타데이터를 읽어 profiles.role 과 (오거나이저면) partners 레코드를 생성.
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Locale } from '@123band/shared';
import { isBand123Member, SERVICE_TAG } from '@123band/shared/supabase/schema';
import { createClient } from '@/lib/supabase/client';
import { CountrySelect } from '@/components/form/CountrySelect';
import { PhoneField } from '@/components/form/PhoneField';
import { TermsConsentModal } from '@/components/auth/TermsConsentModal';
import { ReferralCapture } from '@/components/social/Referral';
import { DIAL_CODES } from '@/lib/countries';
import type { Dictionary } from '@/i18n/dictionaries';

// 로케일 기본 국가(전화 국가번호/국가 선택 기본값) — 편의상 미리 채워둔다(수정 가능).
const LOCALE_COUNTRY: Record<string, string> = { ko: 'KR', ja: 'JP', 'zh-TW': 'TW', en: 'US' };

type AccountType = 'customer' | 'partner';

// 카카오톡·WhatsApp 로그인 임시 숨김(추후 다시 켜려면 true). 현재는 구글/이메일만 노출.
const SHOW_KAKAO_WHATSAPP = false;

// 소셜(OAuth) 로그인 숨김 — 로그인 계정을 울프와 공유하는 동안은 끈다.
// OAuth 가입은 user_metadata 를 넘길 수 없어 123Band 회원 태그(service)를 달 수 없고,
// 울프 가입 트리거가 울프 회원으로 만들어 버린다. DB 를 분리하면 다시 켠다.
const SHOW_SOCIAL_LOGIN = false;

// 오거나이저 포털 — 타역할 차단 안내에서 바로 이동할 수 있게 링크 제공
const PARTNER_URL = process.env.NEXT_PUBLIC_PARTNER_URL ?? 'https://123band-partner.vercel.app';

// profiles row 가 없을 때만 생성. role 은 가입 시 선택값(메타데이터)만 신뢰하되
// 'partner' 외에는 모두 'customer' 로 클램프 — admin 자가승격 방지.
// 오거나이저면 partners 레코드(status=pending)도 보장 → 어드민 승인 대상.
async function ensureProfile(supabase: SupabaseClient, user: User, locale: Locale) {
  const meta = user.user_metadata ?? {};
  const role: AccountType = meta.account_type === 'partner' ? 'partner' : 'customer';
  const name = (meta.name as string | undefined) ?? null;

  const { data: existing } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (!existing) {
    await supabase.from('profiles').insert({
      id: user.id,
      email: user.email ?? null,
      name,
      phone: (meta.phone as string | undefined) || user.phone || null,
      role,
      locale,
      country: (meta.country as string | undefined) || null,
    });
  }

  if (role === 'partner') {
    const { data: partner } = await supabase
      .from('partners')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!partner) {
      await supabase.from('partners').insert({
        user_id: user.id,
        company_name: (meta.company_name as string | undefined) || null,
        country: (meta.country as string | undefined) || null,
        biz_no: (meta.biz_no as string | undefined) || null,
        status: 'pending',
      });
    }
  }
}

export function AuthForm({
  locale,
  dict,
  mode,
}: {
  locale: Locale;
  dict: Dictionary;
  mode: 'login' | 'signup';
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState(''); // 가입 시 비밀번호 재확인
  const [name, setName] = useState('');
  const [tel, setTel] = useState(''); // 가입 시 연락처 번호(국가번호 제외)
  const [country, setCountry] = useState(LOCALE_COUNTRY[locale] ?? 'US'); // 국가(ISO2) — 전화 국가번호/국가 공통
  const [gender, setGender] = useState(''); // 성별(선택) — 어드민 퍼널 분석용, 비워도 가입된다
  // 서버 가드/콜백이 ?error=forbidden 으로 되돌리면(타역할 차단) 안내 노출
  const [error, setError] = useState<string | null>(
    params.get('error') === 'forbidden' ? dict.auth.forbiddenRole : null,
  );
  // 타역할(관리자/오거나이저) 차단 여부 — 오거나이저 포털 링크 노출용
  const [forbidden, setForbidden] = useState(params.get('error') === 'forbidden');
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // WhatsApp 전화번호 OTP
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpStep, setOtpStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  // 로그인 화면의 "회원가입" 클릭 → 일반사용자 이용약관 동의 모달 노출 후 /signup 이동
  const [termsOpen, setTermsOpen] = useState(false);

  function gotoNext() {
    const next = params.get('next');
    // 하드 내비게이션: 헤더(서버 컴포넌트)가 새 세션 쿠키로 즉시 재렌더되도록 보장.
    // 소프트 내비(router.replace)는 로그인 전 RSC 캐시를 재사용해 로그아웃 상태 화면이
    // 남을 수 있어 사용자가 직접 새로고침해야 했다. 로그아웃 버튼과 동일한 방식으로 통일.
    window.location.replace(next ? `/${locale}/${next}` : `/${locale}`);
  }

  // 가입 완료: 성공 메시지를 잠시 보여준 뒤 이동
  function completeSignup() {
    setInfo(dict.auth.signupSuccess);
    setTimeout(() => gotoNext(), 1400);
  }

  // 소셜 OAuth(카카오/구글) — Supabase 가 제공자 키를 보유. 콜백에서 code→세션 교환.
  async function signInOAuth(provider: 'kakao' | 'google') {
    setError(null);
    setLoading(true);
    try {
      const next = params.get('next');
      // 인증 복귀 주소는 "지금 접속한 origin" 을 써야 한다. NEXT_PUBLIC_SITE_URL 은
      // 빌드 타임에 박히므로(예: Vercel 빌드에 localhost 가 들어가면) 프로덕션에서
      // 구글 로그인 후 localhost 로 돌아오는 버그가 난다. origin 은 항상 실제 위치다.
      const base = window.location.origin;
      const redirectTo = `${base}/${locale}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ''}`;
      const { error: err } = await createClient().auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (err) throw err;
      // 성공 시 제공자로 리다이렉트됨 (이후 콜백 라우트가 처리)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
      setLoading(false);
    }
  }

  // WhatsApp OTP 1단계: 인증번호 전송
  async function sendOtp() {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const { error: err } = await createClient().auth.signInWithOtp({
        phone,
        // 새 전화번호면 이 자리에서 가입된다 — 123Band 회원 태그(service)를 함께 넘긴다
        options: { channel: 'whatsapp', data: { service: SERVICE_TAG } },
      });
      if (err) throw err;
      setOtpStep('code');
      setInfo(dict.auth.codeSent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  // WhatsApp OTP 2단계: 인증번호 검증 → 로그인
  async function verifyOtp() {
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' });
      if (err) throw err;
      if (data.user && !isBand123Member(data.user)) {
        await supabase.auth.signOut({ scope: 'local' });
        throw new Error(dict.auth.notMember);
      }
      if (data.user) await ensureProfile(supabase, data.user, locale);
      gotoNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setForbidden(false);
    // 가입 시 비밀번호 재확인 일치 검증
    if (mode === 'signup' && password !== passwordConfirm) {
      setError(dict.auth.passwordMismatch);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    try {
      if (mode === 'signup') {
        // 국가번호 + 번호 결합 (국가 선택의 dial code 사용)
        const phoneValue = tel.trim()
          ? country && DIAL_CODES[country]
            ? `+${DIAL_CODES[country]} ${tel.trim()}`
            : tel.trim()
          : null;
        // Supabase 확인메일을 트리거하지 않도록 서버(service_role)에서 즉시 활성 계정 생성 →
        // 확인메일 없이 바로 로그인. (운영은 Supabase 메일 미사용; 알림은 Brevo)
        const res = await fetch('/api/account/signup', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            name: name || null,
            phone: phoneValue,
            country: country || null,
            gender: gender || null,
            account_type: 'customer',
          }),
        });
        const j = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          noAdmin?: boolean;
          error?: string;
          code?: string;
        };

        if (j.noAdmin) {
          // service_role 미설정 폴백 — 기존 signUp 경로(확인메일 설정에 의존)
          const { data, error: err } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo:
                typeof window !== 'undefined'
                  ? `${window.location.origin}/${locale}/auth/callback`
                  : undefined,
              data: {
                service: SERVICE_TAG, // DB 트리거가 보고 123Band 회원 태그·프로필을 만든다
                name: name || null,
                phone: phoneValue,
                country: country || null,
                account_type: 'customer',
              },
            },
          });
          // 중복 이메일: (1) 에러 메시지에 already/registered 포함, 또는
          // (2) Supabase 가 이메일 열거 방지로 identities 가 빈 유저를 반환 → 이미 가입으로 안내
          if (err) {
            if (/registered|already/i.test(err.message)) throw new Error(dict.auth.alreadyRegistered);
            throw err;
          }
          if (data.user && (data.user.identities?.length ?? 0) === 0) {
            throw new Error(dict.auth.alreadyRegistered);
          }
          if (data.session && data.user) {
            await ensureProfile(supabase, data.user, locale);
            completeSignup();
          } else {
            setInfo(dict.auth.confirmSent);
          }
        } else if (!res.ok || !j.ok) {
          throw new Error(
            j.code === 'already_registered' ? dict.auth.alreadyRegistered : j.error || 'Failed',
          );
        } else {
          // 생성 성공 → 바로 로그인
          const { data: si, error: siErr } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (siErr) throw siErr;
          await ensureProfile(supabase, si.user, locale);
          completeSignup();
        }
      } else {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
        // 로그인 실패 → 명확한 안내(원문 대신 친절한 메시지)
        if (err) throw new Error(dict.auth.loginFailed);
        // 로그인 계정은 울프·JNJ 와 공유한다 — 123Band 회원이 아니면 이 기기 세션만 끊고 차단.
        // (scope: 'local' — 기본값 global 은 울프 쪽 세션까지 전부 끊는다)
        if (!isBand123Member(data.user)) {
          await supabase.auth.signOut({ scope: 'local' });
          throw new Error(dict.auth.notMember);
        }
        // 세션 분리 규칙: web 은 고객 전용. admin/partner 계정이면 즉시 로그아웃 + 차단.
        const { data: prof } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle();
        if (prof && prof.role !== 'customer') {
          await supabase.auth.signOut({ scope: 'local' });
          setForbidden(true);
          throw new Error(dict.auth.forbiddenRole);
        }
        await ensureProfile(supabase, data.user, locale);
        gotoNext();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container-band flex min-h-[60vh] items-center justify-center">
      {/* 친구 추천 QR(/u/{code})에서 넘어온 ?ref= — 로그인 후 마이페이지에서 1회 반영된다 */}
      <ReferralCapture code={params.get('ref')} />
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5 rounded-lg border border-grey-200 p-8">
        <h1 className="section-title">{mode === 'signup' ? dict.auth.signup : dict.auth.login}</h1>
        {error && <p className="text-sm text-danger">{error}</p>}
        {/* 오거나이저/관리자 계정 차단 시 — 포털로 바로 이동할 수 있는 링크 */}
        {forbidden && (
          <a
            href={`${PARTNER_URL}/login?lang=${locale}`}
            className="btn btn-secondary w-full"
            target="_blank"
            rel="noreferrer"
          >
            {dict.auth.goPartnerPortal}
          </a>
        )}
        {info && <p className="text-sm text-success">{info}</p>}

        {mode === 'signup' && (
          <>
            <div className="space-y-1.5">
              <label className="label-caps">{dict.auth.name}</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <label className="label-caps">{dict.auth.gender}</label>
              <select className="input" value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">{dict.auth.genderNone}</option>
                <option value="female">{dict.auth.genderFemale}</option>
                <option value="male">{dict.auth.genderMale}</option>
                <option value="other">{dict.auth.genderOther}</option>
              </select>
            </div>

            <div className="space-y-1.5">
              {/* EN(해외) 고객은 WhatsApp 번호로 받는다. 국가번호는 국가 선택으로 자동 채움 */}
              <label className="label-caps">{locale === 'en' ? dict.auth.whatsapp : dict.auth.phone}</label>
              <PhoneField
                locale={locale}
                country={country}
                onCountryChange={setCountry}
                number={tel}
                onNumberChange={setTel}
                placeholder={locale === 'en' ? '415 555 1234' : '10 1234 5678'}
              />
            </div>
          </>
        )}
        <div className="space-y-1.5">
          <label className="label-caps">{dict.auth.email}</label>
          <input type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="label-caps">{dict.auth.password}</label>
          <input type="password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {mode === 'signup' && (
          <div className="space-y-1.5">
            <label className="label-caps">{dict.auth.passwordConfirm}</label>
            <input
              type="password"
              required
              className="input"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
            />
            {passwordConfirm.length > 0 && password !== passwordConfirm && (
              <p className="text-xs text-danger">{dict.auth.passwordMismatch}</p>
            )}
          </div>
        )}

        {mode === 'signup' && (
          <div className="space-y-1.5">
            <label className="label-caps">{dict.auth.country}</label>
            <CountrySelect locale={locale} value={country} onChange={setCountry} />
          </div>
        )}

        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? '…' : dict.auth.submit}
        </button>

        {/* 소셜 로그인 */}
        {SHOW_SOCIAL_LOGIN && (
          <>
            <div className="flex items-center gap-3 pt-1">
              <span className="h-px flex-1 bg-grey-200" />
              <span className="text-xs uppercase tracking-wide text-grey-400">{dict.auth.orContinue}</span>
              <span className="h-px flex-1 bg-grey-200" />
            </div>

            <button
              type="button"
              onClick={() => signInOAuth('google')}
              disabled={loading}
              className="btn w-full border border-grey-300 bg-white text-grey-800 hover:bg-grey-50"
            >
              {dict.auth.googleLogin}
            </button>
          </>
        )}

        {SHOW_SOCIAL_LOGIN && SHOW_KAKAO_WHATSAPP && (
        <button
          type="button"
          onClick={() => signInOAuth('kakao')}
          disabled={loading}
          className="btn w-full"
          style={{ backgroundColor: '#FEE500', color: '#191600' }}
        >
          {dict.auth.kakaoLogin}
        </button>
        )}

        {SHOW_KAKAO_WHATSAPP && (
        <button
          type="button"
          onClick={() => { setOtpOpen((v) => !v); setOtpStep('phone'); }}
          disabled={loading}
          className="btn w-full"
          style={{ backgroundColor: '#25D366', color: '#ffffff' }}
        >
          {dict.auth.whatsappLogin}
        </button>
        )}

        {SHOW_KAKAO_WHATSAPP && otpOpen && (
          <div className="space-y-2 rounded-lg border border-grey-200 p-3">
            {otpStep === 'phone' ? (
              <>
                <label className="label-caps">{dict.auth.phone}</label>
                <input
                  type="tel"
                  className="input"
                  placeholder="+821012345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <p className="text-[11px] text-grey-500">{dict.auth.phoneHint}</p>
                <button type="button" onClick={sendOtp} disabled={loading || !phone} className="btn btn-secondary w-full">
                  {dict.auth.sendCode}
                </button>
              </>
            ) : (
              <>
                <label className="label-caps">{dict.auth.otpCode}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="input"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />
                <button type="button" onClick={verifyOtp} disabled={loading || !otp} className="btn btn-primary w-full">
                  {dict.auth.verifyCode}
                </button>
              </>
            )}
          </div>
        )}

        <p className="text-center text-sm text-grey-500">
          {mode === 'signup' ? (
            <Link href={`/${locale}/login`} className="hover:text-black">{dict.auth.toLogin}</Link>
          ) : (
            <button
              type="button"
              onClick={() => setTermsOpen(true)}
              className="hover:text-black"
            >
              {dict.auth.toSignup}
            </button>
          )}
        </p>

        {/* 비밀번호 찾기 — 로그인 화면에만. 메일로 재설정 링크를 보낸다. */}
        {mode === 'login' && (
          <p className="text-center text-sm">
            <Link
              href={`/${locale}/forgot-password`}
              className="text-grey-400 underline underline-offset-4 hover:text-black"
            >
              {dict.auth.forgotPassword}
            </Link>
          </p>
        )}
      </form>

      {termsOpen && (
        <TermsConsentModal
          locale={locale}
          dict={dict}
          onClose={() => setTermsOpen(false)}
          onAgree={(result) => {
            setTermsOpen(false);
            // 마케팅 수신 동의 여부는 가입 폼으로 전달(선택). 필수 약관은 이미 동의됨.
            router.push(`/${locale}/signup${result.marketing ? '?mkt=1' : ''}`);
          }}
        />
      )}
    </div>
  );
}
