// Design Ref: §5.4 배송관리 — shipments. 국내/해외 분기, 택배사·송장·상태(준비/발송/완료).
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import type { ResourceConfig } from '@/lib/resource/types';
import { StatusBadge } from '@/components/form/StatusBadge';

export interface ShipmentRow {
  id: string;
  order_id: string;
  region: string;
  carrier: string | null;
  tracking_no: string | null;
  status: string;
  shipped_at: string | null;
  eta: string | null;
  cost: number;
}

const REGION_OPTS = [
  { value: 'domestic', label: '국내' },
  { value: 'overseas', label: '해외' },
];
const STATUS_OPTS = [
  { value: 'preparing', label: '준비중' },
  { value: 'shipped', label: '발송' },
  { value: 'delivered', label: '배송완료' },
];

const columns: ColumnDef<ShipmentRow, unknown>[] = [
  { accessorKey: 'order_id', header: '주문', cell: (c) => String(c.getValue() ?? '').slice(0, 8) },
  { accessorKey: 'region', header: '구분', cell: (c) => REGION_OPTS.find((o) => o.value === c.getValue())?.label ?? String(c.getValue()) },
  { accessorKey: 'carrier', header: '택배사', cell: (c) => c.getValue() ?? '—' },
  { accessorKey: 'tracking_no', header: '송장번호', cell: (c) => c.getValue() ?? '—' },
  { accessorKey: 'status', header: '상태', cell: (c) => StatusBadge({ status: STATUS_OPTS.find((o) => o.value === c.getValue())?.label ?? String(c.getValue()) }) },
  { accessorKey: 'eta', header: '도착예정', cell: (c) => String(c.getValue() ?? '—').slice(0, 10) },
];

export const shipmentsConfig: ResourceConfig<ShipmentRow> = {
  key: 'shipments',
  table: 'shipments',
  title: '배송관리',
  canCreate: true,
  selectColumns: 'id, order_id, region, carrier, tracking_no, status, shipped_at, eta, cost',
  defaultSort: { column: 'shipped_at', asc: false },
  listColumns: columns,
  filters: [
    { name: 'q', label: '송장번호 검색', kind: 'search', searchColumns: ['tracking_no'] },
    { name: 'region', label: '구분', kind: 'select', options: REGION_OPTS },
    { name: 'status', label: '상태', kind: 'select', options: STATUS_OPTS },
  ],
  formFields: [
    { name: 'order_id', label: '주문 ID', kind: 'text', required: true, placeholder: '주문 UUID' },
    { name: 'region', label: '구분', kind: 'select', options: REGION_OPTS, required: true },
    { name: 'carrier', label: '택배사', kind: 'text' },
    { name: 'tracking_no', label: '송장번호', kind: 'text' },
    { name: 'status', label: '상태', kind: 'select', options: STATUS_OPTS, required: true },
    { name: 'shipped_at', label: '발송일', kind: 'date' },
    { name: 'eta', label: '도착예정일', kind: 'date' },
    { name: 'cost', label: '배송비', kind: 'number' },
  ],
  schema: z
    .object({
      region: z.enum(['domestic', 'overseas']).optional(),
      status: z.enum(['preparing', 'shipped', 'delivered']).optional(),
      cost: z.number().int('정수').nonnegative('0 이상').optional(),
    })
    .passthrough(),
};
