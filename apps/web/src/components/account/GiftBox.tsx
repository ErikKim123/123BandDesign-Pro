// 선물함 — 3탭 UI. (1) 선물하기: 내가 구매한 패스를 친구 이메일로 보냄 (2) 선물한: 보낸 이력
// (3) 선물받은: 타인이 보낸 패스 + 입장 QR. 보내기는 /api/gifts(POST) → send_gift RPC.
'use client';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Gift, Send, X, Package, Ticket, ArrowRight, Inbox, Clock } from 'lucide-react';
import { pickI18n, type Locale } from '@123band/shared';
import type { Dictionary } from '@/i18n/dictionaries';
import type { GiftableItem, SentGift, ReceivedGift } from '@/lib/queries/gifts';
import { storageThumb } from '@/lib/image';

type GiftLabels = Dictionary['gifts'];
type Tab = 'giftable' | 'sent' | 'received';

export function GiftBox({
  t,
  locale,
  giftable,
  sent,
  received,
}: {
  t: GiftLabels;
  locale: Locale;
  giftable: GiftableItem[];
  sent: SentGift[];
  received: ReceivedGift[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(
    giftable.length ? 'giftable' : received.length ? 'received' : 'giftable',
  );
  const [dialog, setDialog] = useState<GiftableItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  // 받기 결과를 바로 반영하기 위한 사본 — 종전에는 router.refresh() 로 페이지를 다시 그려야
  // '이동 완료'로 바뀌었다. 서버 왕복이 끝날 때까지 목록은 누르기 전 그대로였다.
  const [receivedNow, setReceivedNow] = useState(received);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const flashToast = (msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  // 선물 받기 — '내 주문으로 이동'. 성공 시 주문내역에 QR 이 뜨고, 이력은 이동 완료로 바뀐다.
  const claim = async (giftId: string) => {
    if (moving) return;
    setMoving(giftId);
    try {
      const res = await fetch('/api/gifts/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ giftId }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        flashToast((t.err as Record<string, string>)[json.error ?? 'error'] ?? t.err.error);
        return;
      }
      flashToast(t.moved);
      // 이 화면에서 바뀌는 건 해당 항목의 '받기 완료' 표시뿐이다 → 지역 상태로 즉시 반영.
      setReceivedNow((prev) => prev.map((g) => (g.id === giftId ? { ...g, claimed: true } : g)));
      // 주문내역(다른 화면)의 '선물받은 패스'까지 맞추기 위해 갱신은 계속 건다.
      // 화면은 위에서 이미 바뀌었으므로 이게 늦어도 사용자는 기다리지 않는다.
      router.refresh();
    } catch {
      flashToast(t.err.error);
    } finally {
      setMoving(null);
    }
  };

  const nameOf = (i18n: Parameters<typeof pickI18n>[0]) => pickI18n(i18n, locale) || '—';
  const dateOf = (iso: string) => String(iso).slice(0, 10);
  // 패스 상세 페이지 경로 (상품 id 있을 때만)
  const productHref = (id?: string | null) => (id ? `/${locale}/products/${id}` : null);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'giftable', label: t.tabGiftable, count: giftable.length },
    { key: 'sent', label: t.tabSent, count: sent.length },
    { key: 'received', label: t.tabReceived, count: receivedNow.length },
  ];

  return (
    <div>
      {/* 탭 */}
      <div className="mb-5 flex gap-1 rounded-lg border border-grey-200 bg-grey-50 p-1">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            type="button"
            onClick={() => setTab(tb.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium transition-colors ${
              tab === tb.key ? 'bg-white text-primary shadow-1' : 'text-grey-500 hover:text-grey-700'
            }`}
          >
            <span className="truncate">{tb.label}</span>
            {tb.count > 0 && (
              <span
                className={`rounded-pill px-1.5 text-xs font-semibold ${
                  tab === tb.key ? 'bg-primary/10 text-primary' : 'bg-grey-200 text-grey-500'
                }`}
              >
                {tb.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <p className="mb-3 text-xs text-grey-400">
        {tab === 'giftable' ? t.giftableDesc : tab === 'sent' ? t.sentDesc : t.receivedDesc}
      </p>

      {/* 1) 선물하기 목록 — 내가 구매한 패스 */}
      {tab === 'giftable' &&
        (giftable.length === 0 ? (
          <Empty icon={<Ticket size={22} />} text={t.emptyGiftable} />
        ) : (
          <ul className="space-y-3">
            {giftable.map((g) => (
              <li
                key={g.orderItemId}
                className="flex items-center gap-3 rounded-xl border border-grey-200 bg-white p-3 shadow-1"
              >
                <Thumb
                  url={g.product?.image_url}
                  alt={nameOf(g.product?.name_i18n)}
                  href={productHref(g.product?.id)}
                />
                <div className="min-w-0 flex-1">
                  {g.orderNo && (
                    <p className="truncate font-mono text-[11px] text-grey-400">
                      {t.orderLabel} {g.orderNo}
                    </p>
                  )}
                  <p className="truncate font-medium text-grey-900">{nameOf(g.product?.name_i18n)}</p>
                  <p className="mt-0.5 text-xs text-grey-500">
                    {t.available}{' '}
                    <span className="font-semibold text-primary">
                      {g.available}
                      {t.unit}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDialog(g)}
                  className="btn btn-primary btn-sm shrink-0 gap-1.5"
                >
                  <Gift size={15} /> {t.sendBtn}
                </button>
              </li>
            ))}
          </ul>
        ))}

      {/* 2) 선물한 목록 — 보낸 이력 */}
      {tab === 'sent' &&
        (sent.length === 0 ? (
          <Empty icon={<Send size={22} />} text={t.emptySent} />
        ) : (
          <ul className="space-y-3">
            {sent.map((g) => (
              <li key={g.id} className="rounded-xl border border-grey-200 bg-white p-4 shadow-1">
                <div className="flex items-start gap-3">
                  <Thumb
                    url={g.product?.image_url}
                    alt={nameOf(g.product?.name_i18n ?? g.nameI18n)}
                    href={productHref(g.product?.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate font-medium text-grey-900">
                        {nameOf(g.product?.name_i18n ?? g.nameI18n)}
                      </p>
                      <span className="flex shrink-0 items-center gap-1 text-xs text-grey-400">
                        <Clock size={12} /> {dateOf(g.createdAt)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-grey-600">
                      <span className="inline-flex items-center gap-1">
                        {t.to}
                        <ArrowRight size={13} className="text-grey-400" />
                        <span className="font-medium text-ink">{g.recipientName || g.recipientEmail}</span>
                      </span>
                      <span className="rounded-pill bg-cream px-2 py-0.5 text-xs font-semibold text-primary">
                        {g.qty}
                        {t.unit}
                      </span>
                    </div>
                  </div>
                </div>
                {g.message && (
                  <p className="mt-3 rounded-lg bg-grey-50 px-3 py-2 text-sm text-grey-600">“{g.message}”</p>
                )}
              </li>
            ))}
          </ul>
        ))}

      {/* 3) 선물받은 이력 — 받기(내 주문으로 이동) 전엔 QR 없음(문구). 이동하면 주문내역에 QR 이 뜬다. */}
      {tab === 'received' &&
        (receivedNow.length === 0 ? (
          <Empty icon={<Inbox size={22} />} text={t.emptyReceived} />
        ) : (
          <ul className="space-y-4">
            {receivedNow.map((g) => (
              <li key={g.id} className="rounded-xl border border-grey-200 bg-white p-4 shadow-1">
                <div className="flex items-center gap-3">
                  <Thumb
                    url={g.product?.image_url}
                    alt={nameOf(g.product?.name_i18n ?? g.nameI18n)}
                    href={productHref(g.product?.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="mb-1 inline-flex items-center gap-1 rounded-pill bg-cream px-2 py-0.5 text-[11px] font-semibold text-primary">
                      <Inbox size={11} /> {t.receivedBadge}
                    </span>
                    <p className="truncate font-medium text-grey-900">
                      {nameOf(g.product?.name_i18n ?? g.nameI18n)}
                    </p>
                    {g.orderNo && (
                      <p className="truncate font-mono text-[11px] text-grey-400">
                        {t.orderLabel} {g.orderNo}
                      </p>
                    )}
                    <p className="mt-0.5 text-sm text-grey-600">
                      {t.from} <span className="font-medium text-ink">{g.senderName || '—'}</span>
                      <span className="ml-2 rounded-pill bg-grey-100 px-2 py-0.5 text-xs font-semibold text-grey-600">
                        {g.qty}
                        {t.unit}
                      </span>
                    </p>
                  </div>
                </div>
                {g.message && (
                  <p className="mt-2 rounded-lg bg-grey-50 px-3 py-2 text-sm text-grey-600">“{g.message}”</p>
                )}

                {/* 받기(이동) 전: 문구 + 버튼 / 받은 뒤: 이동 완료 + 주문내역 링크 */}
                <div className="mt-3 border-t border-grey-100 pt-3">
                  {g.claimed ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                        <ArrowRight size={15} /> {t.moved}
                      </span>
                      <Link
                        href={`/${locale}/account/orders`}
                        className="btn btn-secondary btn-sm gap-1.5"
                      >
                        {t.viewOrders}
                      </Link>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-grey-500">{t.moveHint}</p>
                      <button
                        type="button"
                        disabled={moving === g.id}
                        onClick={() => void claim(g.id)}
                        className="btn btn-primary btn-sm shrink-0 gap-1.5"
                      >
                        <ArrowRight size={15} /> {moving === g.id ? t.moving : t.moveBtn}
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ))}

      {/* 보내기 다이얼로그 */}
      {dialog && (
        <SendGiftDialog
          item={dialog}
          t={t}
          nameOf={nameOf}
          onClose={() => setDialog(null)}
          onSent={() => {
            setDialog(null);
            flashToast(t.sentOk);
            router.refresh();
          }}
        />
      )}

      {/* 토스트 */}
      {toast &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[80] flex justify-center px-4">
            <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-white shadow-2">
              <Gift size={16} className="text-sunshine-500" />
              <span>{toast}</span>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function Thumb({ url, alt, href }: { url?: string | null; alt: string; href?: string | null }) {
  const inner = (
    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-grey-100">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={storageThumb(url, 160)} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <Package size={24} className="text-grey-300" aria-hidden />
      )}
    </div>
  );
  // 이미지 클릭 → 패스 상세 페이지
  return href ? (
    <Link href={href} className="shrink-0 transition hover:opacity-80" aria-label={alt}>
      {inner}
    </Link>
  ) : (
    <div className="shrink-0">{inner}</div>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-grey-200 py-14 text-grey-400">
      {icon}
      <p className="text-sm">{text}</p>
    </div>
  );
}

function SendGiftDialog({
  item,
  t,
  nameOf,
  onClose,
  onSent,
}: {
  item: GiftableItem;
  t: GiftLabels;
  nameOf: (i18n: Parameters<typeof pickI18n>[0]) => string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [email, setEmail] = useState('');
  const [qty, setQty] = useState(1);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setError(null);
    if (!email.trim()) {
      setError((t.err as Record<string, string>).recipient_required ?? t.err.error);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/gifts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orderItemId: item.orderItemId,
          email: email.trim(),
          qty,
          message: message.trim(),
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError((t.err as Record<string, string>)[json.error ?? 'error'] ?? t.err.error);
        return;
      }
      onSent();
    } catch {
      setError(t.err.error);
    } finally {
      setBusy(false);
    }
  };

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
      <div aria-hidden onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-cream text-primary">
              <Gift size={16} />
            </span>
            <div>
              <h2 className="text-base font-bold text-ink">{t.dialogTitle}</h2>
              <p className="max-w-[16rem] truncate text-xs text-grey-500">{nameOf(item.product?.name_i18n)}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={t.cancel} className="-mr-1 p-1 text-grey-500 hover:text-ink">
            <X size={20} />
          </button>
        </div>

        <label className="label-caps text-grey-500">{t.emailLabel}</label>
        <input
          type="email"
          autoFocus
          className="input mt-1.5"
          placeholder={t.emailPh}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
        />

        {item.available > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <span className="label-caps text-grey-500">{t.qtyLabel}</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-grey-300 text-grey-600 hover:border-grey-400 disabled:opacity-40"
                disabled={qty <= 1}
                aria-label="-"
              >
                −
              </button>
              <span className="w-6 text-center font-semibold">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((q) => Math.min(item.available, q + 1))}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-grey-300 text-grey-600 hover:border-grey-400 disabled:opacity-40"
                disabled={qty >= item.available}
                aria-label="+"
              >
                +
              </button>
            </div>
          </div>
        )}

        <label className="label-caps mt-4 block text-grey-500">{t.messageLabel}</label>
        <textarea
          className="input mt-1.5 min-h-[72px] resize-none"
          placeholder={t.messagePh}
          maxLength={500}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        {error && <p className="mt-3 rounded-lg bg-danger/5 px-3 py-2 text-sm font-medium text-danger">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
            {t.cancel}
          </button>
          <button type="button" onClick={() => void submit()} disabled={busy} className="btn btn-primary flex-1 gap-1.5">
            <Send size={16} /> {busy ? t.sending : t.send}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
