// 주문관리(오거나이저) 렌더 — 서버 page 가 데이터 주입.
// 처리 가능한 범위는 이행(발송/완료)뿐 — 결제확인·취소·환불·삭제는 운영자 전용이다(0036 참조).
// 검색·상태·결제수단 필터는 건수가 많지 않아 클라이언트에서 처리한다.
'use client';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ChevronDown, ChevronRight, Mail, Search, Ticket, Truck } from 'lucide-react';
import { toDisplayAmount, pickI18n, type Currency } from '@123band/shared';
import { useT } from '@/i18n/useT';
import { useGlobalLocale } from '@/lib/i18n/locale-context';
import { cn } from '@/lib/utils';
import { IconButton } from '@/components/ui/IconButton';
import type { PartnerOrderRow, PartnerOrderItem } from '@/lib/queries/partner-orders';
import {
  advanceOrder,
  advanceOrders,
  nextFulfillStep,
  type FulfillTo,
} from '@/lib/queries/partner-order-actions';

const STATUS_KEYS = [
  'pending',
  'awaiting_payment',
  'paid',
  'shipped',
  'done',
  'cancelled',
  'refunded',
] as const;
type StatusKey = (typeof STATUS_KEYS)[number];

// portone 은 PG 교체(2026-08) 이전 주문의 레거시 값 — 과거 주문 표기/필터를 위해 남겨 둔다.
const PAY_KEYS = ['payverse', 'transfer', 'portone'] as const;
type PayKey = (typeof PAY_KEYS)[number];

// 상태 → 배지 톤 (StatusBadge 의 TONE 을 주문 상태 전체로 확장)
const TONE: Record<string, string> = {
  pending: 'bg-live/10 text-live',
  awaiting_payment: 'bg-live/10 text-live',
  paid: 'bg-success/10 text-success',
  shipped: 'bg-success/10 text-success',
  done: 'bg-success/10 text-success',
  cancelled: 'bg-danger/10 text-danger',
  refunded: 'bg-danger/10 text-danger',
};

function fmtMoney(minor: number, currency: string): string {
  const display = toDisplayAmount(minor, currency as Currency);
  try {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: currency as Currency,
      minimumFractionDigits: currency === 'USD' ? 2 : 0,
    }).format(display);
  } catch {
    // 알 수 없는 통화 코드는 코드 + 숫자로
    return `${currency} ${display.toLocaleString()}`;
  }
}

function itemName(it: PartnerOrderItem, locale: 'en' | 'ko'): string {
  const alt = locale === 'ko' ? 'en' : 'ko';
  return (
    pickI18n(it.nameI18n ?? undefined, locale) ||
    pickI18n(it.nameI18n ?? undefined, alt) ||
    it.productName ||
    '—'
  );
}

/** 구매확인 메일을 보낼 수 있는 상태인가 — 결제가 끝난 주문만(서버 0087 과 같은 조건). */
function canResend(status: string | null): boolean {
  return status === 'paid' || status === 'shipped' || status === 'done';
}

/** 'YYYY-MM-DD HH:MM' (로컬 시간). 초는 버린다 — 언제 보냈는지만 알면 된다. */
function fmtSentAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16).replace('T', ' ');
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * 구매확인 메일이 나갔는지 한 줄로. 기록이 없으면 '없다'가 아니라 '기록이 없다'고 적는다 —
 * 발송 기록은 2026-09-11(0089)부터 남기 시작했고, 그 이전 주문은 보냈는데도 기록이 없다.
 */
function mailSentText(row: PartnerOrderRow, t: ReturnType<typeof useT>): string {
  const log = row.mailLog ?? [];
  if (log.length === 0) return t.orders.mailNotSent;
  const last = log[0]!;
  const how =
    last.source === 'manual'
      ? t.orders.mailManual
      : last.source === 'backfill'
        ? t.orders.mailBackfill
        : t.orders.mailAuto;
  const more = log.length > 1 ? t.orders.mailMore(log.length) : '';
  return `${fmtSentAt(last.sentAt)} · ${how} · ${last.toEmail} (${last.locale.toUpperCase()})${more}`;
}

/**
 * 탈퇴한 구매자인가.
 * 거래 이력이 있는 회원이 탈퇴하면 주문은 보존하되 이메일만 묘비값으로 바꾼다
 * (web /api/account/delete → `deleted+{uuid}@deleted.invalid`). 형태가 이메일이라
 * 화면에서는 멀쩡한 주소처럼 보이지만 실제로는 받는 곳이 없는 주소다.
 */
function isDeletedBuyer(email: string | null): boolean {
  return (email ?? '').trim().toLowerCase().endsWith('@deleted.invalid');
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5">
      <span className="w-28 shrink-0 label-caps text-grey-400">{label}</span>
      <span className="min-w-0 flex-1 break-words text-sm text-grey-700">{children}</span>
    </div>
  );
}

// 선택 체크박스. indeterminate 는 DOM 프로퍼티라 ref 로만 설정된다(속성 없음).
function SelectBox({
  checked,
  indeterminate,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const partial = !!indeterminate && !checked;
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = partial;
  }, [partial]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      aria-label={label}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      className="h-4 w-4 cursor-pointer accent-black"
    />
  );
}

export function OrdersView({ rows }: { rows: PartnerOrderRow[] }) {
  const t = useT();
  const router = useRouter();
  const locale = (useGlobalLocale().locale ?? 'en') as 'en' | 'ko';
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [pay, setPay] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const statusLabel = (s: string | null) => (s ? t.orderStatus[s as StatusKey] ?? s : '—');
  const payLabel = (p: string | null) => (p ? t.payMethod[p as PayKey] ?? p : '—');

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status && r.status !== status) return false;
      if (pay && r.paymentMethod !== pay) return false;
      if (!term) return true;
      const hay = [
        r.orderNo ?? '',
        r.buyerName ?? '',
        r.buyerEmail ?? '',
        ...r.items.map((it) => itemName(it, locale)),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(term);
    });
  }, [rows, q, status, pay, locale]);

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // 선택은 '현재 보이는 행' 기준. 필터를 바꿔 사라진 행이 몰래 처리되지 않도록 교집합만 유지한다.
  const selected = useMemo(
    () => filtered.filter((r) => picked.has(r.id)),
    [filtered, picked],
  );
  const allPicked = filtered.length > 0 && selected.length === filtered.length;
  const shipCount = selected.filter((r) => nextFulfillStep(r.status) === 'shipped').length;
  const doneCount = selected.filter((r) => nextFulfillStep(r.status) === 'done').length;

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setPicked(allPicked ? new Set() : new Set(filtered.map((r) => r.id)));
  }

  // 단건 처리 — 서버가 소유·전이를 재검증하므로 실패는 그대로 사용자에게 알린다.
  async function runOne(row: PartnerOrderRow, to: FulfillTo) {
    if (busy) return;
    setBusy(true);
    try {
      await advanceOrder(row.id, to);
      router.refresh();
    } catch (e) {
      window.alert(`${t.orders.actionFailed}\n\n${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  // 구매확인 메일 재발송 — 결제완료 이후 주문만. 서버(RPC 0087)가 판매자·상태를 다시 검증한다.
  async function resendMail(row: PartnerOrderRow) {
    if (busy) return;
    const email = (row.buyerEmail ?? '').trim();
    // 두 경우를 같은 문구로 묶으면 '이메일이 화면에 보이는데 없다고 한다'가 된다 — 따로 알린다.
    if (isDeletedBuyer(email)) {
      window.alert(t.orders.resendDeletedBuyer);
      return;
    }
    if (!email || !email.includes('@')) {
      window.alert(t.orders.resendNoEmail);
      return;
    }
    if (!window.confirm(t.orders.resendConfirm(row.orderNo ?? row.id, email))) return;

    setBusy(true);
    try {
      const res = await fetch('/api/orders/resend-confirmation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId: row.id }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; email?: string };
      if (!res.ok) throw new Error(json.error || String(res.status));
      window.alert(t.orders.resendSent(json.email ?? email));
      router.refresh(); // 방금 남긴 발송 기록이 주문 상세에 바로 보이도록
    } catch (e) {
      window.alert(`${t.orders.resendFailed}

${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function runBulk(to: FulfillTo) {
    if (busy || !selected.length) return;
    const eligible = selected.filter((r) => nextFulfillStep(r.status) === to);
    const confirm = to === 'shipped' ? t.orders.confirmShip : t.orders.confirmDone;
    if (!window.confirm(confirm(eligible.length))) return;

    setBusy(true);
    try {
      const res = await advanceOrders(selected, to);
      const msgs: string[] = [];
      if (res.done) msgs.push(t.orders.bulkDone_(res.done));
      if (res.skipped.length) msgs.push(t.orders.bulkSkipped(res.skipped.length));
      if (res.failed.length) {
        const nos = selected
          .filter((r) => res.failed.includes(r.id))
          .map((r) => r.orderNo ?? r.id)
          .join(', ');
        msgs.push(`${t.orders.bulkFailed(res.failed.length)} (${nos})`);
      }
      if (msgs.length) window.alert(msgs.join('\n'));
      setPicked(new Set());
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  // 처리 버튼·펼친 상세는 표(태블릿 이상)와 카드(폰)가 같은 것을 쓴다.
  const actionsOf = (r: PartnerOrderRow, step: ReturnType<typeof nextFulfillStep>) => (
                          <div className="flex items-center gap-1.5">
                            {step ? (
                              <IconButton
                                icon={step === 'shipped' ? Truck : CheckCircle2}
                                label={step === 'shipped' ? t.orders.toShipped : t.orders.toDone}
                                disabled={busy}
                                onClick={() => runOne(r, step)}
                              />
                            ) : (
                              !canResend(r.status) && (
                                <span className="whitespace-nowrap text-xs text-grey-400">
                                  {t.orders.noAction}
                                </span>
                              )
                            )}
                            {/* 확인서 재발송 — 결제완료 이후에만. 스팸함/삭제로 못 받은 구매자에게 다시 보낸다. */}
                            {canResend(r.status) && (
                              <IconButton
                                icon={Mail}
                                label={
                                  isDeletedBuyer(r.buyerEmail)
                                    ? t.orders.resendDeletedBuyer
                                    : t.orders.resendMail
                                }
                                disabled={busy || isDeletedBuyer(r.buyerEmail)}
                                onClick={() => resendMail(r)}
                              />
                            )}
                          </div>
  );

  const detailOf = (r: PartnerOrderRow) => (
                            <div className="grid gap-4 md:grid-cols-2">
                              <section className="rounded-lg border border-grey-200 p-3">
                                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-grey-500">
                                  {t.orders.detailOrder}
                                </h3>
                                <Row label={t.orders.colOrderNo}>{r.orderNo ?? '—'}</Row>
                                <Row label={t.orders.mailSentLabel}>{mailSentText(r, t)}</Row>
                                <Row label={t.orders.colOrderDate}>
                                  {r.createdAt ? String(r.createdAt).slice(0, 19).replace('T', ' ') : '—'}
                                </Row>
                                <Row label={t.orders.colStatus}>{statusLabel(r.status)}</Row>
                                <Row label={t.orders.colPayment}>{payLabel(r.paymentMethod)}</Row>
                                <Row label={t.orders.orderTotal}>
                                  {r.totalAmount != null && r.currency
                                    ? fmtMoney(r.totalAmount, r.currency)
                                    : '—'}
                                  {r.displayCurrency && r.displayTotal != null && (
                                    <span className="ml-2 text-xs text-grey-400">
                                      ({t.orders.paidIn} {fmtMoney(r.displayTotal, r.displayCurrency)})
                                    </span>
                                  )}
                                </Row>
                              </section>

                              <section className="rounded-lg border border-grey-200 p-3">
                                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-grey-500">
                                  {t.orders.detailBuyer}
                                </h3>
                                <Row label={t.orders.buyerName}>{r.buyerName ?? '—'}</Row>
                                <Row label={t.orders.buyerEmail}>
                                  {isDeletedBuyer(r.buyerEmail) ? (
                                    <span className="text-grey-400">{t.orders.deletedBuyer}</span>
                                  ) : (
                                    r.buyerEmail ?? '—'
                                  )}
                                </Row>
                              </section>

                              <section className="rounded-lg border border-grey-200 p-3 md:col-span-2">
                                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-grey-500">
                                  {t.orders.myItems(r.items.length)}
                                </h3>
                                <ul className="divide-y divide-grey-100">
                                  {r.items.map((it) => (
                                    <li key={it.id} className="flex items-start justify-between gap-3 py-2">
                                      <div className="min-w-0">
                                        <p className="truncate text-sm text-grey-800">
                                          {itemName(it, locale)}
                                        </p>
                                        {it.ticketLabel && (
                                          <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-primary">
                                            <Ticket size={12} aria-hidden />
                                            <span className="truncate">{it.ticketLabel}</span>
                                          </p>
                                        )}
                                        <p className="text-xs text-grey-500">
                                          {fmtMoney(it.unitPrice, it.currency)} × {it.qty}
                                        </p>
                                      </div>
                                      <span className="shrink-0 text-sm font-medium text-grey-800">
                                        {fmtMoney(it.lineAmount, it.currency)}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                                <div className="mt-2 flex justify-between border-t border-grey-200 pt-2 text-sm">
                                  <span className="text-grey-500">{t.orders.mySubtotal}</span>
                                  <span className="font-medium text-grey-900">
                                    {fmtMoney(r.myAmount, r.myCurrency)}
                                  </span>
                                </div>
                              </section>
                            </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl uppercase tracking-tight">{t.orders.title}</h1>
          <p className="mt-1 text-sm text-grey-500">{t.orders.subtitle}</p>
        </div>
        <span className="label-caps text-grey-500">{t.orders.count(filtered.length)}</span>
      </div>

      {/* 필터 — 주문번호·구매자·상품명 검색 + 상태/결제수단 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.orders.searchPh}
            className="w-full rounded-pill border border-grey-200 py-2 pl-9 pr-4 text-sm outline-none focus:border-grey-400"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-pill border border-grey-200 px-4 py-2 text-sm outline-none focus:border-grey-400"
        >
          <option value="">{`${t.orders.colStatus}: ${t.common.all}`}</option>
          {STATUS_KEYS.map((s) => (
            <option key={s} value={s}>
              {t.orderStatus[s]}
            </option>
          ))}
        </select>
        <select
          value={pay}
          onChange={(e) => setPay(e.target.value)}
          className="rounded-pill border border-grey-200 px-4 py-2 text-sm outline-none focus:border-grey-400"
        >
          <option value="">{`${t.orders.colPayment}: ${t.common.all}`}</option>
          {PAY_KEYS.map((p) => (
            <option key={p} value={p}>
              {t.payMethod[p]}
            </option>
          ))}
        </select>
      </div>

      {/* 선택 바 — 선택된 주문 중 해당 전이가 가능한 건만 처리한다(불가 건은 결과에서 건너뜀으로 보고). */}
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-grey-200 bg-grey-50 px-4 py-2.5">
          <span className="text-sm font-medium text-grey-700">
            {t.orders.selected(selected.length)}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || shipCount === 0}
              onClick={() => runBulk('shipped')}
              className="inline-flex items-center gap-1.5 rounded-pill border border-grey-300 bg-white px-3 py-1.5 text-sm text-grey-700 transition-colors hover:border-grey-400 disabled:opacity-40"
            >
              <Truck size={14} /> {busy ? t.orders.working : t.orders.bulkShip(shipCount)}
            </button>
            <button
              type="button"
              disabled={busy || doneCount === 0}
              onClick={() => runBulk('done')}
              className="inline-flex items-center gap-1.5 rounded-pill border border-grey-300 bg-white px-3 py-1.5 text-sm text-grey-700 transition-colors hover:border-grey-400 disabled:opacity-40"
            >
              <CheckCircle2 size={14} /> {busy ? t.orders.working : t.orders.bulkDone(doneCount)}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setPicked(new Set())}
              className="px-2 py-1.5 text-sm text-grey-500 underline-offset-2 hover:underline disabled:opacity-40"
            >
              {t.orders.clearSelection}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-grey-200">
        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-grey-500">
            {rows.length === 0 ? t.orders.empty : t.orders.noMatch}
          </p>
        ) : (
          <>
          {/* 폰: 카드 목록 — 주문번호·상태를 머리에, 상품·구매자·결제·날짜를 아래에. 누르면 상세가 펼쳐진다. */}
          <ul className="md:hidden">
            <li className="flex items-center gap-2 border-b border-grey-200 bg-grey-50 px-4 py-2 text-xs text-grey-600">
              <SelectBox
                checked={allPicked}
                indeterminate={selected.length > 0}
                label={t.orders.selectAll}
                onChange={toggleAll}
              />
              {t.orders.selectAll}
            </li>
            {filtered.map((r) => {
              const expanded = open.has(r.id);
              const first = r.items[0];
              const more = r.items.length - 1;
              const step = nextFulfillStep(r.status);
              return (
                <li key={r.id} className="border-b border-grey-100 last:border-0">
                  <div className="flex gap-3 px-4 py-3" onClick={() => toggle(r.id)}>
                    <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                      <SelectBox
                        checked={picked.has(r.id)}
                        label={t.orders.selectRow}
                        onChange={() => togglePick(r.id)}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-grey-800">{r.orderNo ?? '—'}</span>
                        <span
                          className={cn(
                            'shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-medium uppercase tracking-tight',
                            TONE[r.status ?? ''] ?? 'bg-grey-100 text-grey-700',
                          )}
                        >
                          {statusLabel(r.status)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-grey-700">
                        {first ? itemName(first, locale) : '—'}
                        {more > 0 && <span className="ml-1 text-grey-400">{t.orders.moreItems(more)}</span>}
                      </p>
                      <p className="mt-0.5 text-xs text-grey-500">
                        {r.buyerName ?? r.buyerEmail ?? '—'} · {payLabel(r.paymentMethod)} ·{' '}
                        {r.createdAt ? String(r.createdAt).slice(0, 10) : '—'}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-grey-800">
                          {fmtMoney(r.myAmount, r.myCurrency)}{' '}
                          <span className="text-xs font-normal text-grey-400">× {r.myQty}</span>
                        </span>
                        <div onClick={(e) => e.stopPropagation()}>{actionsOf(r, step)}</div>
                      </div>
                    </div>
                    <ChevronDown
                      size={16}
                      className={cn('mt-1 shrink-0 text-grey-400 transition-transform', expanded && 'rotate-180')}
                    />
                  </div>
                  {expanded && <div className="border-t border-grey-100 bg-grey-50/60 px-4 py-3">{detailOf(r)}</div>}
                </li>
              );
            })}
          </ul>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-grey-200 bg-grey-50 text-left">
                <tr>
                  <th className="w-10 px-3 py-2.5">
                    <SelectBox
                      checked={allPicked}
                      indeterminate={selected.length > 0}
                      label={t.orders.selectAll}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="w-9 px-2 py-2.5" />
                  <th className="px-4 py-2.5 font-medium">{t.orders.colOrderNo}</th>
                  <th className="px-4 py-2.5 font-medium">{t.orders.colBuyer}</th>
                  <th className="px-4 py-2.5 font-medium">{t.orders.colProduct}</th>
                  <th className="px-4 py-2.5 font-medium">{t.orders.colStatus}</th>
                  <th className="px-4 py-2.5 font-medium">{t.orders.colPayment}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t.orders.colQty}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t.orders.colAmount}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t.orders.colOrderDate}</th>
                  <th className="px-4 py-2.5 font-medium">{t.orders.colActions}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const expanded = open.has(r.id);
                  const first = r.items[0];
                  const more = r.items.length - 1;
                  const step = nextFulfillStep(r.status);
                  return (
                    <Fragment key={r.id}>
                      <tr
                        onClick={() => toggle(r.id)}
                        className={cn(
                          'cursor-pointer border-b border-grey-100 hover:bg-grey-50',
                          expanded && 'bg-grey-50',
                        )}
                      >
                        <td className="px-3 py-2.5">
                          <SelectBox
                            checked={picked.has(r.id)}
                            label={t.orders.selectRow}
                            onChange={() => togglePick(r.id)}
                          />
                        </td>
                        <td className="px-2 py-2.5 text-grey-400">
                          <button
                            type="button"
                            aria-expanded={expanded}
                            aria-label={t.orders.toggleDetail}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggle(r.id);
                            }}
                          >
                            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 font-medium text-grey-800">
                          {r.orderNo ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-grey-700">
                          {r.buyerName ?? r.buyerEmail ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-grey-700">
                          {first ? itemName(first, locale) : '—'}
                          {more > 0 && (
                            <span className="ml-1 text-grey-400">{t.orders.moreItems(more)}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={cn(
                              'inline-flex items-center whitespace-nowrap rounded-pill px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-tight',
                              TONE[r.status ?? ''] ?? 'bg-grey-100 text-grey-700',
                            )}
                          >
                            {statusLabel(r.status)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-grey-600">
                          {payLabel(r.paymentMethod)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-grey-700">{r.myQty}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium text-grey-800">
                          {fmtMoney(r.myAmount, r.myCurrency)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right text-grey-400">
                          {r.createdAt ? String(r.createdAt).slice(0, 10) : '—'}
                        </td>
                        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                          {actionsOf(r, step)}
                        </td>
                      </tr>

                      {expanded && (
                        <tr className="border-b border-grey-100 bg-white">
                          <td colSpan={11} className="px-4 py-4 sm:px-10">
                            {detailOf(r)}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
      <p className="text-xs text-grey-400">{t.orders.footnote}</p>
    </div>
  );
}
