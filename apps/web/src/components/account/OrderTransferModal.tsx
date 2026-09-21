// 결제완료 전(입금 확인 대기) 주문의 재결제/재요청 — 주문내역에서 QR 대신 노출.
// 버튼을 누르면 이체 정보(원화=계좌이체·카카오페이 / 외화=Wise·SWIFT)를 모달로 보여주고,
// 이미 송금한 고객은 "다시 알림"으로 운영자에게 입금 확인을 재요청한다(주문은 새로 만들지 않음).
'use client';
import { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { Landmark, Copy, Check, ExternalLink, X, Clock } from 'lucide-react';
import type { Currency, Locale } from '@123band/shared';
import { KRW_BANK, KAKAOPAY_URL, FX_BANK } from '@/lib/payments/transfer-info';
import { WeChatPayBlock, HAS_WECHAT_QR } from '@/components/cart/WeChatPayBlock';
import type { Dictionary } from '@/i18n/dictionaries';

export function OrderTransferModal({
  orderId,
  amountText,
  amountMinor,
  amountCurrency,
  locale,
  dict,
  wiseUrl = '',
}: {
  orderId: string;
  amountText: string;
  /** 보낼 금액(최소단위)+통화 — 위챗 블록의 위안화 환산에 쓴다(amountText 는 포맷된 문자열이라 환산 불가). */
  amountMinor?: number;
  amountCurrency?: Currency;
  locale: Locale;
  dict: Dictionary;
  wiseUrl?: string;
}) {
  const t = dict.orders;
  const ko = locale === 'ko';
  // 결제수단 UI 는 언어(locale) 기준 — 체크아웃과 동일. 한국어=계좌이체·카카오페이 / 그 외=Wise·SWIFT.
  const useKrwBank = ko;

  const [open, setOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      /* 클립보드 불가 무시 — 값은 화면에 그대로 보인다 */
    }
  }

  async function renotify() {
    setState('sending');
    try {
      const res = await fetch('/api/payments/transfer-renotify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId, locale }),
      });
      if (!res.ok) throw new Error('renotify failed');
      setState('sent');
    } catch {
      setState('error');
    }
  }

  // 모달 열림 동안 ESC 로 닫고 배경 스크롤 잠금.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="border-t border-grey-100 pt-4">
      {/* 대기 안내 배지 — 이미 확인 요청됨(수락 대기중) */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-pill bg-cream px-2.5 py-1 text-xs font-semibold text-primary ring-1 ring-beige">
          <Clock size={12} /> {t.awaitingRequested}
        </span>
        <p className="text-xs text-grey-500">{t.awaitingNote}</p>
      </div>

      <button
        type="button"
        onClick={() => {
          setState('idle');
          setOpen(true);
        }}
        className="btn btn-secondary btn-sm mt-3"
      >
        <Landmark size={15} /> {t.payAgain}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t.transferTitle}
        >
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" aria-hidden />
          <div className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-4 sm:p-7">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={dict.cart.close}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-grey-400 transition-colors hover:bg-grey-100 hover:text-ink"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 pr-8">
              <Landmark size={18} className="text-grey-700" />
              <p className="font-medium text-grey-800">{t.transferTitle}</p>
            </div>

            <div className="mt-5 space-y-3">
              {useKrwBank ? (
                <>
                  {/* 카카오페이 송금 */}
                  <div className="rounded-xl bg-grey-50 p-4 ring-1 ring-grey-200">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-md bg-[#FEE500] px-2 py-0.5 font-display text-xs font-extrabold tracking-tight text-[#3C1E1E]">
                        kakao pay
                      </span>
                      <p className="font-display text-base font-bold tracking-tight">카카오페이 송금</p>
                    </div>
                    <div className="mt-3 flex flex-col items-center gap-3 border-t border-grey-200 pt-4 sm:flex-row sm:gap-4">
                      <div className="shrink-0 rounded-lg bg-white p-2 ring-1 ring-grey-200">
                        <QRCode value={KAKAOPAY_URL} size={104} level="M" title="KakaoPay QR" />
                      </div>
                      <div className="min-w-0 flex-1 text-center sm:text-left">
                        <p className="text-xs text-grey-500">QR을 스캔하거나 버튼을 눌러 카카오페이로 송금하세요.</p>
                        <a
                          href={KAKAOPAY_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#FEE500] px-4 py-2.5 text-sm font-bold text-[#3C1E1E] transition-opacity hover:opacity-90 sm:w-auto"
                        >
                          카카오페이로 송금하기 <ExternalLink size={14} />
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-grey-400">
                    <span className="h-px flex-1 bg-grey-300" /> OR <span className="h-px flex-1 bg-grey-300" />
                  </div>

                  {/* 우리은행 무통장입금 */}
                  <div className="rounded-xl bg-grey-50 p-4 ring-1 ring-grey-200">
                    <p className="font-display text-lg font-bold tracking-tight">{KRW_BANK.bank}</p>
                    <p className="mt-0.5 text-sm text-grey-500">
                      예금주 <span className="font-medium text-grey-700">{KRW_BANK.holder}</span>
                    </p>
                    <p className="text-xs text-grey-400">{KRW_BANK.accountName}</p>
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-grey-200 pt-3">
                      <span className="select-all font-display text-lg tabular-nums tracking-tight">
                        {KRW_BANK.accountNo}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyText(KRW_BANK.accountNo.replace(/-/g, ''), 'account')}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-grey-300 px-2.5 py-1.5 text-xs font-medium text-grey-700 transition-colors hover:border-grey-400 hover:bg-grey-100"
                      >
                        {copiedKey === 'account' ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                        {copiedKey === 'account' ? '복사됨' : '복사'}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Wise 송금 */}
                  {wiseUrl && (
                    <div className="rounded-xl bg-grey-50 p-4 ring-1 ring-grey-200">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-md bg-[#9fe870] px-2 py-0.5 font-display text-xs font-extrabold tracking-tight text-[#163300]">
                          Wise
                        </span>
                        <p className="font-display text-base font-bold tracking-tight">Wise transfer</p>
                      </div>
                      <div className="mt-3 flex flex-col items-center gap-3 border-t border-grey-200 pt-4 sm:flex-row sm:gap-4">
                        <div className="shrink-0 rounded-lg bg-white p-2 ring-1 ring-grey-200">
                          <QRCode value={wiseUrl} size={104} fgColor="#163300" level="M" title="Wise payment QR" />
                        </div>
                        <div className="min-w-0 flex-1 text-center sm:text-left">
                          <p className="text-xs text-grey-500">Scan the QR or tap the button to open the Wise payment page.</p>
                          <a
                            href={wiseUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#9fe870] px-4 py-2.5 text-sm font-bold text-[#163300] transition-colors hover:bg-[#8fdc5f] sm:w-auto"
                          >
                            Pay with Wise <ExternalLink size={14} />
                          </a>
                        </div>
                      </div>
                      {/* 보낼 금액 — 위챗 블록과 같은 위치에 병기(맨 아래까지 스크롤하지 않아도 확인) */}
                      <div className="mt-3 flex items-center justify-between gap-3 border-t border-grey-200 pt-3">
                        <span className="label-caps shrink-0 text-grey-400">
                          {ko ? '보낼 금액' : 'Amount to send'}
                        </span>
                        <span className="font-display text-xl">{amountText}</span>
                      </div>
                    </div>
                  )}

                  {/* 위챗페이 QR (Wise 아래) */}
                  <WeChatPayBlock
                    leadingDivider={Boolean(wiseUrl)}
                    amountMinor={amountMinor}
                    currency={amountCurrency}
                    amountText={amountText}
                  />

                  {(wiseUrl || HAS_WECHAT_QR) && (
                    <div className="flex items-center gap-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-grey-400">
                      <span className="h-px flex-1 bg-grey-300" /> OR <span className="h-px flex-1 bg-grey-300" />
                    </div>
                  )}

                  {/* SWIFT 국제송금 */}
                  <div className="rounded-xl bg-grey-50 p-4 ring-1 ring-grey-200">
                    <div className="flex items-center gap-2">
                      <Landmark size={16} className="text-grey-600" />
                      <p className="font-display text-base font-bold tracking-tight">International wire (SWIFT)</p>
                    </div>
                    <dl className="mt-3 space-y-2 border-t border-grey-200 pt-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <dt className="shrink-0 text-grey-500">Bank</dt>
                        <dd className="text-right font-medium">{FX_BANK.bank}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="shrink-0 text-grey-500">SWIFT / BIC</dt>
                        <dd className="flex items-center gap-2">
                          <span className="select-all font-medium tabular-nums">{FX_BANK.swift}</span>
                          <button
                            type="button"
                            onClick={() => copyText(FX_BANK.swift, 'swift')}
                            aria-label="Copy SWIFT"
                            className="inline-flex shrink-0 items-center justify-center rounded-md border border-grey-300 p-1 text-grey-600 transition-colors hover:border-grey-400 hover:bg-grey-100"
                          >
                            {copiedKey === 'swift' ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                          </button>
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="shrink-0 text-grey-500">Account No.</dt>
                        <dd className="flex items-center gap-2">
                          <span className="select-all font-medium tabular-nums">{FX_BANK.accountNo}</span>
                          <button
                            type="button"
                            onClick={() => copyText(FX_BANK.accountNo.replace(/-/g, ''), 'fx')}
                            aria-label="Copy account number"
                            className="inline-flex shrink-0 items-center justify-center rounded-md border border-grey-300 p-1 text-grey-600 transition-colors hover:border-grey-400 hover:bg-grey-100"
                          >
                            {copiedKey === 'fx' ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                          </button>
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="shrink-0 text-grey-500">Beneficiary</dt>
                        <dd className="text-right font-medium">{FX_BANK.holder}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="shrink-0 text-grey-500">Currency</dt>
                        <dd className="text-right font-medium">{FX_BANK.currency}</dd>
                      </div>
                    </dl>
                  </div>
                </>
              )}

              {/* 보낼 금액 */}
              <div className="flex items-center justify-between pt-1">
                <span className="label-caps text-grey-400">{ko ? '보낼 금액' : 'Amount to send'}</span>
                <span className="font-display text-xl">{amountText}</span>
              </div>
            </div>

            {/* 재요청(다시 알림) — 이미 송금한 고객이 운영자에게 입금 확인을 다시 요청 */}
            <div className="mt-5 border-t border-grey-200 pt-4">
              {state === 'sent' ? (
                <p className="rounded-lg bg-success/10 px-3 py-2.5 text-center text-sm font-medium text-success">
                  {t.renotified}
                </p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={renotify}
                    disabled={state === 'sending'}
                    className="btn btn-primary w-full disabled:opacity-60"
                  >
                    {state === 'sending' ? (ko ? '전송 중…' : 'Sending…') : t.renotify}
                  </button>
                  {state === 'error' && (
                    <p className="mt-2 text-center text-sm text-danger">
                      {ko ? '알림 전송에 실패했어요. 잠시 후 다시 시도해 주세요.' : 'Failed to send. Please try again.'}
                    </p>
                  )}
                  <p className="mt-2 text-center text-xs text-grey-400">
                    {ko ? '송금을 완료하신 뒤 눌러 주세요.' : "Tap after you've completed the transfer."}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
