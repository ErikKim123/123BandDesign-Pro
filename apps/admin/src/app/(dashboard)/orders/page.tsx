// Design Ref: §5.4 주문관리 — 목록 + 상태 전이(결제/발송/완료/취소/환불) + 상세 드로어(읽기)
'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tr } from '@/i18n/tr';
import { fmt } from '@/i18n/dict';
import type { ColumnDef } from '@tanstack/react-table';
import { ResourceListPage } from '@/components/resource/ResourceListPage';
import { ResourceFormPage } from '@/components/resource/ResourceFormPage';
import { FormDrawer } from '@/components/resource/FormDrawer';
import { OrderDetail } from '@/components/order/OrderDetail';
import {
  useStatusTransition,
  useResourceDelete,
  useResourceBulkDelete,
} from '@/lib/queries/resource';
import { ordersConfig, ORDER_TRANSITIONS, type OrderRow } from '@/lib/resource/configs/orders';
import { useT } from '@/lib/locale/LocaleContext';
import { IconButton } from '@/components/ui/IconButton';
import { ORDER_TRANSITION_ICON } from '@/components/ui/actionIcons';
import { CheckCircle2, Trash2 } from 'lucide-react';

/**
 * 환불은 단순 상태 변경이 아니다 — 서버(/api/orders/refund)가 PayVerse 취소를 먼저 호출하고
 * 성공했을 때만 주문을 'refunded' 로 바꾼다. 실패하면 상태를 그대로 두고 사유를 알린다.
 */
function useOrderRefund() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch('/api/orders/refund', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        orderNo?: string;
        pgCancelled?: boolean;
        alreadyRefunded?: boolean;
        manual?: 'none' | 'legacy_pg' | 'transfer';
      };
      if (!res.ok) throw new Error(json.error ?? tr('환불 처리에 실패했습니다.'));
      return json;
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      if (r.alreadyRefunded) return;
      const no = r.orderNo ?? '';
      window.alert(
        r.pgCancelled
          ? fmt(tr('주문 {no} 을(를) 환불했습니다. (PG 취소 완료)'), { no })
          : r.manual === 'legacy_pg'
            ? fmt(
                tr(
                  "주문 {no} 을(를) '환불'로 변경했습니다.\n이전 PG(PortOne) 로 결제된 건이라 자동 취소가 되지 않습니다 — 해당 PG 관리자에서 직접 취소해 주세요.",
                ),
                { no },
              )
            : fmt(
                tr("주문 {no} 을(를) '환불'로 변경했습니다.\n카드 결제가 아니므로 환급(계좌이체)은 직접 처리해 주세요."),
                { no },
              ),
      );
    },
    onError: (err) => {
      window.alert(err instanceof Error ? err.message : tr('환불 처리에 실패했습니다.'));
    },
  });
}

function OrderActions({ row }: { row: OrderRow }) {
  const t = useT();
  const transition = useStatusTransition('orders', 'orders');
  const del = useResourceDelete('orders', 'orders');
  const refund = useOrderRefund();
  const allowed = ORDER_TRANSITIONS[row.status] ?? [];
  const busy = transition.isPending || del.isPending || refund.isPending;

  // 환불만 별도 경로 — 돈이 오가므로 확인을 받고, PG 취소까지 서버에 맡긴다.
  function onTransition(to: string) {
    if (to !== 'refunded') {
      transition.mutate({ id: row.id, status: to });
      return;
    }
    if (
      window.confirm(
        fmt(tr('주문 {no} 을(를) 환불하시겠어요?\n결제된 금액이 PG(PayVerse)에서 즉시 취소됩니다.'), {
          no: row.order_no,
        }),
      )
    )
      refund.mutate(row.id);
  }
  // to(status) → 툴팁 라벨(EN/KO)
  const tip: Record<string, string> = {
    paid: t.actions.orderPaid,
    cancelled: t.actions.orderCancel,
    shipped: t.actions.orderShip,
    refunded: t.actions.orderRefund,
    done: t.actions.orderDone,
  };
  // 주문 완전 삭제 — 항목/배송은 FK 연쇄로 함께 삭제. 되돌릴 수 없음(매출/정산 기록 소멸).
  // 회원 탈퇴가 주문 참조로 막힐 때 이 삭제로 해소한다.
  return (
    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
      {allowed.map((tr) => (
        <IconButton
          key={tr.to}
          icon={ORDER_TRANSITION_ICON[tr.to] ?? CheckCircle2}
          label={tip[tr.to] ?? tr.label}
          danger={tr.to === 'cancelled' || tr.to === 'refunded'}
          disabled={busy}
          onClick={() => onTransition(tr.to)}
        />
      ))}
      <IconButton
        icon={Trash2}
        label={t.actions.delete}
        danger
        disabled={busy}
        onClick={() => {
          if (
            window.confirm(
              fmt(tr("주문 '{no}' 을(를) 완전 삭제하시겠어요?\n주문 항목·배송 기록까지 함께 삭제되며 되돌릴 수 없습니다."), { no: row.order_no }),
            )
          )
            del.mutate(row.id);
        }}
      />
    </div>
  );
}

// 선택 삭제 바 — 선택된 주문들을 일괄 완전 삭제(항목·배송 연쇄 삭제).
function OrdersBulkBar({ selected, clear }: { selected: OrderRow[]; clear: () => void }) {
  const bulk = useResourceBulkDelete('orders', 'orders');

  async function onDelete() {
    if (!selected.length) return;
    if (
      !window.confirm(
        fmt(tr('선택한 {n}건의 주문을 완전 삭제하시겠어요?\n주문 항목·배송 기록까지 함께 삭제되며 되돌릴 수 없습니다.'), { n: selected.length }),
      )
    )
      return;
    const res = await bulk.mutateAsync(selected.map((o) => o.id));
    clear();
    const msgs: string[] = [];
    if (res.deleted) msgs.push(fmt(tr('{n}건 삭제됨'), { n: res.deleted }));
    if (res.blocked.length) {
      const nos = selected.filter((o) => res.blocked.includes(o.id)).map((o) => o.order_no);
      msgs.push(fmt(tr('참조가 있어 삭제 불가 ({names})'), { names: nos.join(', ') }));
    }
    if (res.failed.length) {
      const nos = selected.filter((o) => res.failed.includes(o.id)).map((o) => o.order_no);
      msgs.push(fmt(tr('삭제 실패 ({names})'), { names: nos.join(', ') }));
    }
    if (msgs.length) window.alert(msgs.join('\n\n'));
  }

  return (
    <button className="btn btn-primary btn-sm" disabled={bulk.isPending || !selected.length} onClick={onDelete}>
      <Trash2 size={14} /> {bulk.isPending ? tr('삭제 중…') : `${tr('선택 삭제')} (${selected.length})`}
    </button>
  );
}

export default function OrdersPage() {
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);

  const actionCol: ColumnDef<OrderRow, unknown> = {
    id: 'actions',
    header: '처리',
    cell: (c) => <OrderActions row={c.row.original} />,
  };
  const config = { ...ordersConfig, listColumns: [...ordersConfig.listColumns, actionCol] };

  return (
    <>
      <ResourceListPage
        config={config as never}
        onRowClick={(row) => setEditing(row as unknown as Record<string, unknown>)}
        selectable
        renderBulkBar={({ selected, clear }: { selected: OrderRow[]; clear: () => void }) => (
          <OrdersBulkBar selected={selected} clear={clear} />
        )}
      />
      <FormDrawer open={!!editing} title={tr('주문 상세')} onClose={() => setEditing(null)}>
        <div className="space-y-4">
          <OrderDetail orderId={editing?.id as string | undefined} />
          <ResourceFormPage
            config={ordersConfig as never}
            initial={editing}
            onDone={() => setEditing(null)}
          />
        </div>
      </FormDrawer>
    </>
  );
}
