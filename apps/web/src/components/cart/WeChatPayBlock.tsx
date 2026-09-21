// 위챗페이 수취 QR 블록 — 체크아웃/주문내역 이체 모달의 Wise 아래에 공용으로 끼운다.
// 앞선 항목과 나누는 OR 구분선까지 함께 그려서, QR 이 없을 때 구분선만 남지 않도록 한 덩어리로 숨긴다.
'use client';
import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { convertMinor, formatPrice, type Currency, type Prices } from '@123band/shared';
import { WECHAT_PAY } from '@/lib/payments/transfer-info';

/** 위챗 QR 노출 여부(정적) — 부모가 구분선 배치를 결정할 때 쓴다. */
export const HAS_WECHAT_QR = Boolean(WECHAT_PAY.qrSrc);

/**
 * 위챗페이 배지 — 이 블록 헤더와 체크아웃 이체 버튼이 같은 모양을 쓰도록 공용화.
 * Wise 배지(연두 + 'Wise')와 짝이 되게 위챗 브랜드 그린(#07C160)을 쓴다.
 */
export function WeChatPayBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`inline-flex items-center bg-[#07C160] font-display text-xs font-extrabold tracking-tight text-white ${
        compact ? 'rounded px-1.5 py-0.5' : 'rounded-md px-2 py-0.5'
      }`}
    >
      WeChat Pay
    </span>
  );
}

export function WeChatPayBlock({
  leadingDivider = true,
  amountMinor,
  currency,
  amountText,
}: {
  leadingDivider?: boolean;
  /** 보낼 금액(표시 통화 최소단위). currency 와 함께 넘기면 위안화 환산액을 QR 아래에 표기. */
  amountMinor?: number;
  /** amountMinor 의 통화. */
  currency?: Currency;
  /** 원래 통화로 포맷된 금액 — 환산액 아래에 병기(환산 전 기준액). */
  amountText?: string;
}) {
  // 이미지가 아직 준비되지 않았거나(경로 비움) 로드에 실패하면 결제 흐름을 방해하지 않도록 숨긴다.
  const [failed, setFailed] = useState(false);
  if (!WECHAT_PAY.qrSrc || failed) return null;

  // 위안화 환산 — 표시 통화가 이미 CNY 면 그대로, 아니면 근사 환율로 환산(≈ 로 표기).
  // ⚠️ 환율은 표시 전용 근사값이라 실제 송금액과 차이가 날 수 있어 approx 를 반드시 드러낸다.
  const hasAmount = amountMinor != null && amountMinor > 0 && currency != null;
  const cnyMinor = hasAmount ? convertMinor(amountMinor, currency, 'CNY') : null;
  const approx = currency !== 'CNY';
  const cnyText =
    cnyMinor != null ? formatPrice({ CNY: cnyMinor } as Prices, 'CNY', 'zh-CN') : '';

  return (
    <>
      {leadingDivider && (
        <div className="flex items-center gap-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-grey-400">
          <span className="h-px flex-1 bg-grey-300" />
          OR
          <span className="h-px flex-1 bg-grey-300" />
        </div>
      )}

      <div className="rounded-xl bg-grey-50 p-4 ring-1 ring-grey-200">
        <div className="flex items-center gap-2">
          <WeChatPayBadge />
          <p className="font-display text-base font-bold tracking-tight">微信支付</p>
        </div>
        <div className="mt-3 flex flex-col items-center gap-3 border-t border-grey-200 pt-4 sm:flex-row sm:gap-4">
          {/* QR — 위챗 수취 QR 이미지(public/) */}
          <div className="shrink-0 rounded-lg bg-white p-2 ring-1 ring-grey-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={WECHAT_PAY.qrSrc}
              alt="WeChat Pay QR"
              width={144}
              height={144}
              onError={() => setFailed(true)}
              className="h-[144px] w-[144px] object-contain"
            />
          </div>
          {/* 안내 + 수취인 */}
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-xs text-grey-500">
              Scan the QR with WeChat to pay. 请用微信扫码支付。
            </p>
            {WECHAT_PAY.payee && (
              <p className="mt-1.5 text-xs text-grey-400">
                Payee · 收款人{' '}
                <span className="font-medium text-grey-600">{WECHAT_PAY.payee}</span>
              </p>
            )}
          </div>
        </div>

        {/* 위안화 환산 금액 (QR 아래) — 근사 환산이면 ≈ 와 기준 금액을 함께 보여준다 */}
        {cnyText && (
          <div className="mt-3 border-t border-grey-200 pt-3">
            <div className="flex items-center justify-between gap-3">
              <span className="label-caps shrink-0 text-grey-400">Amount · 支付金额</span>
              <span className="font-display text-xl">
                {approx ? '≈ ' : ''}
                {cnyText}
              </span>
            </div>
            {approx && amountText && (
              /* 좁은 폭에서 라벨과 붙어 깨지지 않도록 환산 근거는 아래 줄로 뺀다 */
              <p className="mt-1 text-right text-xs text-grey-400">
                based on {amountText} · approximate rate 汇率为约数
              </p>
            )}
          </div>
        )}

        {/* 위챗 앱으로 바로 열기 — wxp:// 는 위챗이 등록한 스킴이라 앱이 깔린 모바일에서만 열린다.
            데스크톱은 무반응이라, 아래 'QR 이미지 열기'를 항상 함께 남겨 대체 경로를 보장한다. */}
        {WECHAT_PAY.payUrl && (
          <a
            href={WECHAT_PAY.payUrl}
            className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-[#07C160] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#06a854]"
          >
            Open in WeChat · 打开微信
            <ExternalLink size={14} />
          </a>
        )}

        {/* QR 이미지 원본 열기 — 모바일은 자기 화면의 QR 을 스캔할 수 없어서,
            이미지를 열어 저장한 뒤 위챗 '앨범에서 스캔'으로 결제하는 경로를 열어둔다. */}
        <a
          href={WECHAT_PAY.qrSrc}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-grey-200 bg-white px-4 py-2.5 text-sm font-semibold text-grey-700 transition-colors hover:border-[#07C160] hover:text-[#07C160]"
        >
          Open QR image · 打开二维码
          <ExternalLink size={14} />
        </a>
      </div>
    </>
  );
}
