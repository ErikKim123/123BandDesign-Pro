// 뉴스레터 구독 폼 — 구독 버튼 → 동의 모달(이메일 표시 + 필수 동의 2건, 제목 클릭 시 약관 펼침).
// 두 항목 모두 동의해야 newsletter_subscribers 에 저장(중복 무시).
//
// 로그인 상태면 입력칸을 아예 안 보여준다 — 이미 아는 주소를 다시 타이핑하게 할 이유가 없다.
// 계정 이메일을 그대로 보여주고 버튼만 누르면 된다. 다른 주소로 받고 싶으면 '다른 이메일 사용'
// 을 눌러 직접 입력으로 전환할 수 있다(업적 판정은 회원 이메일과 대조하므로 기본값이 유리하다).
'use client';
import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Locale } from '@123band/shared';
import { createClient } from '@/lib/supabase/client';
import type { Dictionary } from '@/i18n/dictionaries';

export function NewsletterForm({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const t = dict.newsletter;
  const [email, setEmail] = useState('');
  // 로그인 계정 이메일. 있으면 입력칸 대신 이 주소를 보여준다.
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  // 로그인했지만 다른 주소로 구독하겠다고 전환한 상태
  const [manual, setManual] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [open, setOpen] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const [expanded, setExpanded] = useState<'privacy' | 'marketing' | null>(null);
  const [modalErr, setModalErr] = useState<string | null>(null);

  // 로그인 상태면 계정 이메일을 그대로 쓴다.
  // 업적('첫 구매' 등)은 구독 이메일과 회원 이메일을 대조해 판정하므로, 다른 주소로 구독하면
  // 본인 구독으로 인식되지 않는다 — 계정 이메일을 기본으로 두어 그 어긋남을 줄인다.
  // 탈퇴(소프트 삭제) 계정의 tombstone 주소로는 구독시키지 않는다.
  useEffect(() => {
    let alive = true;
    void createClient()
      .auth.getUser()
      .then(({ data }) => {
        const mail = data.user?.email;
        if (!alive || !mail || mail.includes('@deleted.invalid')) return;
        setAccountEmail(mail);
        setEmail((prev) => prev || mail);
      })
      .catch(() => {
        /* 비로그인/실패 시 빈 칸 유지 */
      });
    return () => {
      alive = false;
    };
  }, []);

  // 입력칸을 감출 조건 — 로그인했고, 아직 '다른 이메일 사용'으로 전환하지 않았을 때.
  const useAccount = Boolean(accountEmail) && !manual;

  // 구독 버튼 → 이메일만 검증하고 동의 모달 오픈(저장은 모달 확인에서).
  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // 로그인 상태에서는 입력칸이 없으므로 계정 이메일을 대상으로 삼는다.
    // (useEffect 가 setEmail 하기 전에 눌러도 비어 있지 않도록 여기서 한 번 더 맞춘다)
    const target = useAccount ? (accountEmail ?? '') : email;
    if (!target.trim()) return;
    if (target !== email) setEmail(target);
    setModalErr(null);
    setAgreePrivacy(false);
    setAgreeMarketing(false);
    setExpanded(null);
    setOpen(true);
  }

  async function confirmSubscribe() {
    if (!agreePrivacy || !agreeMarketing) {
      setModalErr(t.agreeRequired);
      return;
    }
    setStatus('loading');
    try {
      const supabase = createClient();
      // anon 은 insert 정책만 가짐. 이미 구독된 이메일(unique 위반 23505)은 성공 취급.
      const { error } = await supabase.from('newsletter_subscribers').insert({ email, locale });
      if (error && error.code !== '23505') throw error;
      setStatus('done');
      setEmail('');
      setOpen(false);
    } catch {
      setStatus('error');
      setModalErr(t.error);
    }
  }

  return (
    <section className="rounded-lg border border-grey-200 p-6 md:p-8">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
        <h2 className="text-lg uppercase tracking-tight">{t.title}</h2>
        <p className="text-sm text-grey-500">{t.desc}</p>
        {status === 'done' ? (
          <p className="text-sm text-success">{t.success}</p>
        ) : (
          <div className="w-full max-w-md">
            <form onSubmit={onSubmit} className="flex w-full flex-col gap-2 sm:flex-row">
              {useAccount ? (
                // 로그인 상태 — 입력 없이 계정 이메일 그대로. 읽기 전용 표시라 input 이 아니다.
                <p className="flex-1 truncate rounded-md bg-grey-50 px-3 py-2 text-left text-sm text-grey-700">
                  {accountEmail}
                </p>
              ) : (
                <input
                  type="email"
                  required
                  className="input flex-1"
                  placeholder={t.placeholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}
              <button type="submit" className="btn btn-primary whitespace-nowrap">
                {t.button}
              </button>
            </form>

            {useAccount && (
              <button
                type="button"
                className="mt-2 text-xs text-grey-500 underline underline-offset-2 hover:text-ink"
                onClick={() => {
                  setManual(true);
                  setEmail('');
                }}
              >
                {t.useAnotherEmail}
              </button>
            )}
          </div>
        )}
      </div>

      {/* 동의 모달 */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => status !== 'loading' && setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 text-left shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold">{t.modalTitle}</h3>

            {/* 입력한 이메일 표시 */}
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wide text-grey-400">{t.emailLabel}</p>
              <p className="mt-1 break-all rounded-md bg-grey-50 px-3 py-2 text-sm">{email}</p>
            </div>

            {/* 동의 항목 — 제목 클릭 시 약관 펼침 */}
            <div className="mt-5 space-y-3">
              <ConsentItem
                checked={agreePrivacy}
                onToggle={() => setAgreePrivacy((v) => !v)}
                label={t.privacyConsent}
                body={t.privacyBody}
                expanded={expanded === 'privacy'}
                onExpand={() => setExpanded((v) => (v === 'privacy' ? null : 'privacy'))}
                detailLabel={t.viewDetail}
              />
              <ConsentItem
                checked={agreeMarketing}
                onToggle={() => setAgreeMarketing((v) => !v)}
                label={t.marketingConsent}
                body={t.marketingBody}
                expanded={expanded === 'marketing'}
                onExpand={() => setExpanded((v) => (v === 'marketing' ? null : 'marketing'))}
                detailLabel={t.viewDetail}
              />
            </div>

            {modalErr && <p className="mt-3 text-sm text-danger">{modalErr}</p>}

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                className="btn btn-secondary flex-1"
                disabled={status === 'loading'}
                onClick={() => setOpen(false)}
              >
                {t.cancel}
              </button>
              <button
                type="button"
                className="btn btn-primary flex-1"
                disabled={status === 'loading' || !agreePrivacy || !agreeMarketing}
                onClick={confirmSubscribe}
              >
                {status === 'loading' ? '…' : t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ConsentItem({
  checked,
  onToggle,
  label,
  body,
  expanded,
  onExpand,
  detailLabel,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  body: string;
  expanded: boolean;
  onExpand: () => void;
  detailLabel: string;
}) {
  return (
    <div className="rounded-md border border-grey-200">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <input
          type="checkbox"
          className="h-4 w-4 shrink-0 accent-black"
          checked={checked}
          onChange={onToggle}
        />
        {/* 제목 클릭 → 약관 펼침/접힘 */}
        <button
          type="button"
          className="flex flex-1 items-center justify-between gap-2 text-left text-sm"
          onClick={onExpand}
          aria-expanded={expanded}
        >
          <span>{label}</span>
          <span className="flex shrink-0 items-center gap-1 text-xs text-grey-400">
            {detailLabel}
            <ChevronDown size={14} className={expanded ? 'rotate-180 transition' : 'transition'} />
          </span>
        </button>
      </div>
      {expanded && (
        <p className="border-t border-grey-100 px-3 py-2.5 text-xs leading-relaxed text-grey-600">
          {body}
        </p>
      )}
    </div>
  );
}
