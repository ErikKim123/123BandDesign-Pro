// 오거나이저 신청 폼 — 회사 정보 + 주최자 약관 동의.
//
// 역할(profiles.role)은 바꾸지 않는다. 춤추러 다니는 회원이 그대로 행사도 여는 것이라,
// 역할을 'partner' 로 바꾸면 그 사람이 자기 주문·뱃지 화면에서 쫓겨난다(web 은 고객 전용 가드).
// '오거나이저인가'는 partners.status='active' 로만 판단한다(0116).
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import type { Locale } from '@123band/shared';
import { createClient } from '@/lib/supabase/client';
import { COUNTRY_CODES } from '@/lib/countries';
import { ORGANIZER_TERMS_VERSION } from '@/lib/organizer';

export interface OrganizerApplyStrings {
  title: string;
  lead: string;
  company: string;
  companyPlaceholder: string;
  country: string;
  bizNo: string;
  bizNoHint: string;
  contact: string;
  contactPlaceholder: string;
  intro: string;
  introPlaceholder: string;
  termsTitle: string;
  termsOpen: string;
  agree: string;
  agreeRequired: string;
  submit: string;
  submitting: string;
  required: string;
  failed: string;
}

export function OrganizerApply({
  locale,
  initial,
  t,
}: {
  locale: Locale;
  /** 반려 뒤 다시 신청할 때는 지난 신청서를 그대로 채워 둔다. */
  initial: { company: string; country: string; bizNo: string; contact: string; intro: string };
  t: OrganizerApplyStrings;
}) {
  const router = useRouter();
  const [company, setCompany] = useState(initial.company);
  const [country, setCountry] = useState(initial.country || (locale === 'ko' ? 'KR' : ''));
  const [bizNo, setBizNo] = useState(initial.bizNo);
  const [contact, setContact] = useState(initial.contact);
  const [intro, setIntro] = useState(initial.intro);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 국가 이름은 보는 사람의 언어로 — 목록을 소스에 적어 두지 않는다.
  const names = new Intl.DisplayNames([locale === 'ko' ? 'ko' : 'en'], { type: 'region' });
  const countries = COUNTRY_CODES.map((c) => ({ code: c, label: names.of(c) ?? c })).sort((a, b) =>
    a.label.localeCompare(b.label, locale === 'ko' ? 'ko' : 'en'),
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!company.trim() || !country || !contact.trim()) return setError(t.required);
    if (!agreed) return setError(t.agreeRequired);
    setBusy(true);
    setError(null);
    const { error: err } = await createClient().rpc('apply_organizer', {
      p_company_name: company.trim(),
      p_country: country,
      p_contact: contact.trim(),
      p_terms_version: ORGANIZER_TERMS_VERSION,
      p_biz_no: bizNo.trim() || null,
      p_intro: intro.trim() || null,
    });
    setBusy(false);
    if (err) {
      setError(t.failed);
      return;
    }
    // 운영자에게 알린다. 신청은 이미 저장됐으니 메일 결과는 기다리지도, 화면에 내보이지도 않는다 —
    // 메일이 실패했다고 신청이 안 된 것처럼 보이면 사람이 같은 신청을 또 낸다.
    void fetch('/api/notify/organizer-apply', { method: 'POST' }).catch(() => {});
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <p className="text-sm leading-relaxed text-grey-600">{t.lead}</p>

      <div className="space-y-1.5">
        <label className="label-caps" htmlFor="org-company">
          {t.company} *
        </label>
        <input
          id="org-company"
          className="input"
          value={company}
          maxLength={80}
          placeholder={t.companyPlaceholder}
          onChange={(e) => setCompany(e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="label-caps" htmlFor="org-country">
            {t.country} *
          </label>
          <select
            id="org-country"
            className="input"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            <option value="">—</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="label-caps" htmlFor="org-contact">
            {t.contact} *
          </label>
          <input
            id="org-contact"
            className="input"
            value={contact}
            maxLength={60}
            placeholder={t.contactPlaceholder}
            onChange={(e) => setContact(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="label-caps" htmlFor="org-bizno">
          {t.bizNo}
        </label>
        <input
          id="org-bizno"
          className="input"
          value={bizNo}
          maxLength={40}
          onChange={(e) => setBizNo(e.target.value)}
        />
        <p className="text-xs text-grey-500">{t.bizNoHint}</p>
      </div>

      <div className="space-y-1.5">
        <label className="label-caps" htmlFor="org-intro">
          {t.intro}
        </label>
        <textarea
          id="org-intro"
          className="input min-h-24"
          value={intro}
          maxLength={500}
          placeholder={t.introPlaceholder}
          onChange={(e) => setIntro(e.target.value)}
        />
      </div>

      {/* 계약 — 약관 전문은 따로 한 장으로 있다. 여기서는 동의만 받고 전문으로 보낸다. */}
      <div className="rounded-xl border border-grey-200 bg-cream-light p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="label-caps">{t.termsTitle}</span>
          <Link
            href={`/${locale}/organizer-terms`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline underline-offset-4"
          >
            {t.termsOpen}
            <ExternalLink size={12} />
          </Link>
        </div>
        <label className="mt-3 flex items-start gap-2.5 text-sm leading-relaxed text-ink">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>{t.agree}</span>
        </label>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button type="submit" className="btn btn-primary w-full" disabled={busy || !agreed}>
        {busy ? t.submitting : t.submit}
      </button>
    </form>
  );
}
