// 내 QR — "하트 받기" 쪽. 상대가 이 코드를 찍으면 나에게 하트를 보낼 수 있다.
// QR 값은 프로덕션 도메인 기준 절대 URL 이어야 한다(남의 폰에서 열리는 주소라
// localhost/미리보기 도메인이 들어가면 안 된다). 미들웨어가 경로를 소문자로 정규화하므로
// 처음부터 소문자로 만들어 불필요한 308 을 피한다.
'use client';
import { useState } from 'react';
import QRCode from 'react-qr-code';
import { Check, Copy } from 'lucide-react';
import type { Dictionary } from '@/i18n/dictionaries';

export function MyQrCard({
  locale,
  code,
  siteUrl,
  t,
}: {
  locale: string;
  code: string | null;
  siteUrl: string;
  t: Dictionary['social'];
}) {
  const [copied, setCopied] = useState(false);
  if (!code) return null;

  const shareUrl = `${siteUrl}/${locale}/u/${code.toLowerCase()}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // 클립보드 권한이 없으면 조용히 무시 — QR 자체로 공유 가능
    }
  }

  return (
    <div className="flex flex-col items-center rounded-xl border border-grey-200 bg-white p-5 text-center">
      <h3 className="font-display text-lg">{t.receiveTitle}</h3>
      <p className="mt-1 text-xs text-grey-500">{t.receiveHint}</p>

      {/* 폰에서 상대가 바로 찍게 카드 폭에 맞춰 크게 그린다(최대 16rem). 고정 148px 은 팔 길이에서 작았다. */}
      <div className="mt-4 w-full max-w-[16rem] rounded-lg border border-grey-200 bg-white p-3">
        <QRCode
          value={shareUrl}
          size={256}
          viewBox="0 0 256 256"
          style={{ width: '100%', height: 'auto' }}
        />
      </div>

      <p className="mt-3 font-mono text-sm tracking-[0.2em] text-grey-600">{code}</p>

      <button type="button" onClick={copyLink} className="btn btn-secondary btn-sm mt-3">
        {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
        {copied ? t.copied : t.copyLink}
      </button>
    </div>
  );
}
