// Design Ref: §5 Phase 4 — 고객 회원가입 진입 전 이용약관 동의(일반사용자/구매회원).
// 로그인 화면의 "회원가입" 클릭 → 이 모달로 필수(만14세/이용약관/개인정보) 및
// 선택(마케팅 수신) 동의를 받은 뒤 /signup 으로 이동. 약관 전문·개인정보 표는 content/customerTerms.
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, X } from 'lucide-react';
import type { Locale } from '@123band/shared';
import type { Dictionary } from '@/i18n/dictionaries';
import {
  CUSTOMER_TERMS_KO,
  CUSTOMER_TERMS_EN_NOTICE,
  PRIVACY_COLLECTION_KO,
  PRIVACY_COLLECTION_EN,
} from '@/content/customerTerms';

type ReqKey = 'age' | 'tos' | 'privacy';
type MktKey = 'mktPi' | 'mktChannel' | 'mktEmail';

export type ConsentResult = {
  marketing: boolean; // 마케팅 수신(개인정보/채널/이메일) 중 하나라도 동의 여부
  marketingPi: boolean;
  marketingChannel: boolean;
  marketingEmail: boolean;
};

export function TermsConsentModal({
  locale,
  dict,
  onClose,
  onAgree,
}: {
  locale: Locale;
  dict: Dictionary;
  onClose: () => void;
  onAgree: (result: ConsentResult) => void;
}) {
  const t = dict.auth.terms;
  const [req, setReq] = useState<Record<ReqKey, boolean>>({ age: false, tos: false, privacy: false });
  const [mkt, setMkt] = useState<Record<MktKey, boolean>>({ mktPi: false, mktChannel: false, mktEmail: false });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const marketingAll = mkt.mktPi && mkt.mktChannel && mkt.mktEmail;
  const marketingAny = mkt.mktPi || mkt.mktChannel || mkt.mktEmail;
  const allChecked = req.age && req.tos && req.privacy && marketingAll;
  const requiredOk = req.age && req.tos && req.privacy;

  function toggleReq(key: ReqKey) {
    setReq((r) => ({ ...r, [key]: !r[key] }));
  }
  function toggleMkt(key: MktKey) {
    setMkt((m) => ({ ...m, [key]: !m[key] }));
  }
  function toggleMarketingAll() {
    const next = !marketingAll;
    setMkt({ mktPi: next, mktChannel: next, mktEmail: next });
  }
  function toggleAll() {
    const next = !allChecked;
    setReq({ age: next, tos: next, privacy: next });
    setMkt({ mktPi: next, mktChannel: next, mktEmail: next });
  }
  function toggleExpand(id: string) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }));
  }

  const privacyRows = locale === 'ko' ? PRIVACY_COLLECTION_KO : PRIVACY_COLLECTION_EN;

  // 필수/선택 배지 — 필수는 브랜드색, 선택은 회색 (Cloudflare [Required]/[Optional] 참고)
  function TagBadge({ required }: { required?: boolean }) {
    if (required === undefined) return null;
    return (
      <span
        className={`mr-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
          required ? 'bg-primary/10 text-primary' : 'bg-grey-100 text-grey-500'
        }`}
      >
        {required ? t.required : t.optional}
      </span>
    );
  }

  function ConsentRow({
    checked,
    onToggle,
    required,
    label,
    onExpand,
    open,
  }: {
    checked: boolean;
    onToggle: () => void;
    required?: boolean;
    label: string;
    onExpand?: () => void;
    open?: boolean;
  }) {
    return (
      <div className="flex items-start gap-3 py-3">
        {/* 체크박스+문구는 label 로 묶어 문구 클릭 시에도 체크되게 (접근성) */}
        <label className="flex flex-1 cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            checked={checked}
            onChange={onToggle}
          />
          <span className="text-sm leading-snug text-grey-700">
            <TagBadge required={required} />
            {label}
          </span>
        </label>
        {/* Cloudflare 처럼 오른쪽에 "보기" 텍스트 링크 → 클릭 시 아래 전문/표를 펼침 */}
        {onExpand && (
          <button
            type="button"
            onClick={onExpand}
            aria-expanded={open}
            className="flex shrink-0 items-center gap-0.5 pt-0.5 text-xs font-medium text-primary transition-colors hover:text-primary-deep"
          >
            <span className="underline underline-offset-2">{t.view}</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex shrink-0 items-center justify-between border-b border-grey-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-ink">{t.title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-grey-400 transition-colors hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 본문(스크롤) */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <p className="mb-3 text-xs text-grey-500">{t.intro}</p>

          {/* 전체 동의 */}
          <label className="flex cursor-pointer items-center gap-3 rounded-md bg-grey-50 px-3 py-3">
            <input
              type="checkbox"
              className="h-5 w-5 shrink-0 accent-primary"
              checked={allChecked}
              onChange={toggleAll}
            />
            <span className="text-sm font-semibold text-ink">{t.agreeAll}</span>
          </label>

          <ul className="mt-1 divide-y divide-grey-100">
            {/* 만 14세 이상 (필수) */}
            <li>
              <ConsentRow required label={t.age} checked={req.age} onToggle={() => toggleReq('age')} />
            </li>

            {/* 이용약관 (필수) — 전문 */}
            <li>
              <ConsentRow
                required
                label={t.tos}
                checked={req.tos}
                onToggle={() => toggleReq('tos')}
                onExpand={() => toggleExpand('tos')}
                open={expanded.tos}
              />
              {expanded.tos && (
                <div className="mb-3 rounded-md bg-grey-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] text-grey-500">{t.tosNote}</span>
                    <Link
                      href={`/${locale}/terms`}
                      target="_blank"
                      className="shrink-0 text-[11px] font-medium text-primary hover:underline"
                    >
                      {t.viewFull}
                    </Link>
                  </div>
                  <div className="max-h-[42vh] space-y-4 overflow-y-auto pr-1">
                    {locale !== 'ko' && (
                      <p className="text-[11px] italic leading-relaxed text-grey-500">
                        {CUSTOMER_TERMS_EN_NOTICE}
                      </p>
                    )}
                    {CUSTOMER_TERMS_KO.map((chapter) => (
                      <div key={chapter.title}>
                        <h4 className="mb-2 text-xs font-semibold text-ink">{chapter.title}</h4>
                        <div className="space-y-3">
                          {chapter.articles.map((a) => (
                            <div key={a.title}>
                              <p className="text-[11px] font-semibold text-grey-700">{a.title}</p>
                              <p className="whitespace-pre-line text-[11px] leading-relaxed text-grey-600">
                                {a.body}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </li>

            {/* 개인정보 수집·이용 (필수) — 표 */}
            <li>
              <ConsentRow
                required
                label={t.privacy}
                checked={req.privacy}
                onToggle={() => toggleReq('privacy')}
                onExpand={() => toggleExpand('privacy')}
                open={expanded.privacy}
              />
              {expanded.privacy && (
                <div className="mb-3 rounded-md bg-grey-50 p-3">
                  <div className="max-h-[42vh] overflow-y-auto">
                    <table className="w-full table-fixed border-collapse text-left text-[11px]">
                      <thead>
                        <tr className="text-grey-500">
                          <th className="w-[38%] border border-grey-200 p-2 font-semibold">{t.colPurpose}</th>
                          <th className="w-[32%] border border-grey-200 p-2 font-semibold">{t.colItems}</th>
                          <th className="w-[30%] border border-grey-200 p-2 font-semibold">{t.colRetention}</th>
                        </tr>
                      </thead>
                      <tbody className="text-grey-600">
                        {privacyRows.map((row, i) => (
                          <tr key={i} className="align-top">
                            <td className="border border-grey-200 p-2 leading-relaxed">{row.purpose}</td>
                            <td className="border border-grey-200 p-2 leading-relaxed">{row.items}</td>
                            <td className="border border-grey-200 p-2 leading-relaxed">{row.retention}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-[11px] text-grey-500">{t.privacyNote}</p>
                </div>
              )}
            </li>

            {/* 마케팅 수신 동의 (선택) — 하위 항목 */}
            <li>
              <ConsentRow
                required={false}
                label={t.marketing}
                checked={marketingAll}
                onToggle={toggleMarketingAll}
                onExpand={() => toggleExpand('marketing')}
                open={expanded.marketing}
              />
              {expanded.marketing && (
                <div className="mb-3 ml-7 rounded-md bg-grey-50 px-3 py-1">
                  <label className="flex cursor-pointer items-center gap-3 py-2 text-[13px] text-grey-600">
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 accent-primary"
                      checked={mkt.mktPi}
                      onChange={() => toggleMkt('mktPi')}
                    />
                    {t.marketingPrivacy}
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 border-t border-grey-100 py-2 text-[13px] text-grey-600">
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 accent-primary"
                      checked={mkt.mktChannel}
                      onChange={() => toggleMkt('mktChannel')}
                    />
                    {t.marketingChannel}
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 border-t border-grey-100 py-2 text-[13px] text-grey-600">
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 accent-primary"
                      checked={mkt.mktEmail}
                      onChange={() => toggleMkt('mktEmail')}
                    />
                    {t.marketingEmail}
                  </label>
                  <p className="border-t border-grey-100 py-2 text-[11px] text-grey-400">{t.marketingNote}</p>
                </div>
              )}
            </li>
          </ul>
        </div>

        {/* 푸터 */}
        <div className="shrink-0 border-t border-grey-200 px-6 py-4">
          <button
            type="button"
            disabled={!requiredOk}
            onClick={() =>
              onAgree({
                marketing: marketingAny,
                marketingPi: mkt.mktPi,
                marketingChannel: mkt.mktChannel,
                marketingEmail: mkt.mktEmail,
              })
            }
            className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
