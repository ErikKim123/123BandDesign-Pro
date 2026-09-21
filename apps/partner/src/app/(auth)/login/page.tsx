// Design Ref: §5.4 로그인 — Supabase Auth 이메일/비밀번호
'use client';
import { isBand123Member } from '@123band/shared/supabase/schema';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PartnerFooter } from '@/components/layout/PartnerFooter';
import { DICT } from '@/i18n/dict';
import { ExternalLink } from 'lucide-react';

type Lang = 'ko' | 'en';
type ErrCode = 'forbidden' | 'sso' | 'login' | 'not_member';

// 오거나이저가 자주 오가는 곳 — 로그인 전에도 넘어갈 수 있게 옆에 둔다(어드민 로그인과 같은 모양).
// 어드민 주소는 넣지 않는다. 여기는 운영자가 아니라 주최자가 보는 화면이다.
const SHORTCUTS: { name: string; key: 'wolf' | 'jnj' | 'battle' | 'div'; href: string }[] = [
  { name: '123Band', key: 'wolf', href: 'https://123band-web.vercel.app' },
  { name: 'J&J Dash', key: 'jnj', href: 'https://jnj-dash-db.vercel.app' },
  { name: 'BATTLE Dash', key: 'battle', href: 'https://battle-dash-db.vercel.app' },
  { name: 'DIV Dash', key: 'div', href: 'https://div-dash-db.vercel.app' },
];

// useSearchParams 는 Suspense 경계 필요 (Next.js CSR bailout)
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

/** EN·KO 토글 — 로그인 폼과 '들어가기' 카드가 같이 쓴다. */
function LangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
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
  );
}

function LoginForm() {
  const params = useSearchParams();
  // web 등 외부에서 ?lang=ko|en 으로 진입하면 그 언어로 시작(없으면 EN).
  const [lang, setLang] = useState<Lang>(params.get('lang') === 'ko' ? 'ko' : 'en');
  const t = DICT[lang].login;
  const s = DICT[lang].shortcuts;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errCode, setErrCode] = useState<ErrCode | null>(
    params.get('error') === 'forbidden'
      ? 'forbidden'
      : params.get('error') === 'not_member'
        ? 'not_member'
        : null,
  );
  const [loading, setLoading] = useState(false);
  // 세션이 이미 있는 상태 — 여기 담긴 이메일로 '들어가기' 카드를 그린다.
  // 자동으로 대시보드에 던져 넣지 않는다: 이 화면이 오거나이저의 '입장 문'이라,
  // 어디로 들어가는지 보고 한 번 눌러 들어가게 한다.
  const [ready, setReady] = useState<string | null>(null);
  const error =
    errCode === 'forbidden'
      ? t.errForbidden
      : errCode === 'sso'
        ? t.errSsoFail
        : errCode === 'login'
          ? t.errLoginFail
          : errCode === 'not_member'
            ? t.errNotMember
            : null;

  // web→partner SSO 핸드오프: 고객 web 계정 페이지에서 넘어온 세션 토큰(URL 해시)을
  // 받아 오거나이저 세션으로 설정한다. 설정만 하고 멈춘다 — 들어가는 건 사람이 누른다.
  // 토큰은 히스토리에 안 남도록 즉시 제거한다.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.location.hash.includes('sso_at=')) return;
    const p = new URLSearchParams(window.location.hash.slice(1));
    const access_token = p.get('sso_at');
    const refresh_token = p.get('sso_rt');
    // 해시 즉시 제거 (브라우저 히스토리에 토큰이 남지 않도록)
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    if (!access_token || !refresh_token) return;
    setLoading(true);
    createClient()
      .auth.setSession({ access_token, refresh_token })
      .then(async ({ data, error }) => {
        setLoading(false);
        if (error) {
          setErrCode('sso');
          return;
        }
        // 로그인 계정은 울프·JNJ 와 공유한다 — 123Band 회원이 아니면 이 기기 세션만 끊는다
        if (!isBand123Member(data.session?.user)) {
          await createClient().auth.signOut({ scope: 'local' });
          setErrCode('not_member');
          return;
        }
        setReady(data.session?.user.email ?? '');
      });
  }, []);

  // 이미 로그인된 채로 이 화면에 오면(웹에서 넘어옴·북마크·로그아웃 후 뒤로가기) 폼 대신
  // '들어가기' 카드를 보여 준다.
  // - getSession() 이 아니라 getUser() 를 쓴다: 전자는 로컬 쿠키만 보므로 만료/무효 세션이
  //   남아 있어도 들어가기 카드가 떠서, 눌러 봐야 다시 튕겨 나온다.
  // - ?error 가 붙은 경우(layout 의 가드가 forbidden 으로 되돌림)는 건너뛴다 — 그 계정으로는
  //   들어갈 수 없으니 카드를 띄우면 안 된다.
  useEffect(() => {
    if (params.has('error')) return;
    let active = true;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data, error }) => {
      if (active && data.user && !error) setReady(data.user.email ?? '');
    });
    return () => {
      active = false;
    };
  }, [params]);

  // 바로가기에 띄울 대시보드 — 운영자가 계약에 맞춰 켜 준 종류만(partner_dashboards, 0121).
  //
  // 처음에는 '대회 접근권이 있는 것만' 으로 판단했는데, 그러면 아직 대회를 하나도 안 만든
  // 주최자에게는 첫 대회를 만들러 들어갈 문이 보이지 않았다. 계약이 곧 문이다.
  // RLS 가 본인 행만 돌려주므로 로그인 전에는 자연히 비어 있다(= 셋 다 숨는다).
  // null = 아직 확인 전 — 있었다 없었다 깜빡이지 않도록 그동안에도 숨겨 둔다.
  const [dashes, setDashes] = useState<Set<string> | null>(null);
  useEffect(() => {
    let active = true;
    createClient()
      .from('partner_dashboards')
      .select('dash, enabled')
      .then(({ data, error }) => {
        if (!active) return;
        const rows = error ? [] : ((data ?? []) as { dash: string; enabled: boolean }[]);
        setDashes(new Set(rows.filter((r) => r.enabled).map((r) => r.dash)));
      });
    return () => {
      active = false;
    };
    // 로그인·SSO 로 세션이 생긴 뒤 다시 확인한다.
  }, [ready]);

  /** 대시보드로 — 하드 내비게이션이라야 서버 컴포넌트가 새 세션 쿠키로 다시 그려진다. */
  function enter() {
    setLoading(true);
    window.location.replace('/dashboard');
  }

  async function useAnother() {
    setLoading(true);
    await createClient().auth.signOut();
    setReady(null);
    setEmail('');
    setPassword('');
    setLoading(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrCode(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setErrCode('login');
      return;
    }
    // 로그인 계정은 울프·JNJ 와 공유한다 — 123Band 회원이 아니면 이 기기 세션만 끊고 차단
    // (scope: 'local' — 기본값 global 은 울프 쪽 세션까지 전부 끊는다)
    if (!isBand123Member(data.user)) {
      await supabase.auth.signOut({ scope: 'local' });
      setErrCode('not_member');
      return;
    }
    // 하드 내비게이션 — 위 SSO 처리와 동일한 이유
    window.location.replace('/dashboard');
  }

  return (
    <div className="flex min-h-screen flex-col bg-grey-50">
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10 md:flex-row md:items-start md:gap-10 md:pt-[22vh]">
      {ready !== null ? (
        <section className="w-full max-w-sm space-y-5 rounded-lg border border-grey-200 bg-white p-8">
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-display text-2xl uppercase tracking-tight">{t.title}</h1>
            <LangToggle lang={lang} setLang={setLang} />
          </div>
          <div className="rounded-lg bg-grey-50 px-4 py-3">
            <p className="label-caps">{t.readyTitle}</p>
            <p className="mt-1 truncate text-sm font-medium text-grey-800">{ready}</p>
          </div>
          <button type="button" onClick={enter} disabled={loading} className="btn btn-primary w-full">
            {t.enter}
          </button>
          <button
            type="button"
            onClick={useAnother}
            disabled={loading}
            className="btn w-full border border-grey-300 bg-white text-grey-800 hover:bg-grey-50"
          >
            {t.other}
          </button>
        </section>
      ) : (
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-5 rounded-lg border border-grey-200 bg-white p-8"
      >
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl uppercase tracking-tight">{t.title}</h1>
          <LangToggle lang={lang} setLang={setLang} />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
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

        <div className="flex items-center gap-3 pt-1">
          <span className="h-px flex-1 bg-grey-200" />
          <span className="text-xs uppercase tracking-wide text-grey-400">{t.or}</span>
          <span className="h-px flex-1 bg-grey-200" />
        </div>

        <Link href="/signup" className="btn w-full border border-grey-300 bg-white text-grey-800 hover:bg-grey-50">
          {t.signup}
        </Link>
      </form>
      )}

      {/* 바로가기 — 로그인 전에도 다른 화면으로 넘어갈 수 있게. 새 탭으로 연다. */}
      <nav
        aria-label={s.title}
        className="w-full max-w-sm rounded-lg border border-grey-200 bg-white p-5 md:w-64"
      >
        <p className="label-caps mb-3">{s.title}</p>
        <ul className="space-y-1.5">
          {SHORTCUTS.filter((x) => x.key === 'wolf' || dashes?.has(x.key)).map((x) => (
            <li key={x.href}>
              <a
                href={x.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-grey-100"
              >
                <span className="min-w-0">
                  <span className="block font-medium">{x.name}</span>
                  <span className="block truncate text-xs text-grey-500">{s[x.key]}</span>
                </span>
                <ExternalLink size={14} className="shrink-0 text-grey-400" />
              </a>
            </li>
          ))}
        </ul>
      </nav>
      </main>
      <PartnerFooter locale={lang} />
    </div>
  );
}
