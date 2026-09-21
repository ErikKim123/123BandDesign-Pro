// Design Ref: J&J 참가 신청 · 관객 심사위원 접수 버튼 — 두 섹션의 주인공. 부문마다 폼이 다르고, 둘 다 회원만 할 수 있다.
//
// 비회원에게 버튼을 숨기지 않는 이유: '신청을 받고 있다'는 사실 자체가 이 페이지의 핵심 정보다.
// 버튼은 그대로 두고 누르면 로그인 안내를 펼친다 — 신청하러 온 사람이 가입 동선으로 이어진다.
// 대신 주소는 회원에게만 내려간다(비회원은 href 가 빈 값) — 페이지 소스에서 주소를 긁어가지 못하게.
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Lock } from 'lucide-react';
import type { Dictionary } from '@/i18n/dictionaries';

/** 브랜드 오렌지 필 버튼 — 그림자로 떠 있고 hover 에 살짝 들린다. */
const BUTTON =
  'group inline-flex w-full items-center justify-center gap-2 rounded-pill bg-primary px-7 py-3.5 ' +
  'font-display text-[15px] font-bold tracking-tight text-white ' +
  'shadow-[0_14px_28px_-12px_rgba(250,82,15,0.75)] transition-all duration-200 ' +
  'hover:-translate-y-0.5 hover:bg-primary-deep hover:shadow-[0_18px_34px_-12px_rgba(250,82,15,0.85)] ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ' +
  'active:translate-y-0 sm:w-auto';

export function JnjSignupCta({
  href,
  label,
  isAuthed,
  loginHref,
  loginRequiredText,
  dict,
}: {
  /** 신청 주소(참가·관객 심사위원). 비회원에게는 빈 값이 온다 — 주소를 페이지에 심지 않으려고. */
  href: string;
  label: string;
  isAuthed: boolean;
  loginHref: string;
  /** 로그인 안내 문구 — 관객 심사위원 접수처럼 다른 쓰임새면 바꿔 넣는다. 기본은 참가 신청 문구. */
  loginRequiredText?: string;
  dict: Dictionary;
}) {
  const [asked, setAsked] = useState(false);

  if (isAuthed && href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={BUTTON}>
        {label}
        <ArrowUpRight size={17} className="transition-transform group-hover:translate-x-0.5" />
      </a>
    );
  }

  return (
    <div className="w-full shrink-0 sm:w-auto">
      <button type="button" onClick={() => setAsked(true)} aria-expanded={asked} className={BUTTON}>
        {label}
        <Lock size={15} className="opacity-80" />
      </button>
      {asked && (
        <p className="mt-2.5 flex flex-wrap items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-white/80 px-4 py-2.5 text-xs text-grey-600 sm:justify-start">
          {loginRequiredText ?? dict.jnj.signupLoginRequired}
          <Link
            href={loginHref}
            className="font-semibold text-primary underline underline-offset-4 hover:text-ink"
          >
            {dict.auth.login}
          </Link>
        </p>
      )}
    </div>
  );
}
