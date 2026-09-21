// Design Ref: 코드관리 — 화면 선택지(코드값)를 소스가 아니라 여기서 관리한다.
//
// '부문 코드' 처럼 대회마다 늘어나는 값이 소스에 박혀 있으면 값 하나 추가하는 데도 배포가 필요하다.
// 이 화면에서 추가/수정하면 해당 선택지가 바로 바뀐다.
//
// 코드(code)는 실제로 저장·비교되는 값이다. 이미 쓰인 코드를 바꾸면 그 데이터가 어느 코드였는지
// 알 수 없어지므로, 시스템 코드는 '사용 안 함'으로 끄되 지우거나 고치지 않는 것을 원칙으로 한다.
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import type { I18n } from '@123band/shared';
import { trI18n } from '@/i18n/tr';
import type { ResourceConfig } from '@/lib/resource/types';
import { StatusBadge } from '@/components/form/StatusBadge';

export interface CodeValueRow {
  id: string;
  group_key: string;
  code: string;
  label_i18n: I18n | null;
  note: string | null;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
  updated_at: string | null;
}

/**
 * 코드 그룹 — 지금 이 값들을 쓰는 화면이 어디인지 같이 적는다.
 * 그룹을 새로 만들려면 여기 한 줄을 더하고, 그 값을 읽는 화면에서 useCodeValues(키)를 쓰면 된다.
 */
export const CODE_GROUPS = [
  { value: 'jnj_division', label: 'J&J 부문 코드' },
  { value: 'jnj_role', label: 'J&J 참가 역할' },
  // 종류(0110)마다 진행 방식이 달라 쓰는 코드도 다르다 — 그룹을 나눠 서로 섞이지 않게 한다.
  { value: 'battle_division', label: 'BATTLE 부문 코드' },
  { value: 'battle_role', label: 'BATTLE 참가 역할' },
  { value: 'div_division', label: 'DIV 부문 코드' },
  { value: 'div_role', label: 'DIV 참가 역할' },
];

const groupLabel = (v: unknown) =>
  CODE_GROUPS.find((g) => g.value === String(v))?.label ?? String(v ?? '—');

const columns: ColumnDef<CodeValueRow, unknown>[] = [
  { accessorKey: 'group_key', header: '코드 그룹', cell: (c) => groupLabel(c.getValue()) },
  {
    accessorKey: 'code',
    header: '코드값',
    cell: (c) => {
      const r = c.row.original;
      return `${r.code}${r.is_system ? ' · 시스템' : ''}`;
    },
  },
  { accessorKey: 'label_i18n', header: '코드명', cell: (c) => trI18n(c.getValue() as I18n) || '—' },
  { accessorKey: 'note', header: '메모', cell: (c) => String(c.getValue() ?? '—') },
  { accessorKey: 'sort_order', header: '정렬' },
  {
    accessorKey: 'is_active',
    header: '상태',
    cell: (c) =>
      c.getValue()
        ? StatusBadge({ status: '사용', tone: 'success' })
        : StatusBadge({ status: '사용 안 함', tone: 'default' }),
  },
  {
    accessorKey: 'updated_at',
    header: '수정일',
    cell: (c) => String(c.getValue() ?? '').slice(0, 10) || '—',
  },
];

export const codeValuesConfig: ResourceConfig<CodeValueRow> = {
  key: 'code-values',
  table: 'code_values',
  title: '코드관리',
  listColumns: columns,
  defaultSort: { column: 'sort_order', asc: true },
  pageSize: 50,
  filters: [
    { name: 'group_key', label: '코드 그룹', kind: 'select', options: CODE_GROUPS },
    { name: 'q', label: '코드·메모 검색', kind: 'search', searchColumns: ['code', 'note'] },
  ],
  formFields: [
    { name: 'group_key', label: '코드 그룹', kind: 'select', options: CODE_GROUPS, required: true },
    {
      name: 'code',
      label: '코드값 (영문/숫자, 저장 후 변경 금지)',
      kind: 'text',
      required: true,
      placeholder: 'open-kizomba',
      hint: '실제로 저장·비교되는 값입니다. 이미 쓰인 코드를 바꾸면 기존 데이터가 어느 코드였는지 알 수 없어집니다.',
    },
    { name: 'label_i18n', label: '코드명 (화면 표시)', kind: 'i18n', bilingual: true, required: true },
    { name: 'note', label: '메모 (운영자용, 화면에 안 나감)', kind: 'textarea' },
    { name: 'sort_order', label: '정렬 순서 (작을수록 먼저)', kind: 'number' },
    { name: 'is_active', label: '사용', kind: 'toggle' },
  ],
  schema: z
    .object({
      group_key: z.string().min(1),
      code: z
        .string()
        .min(1)
        .regex(/^[a-z0-9_-]+$/, '코드값은 영문 소문자·숫자·하이픈·밑줄만 쓸 수 있습니다.'),
      sort_order: z.number().int().nonnegative().optional(),
    })
    .partial(),
};
