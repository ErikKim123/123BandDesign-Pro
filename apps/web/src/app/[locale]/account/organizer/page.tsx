// 마이페이지 › 오거나이저 신청.
//
// 상태 네 가지를 한 화면에서 보여 준다: 신청 전 · 심사 중 · 반려(사유+다시 신청) · 승인(포털로).
// 역할(profiles.role)은 건드리지 않는다 — 여기 들어온 사람은 계속 고객이기도 하다(0116 주석).
import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, Clock, ExternalLink, XCircle } from 'lucide-react';
import type { Locale } from '@123band/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { createClient } from '@/lib/supabase/server';
import { requireCustomer } from '@/lib/auth/guard';
import { OrganizerApply } from '@/components/account/OrganizerApply';
import { PartnerPortalLink } from '@/components/auth/PartnerPortalLink';

export const dynamic = 'force-dynamic';

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const ko = params.locale === 'ko';
  return { title: ko ? '오거나이저 신청' : 'Become an organizer', robots: { index: false } };
}

interface Row {
  status: string;
  company_name: string | null;
  country: string | null;
  biz_no: string | null;
  contact: string | null;
  intro: string | null;
  reject_reason: string | null;
  applied_at: string | null;
}

export default async function OrganizerApplyPage({ params }: { params: { locale: string } }) {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  const t = dict.organizer;
  const user = await requireCustomer(locale, 'account/organizer');

  const supabase = createClient();
  const { data } = await supabase
    .from('partners')
    .select('status, company_name, country, biz_no, contact, intro, reject_reason, applied_at')
    .eq('user_id', user.id)
    .maybeSingle();
  const row = (data ?? null) as Row | null;
  const status = row?.status ?? null;
  const partnerBaseUrl = process.env.NEXT_PUBLIC_PARTNER_URL ?? 'https://123band-partner.vercel.app';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="section-title">{t.title}</h2>
        <p className="mt-2 text-sm text-grey-600">{t.subtitle}</p>
      </div>

      {status === 'active' ? (
        <div className="space-y-4 rounded-xl border border-success/40 bg-success/5 p-5">
          <p className="flex items-center gap-2 font-display text-lg text-ink">
            <CheckCircle2 size={18} className="text-success" />
            {t.approvedTitle}
          </p>
          <p className="text-sm leading-relaxed text-grey-600">{t.approvedBody}</p>
          <PartnerPortalLink baseUrl={partnerBaseUrl} label={t.enterPortal} />
        </div>
      ) : status === 'pending' ? (
        <div className="rounded-xl border border-grey-200 bg-cream-light p-5">
          <p className="flex items-center gap-2 font-display text-lg text-ink">
            <Clock size={18} className="text-primary" />
            {t.pendingTitle}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-grey-600">{t.pendingBody}</p>
          <dl className="mt-4 grid grid-cols-[minmax(5rem,auto)_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="label-caps pt-0.5 !text-[10px]">{t.company}</dt>
            <dd className="text-grey-700">{row?.company_name || '—'}</dd>
            <dt className="label-caps pt-0.5 !text-[10px]">{t.contact}</dt>
            <dd className="text-grey-700">{row?.contact || '—'}</dd>
          </dl>
        </div>
      ) : status === 'suspended' ? (
        <div className="rounded-xl border border-grey-200 bg-grey-50 p-5">
          <p className="font-display text-lg text-ink">{t.suspendedTitle}</p>
          <p className="mt-2 text-sm leading-relaxed text-grey-600">{t.suspendedBody}</p>
        </div>
      ) : (
        <>
          {status === 'rejected' && (
            <div className="rounded-xl border border-danger/40 bg-danger/5 p-5">
              <p className="flex items-center gap-2 font-display text-lg text-ink">
                <XCircle size={18} className="text-danger" />
                {t.rejectedTitle}
              </p>
              {row?.reject_reason && (
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-grey-700">
                  {row.reject_reason}
                </p>
              )}
              <p className="mt-2 text-sm text-grey-600">{t.rejectedBody}</p>
            </div>
          )}
          <OrganizerApply
            locale={locale}
            initial={{
              company: row?.company_name ?? '',
              country: row?.country ?? '',
              bizNo: row?.biz_no ?? '',
              contact: row?.contact ?? '',
              intro: row?.intro ?? '',
            }}
            t={t.form}
          />
        </>
      )}

      <p className="text-xs text-grey-500">
        <Link
          href={`/${locale}/sell`}
          className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-primary"
        >
          {t.howItWorks}
          <ExternalLink size={11} />
        </Link>
      </p>
    </div>
  );
}
