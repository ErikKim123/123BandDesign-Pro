// Design Ref: 메일링 관리 — 나가는 메일 문구를 코드가 아니라 여기서 고친다.
//
// 시스템 템플릿(is_system)은 코드가 key 로 찾아 쓴다. key 를 바꾸거나 행을 지우면 그 메일은
// 하드코딩 폴백 본문으로 나간다(발송이 끊기지는 않는다). 그래서 목록에서 그 사실을 배지로 알린다.
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import type { I18n } from '@123band/shared';
import type { ResourceConfig } from '@/lib/resource/types';
import { StatusBadge } from '@/components/form/StatusBadge';

export interface MailTemplateRow {
  id: string;
  key: string;
  name: string;
  audience: 'admin' | 'user';
  description: string | null;
  subject: string | null;
  body_html: string | null;
  subject_i18n: I18n | null;
  body_html_i18n: I18n | null;
  variables: unknown;
  is_active: boolean;
  is_system: boolean;
  sort_order: number;
  updated_at: string | null;
}

const AUDIENCE_OPTS = [
  { value: 'admin', label: '운영자' },
  { value: 'user', label: '고객' },
];

const columns: ColumnDef<MailTemplateRow, unknown>[] = [
  {
    accessorKey: 'name',
    header: '메일',
    cell: (c) => {
      const r = c.row.original;
      return `${r.name}${r.is_system ? ' · 시스템' : ''}`;
    },
  },
  {
    accessorKey: 'description',
    header: '언제 나가나',
    cell: (c) => String(c.getValue() ?? '—'),
  },
  {
    accessorKey: 'audience',
    header: '받는 사람',
    cell: (c) => AUDIENCE_OPTS.find((o) => o.value === c.getValue())?.label ?? '—',
  },
  { accessorKey: 'key', header: '식별자', cell: (c) => String(c.getValue() ?? '—') },
  {
    accessorKey: 'subject',
    header: '제목',
    cell: (c) => {
      const r = c.row.original;
      return r.subject || r.subject_i18n?.ko || r.subject_i18n?.en || '—';
    },
  },
  {
    accessorKey: 'is_active',
    header: '상태',
    cell: (c) =>
      // 끄면 발송이 멈추는 게 아니라 '코드 기본 문구'로 나간다 — 오해 없게 그대로 적는다.
      c.getValue()
        ? StatusBadge({ status: '이 문구로 보냄', tone: 'success' })
        : StatusBadge({ status: '코드 기본 문구', tone: 'warn' }),
  },
  {
    accessorKey: 'updated_at',
    header: '수정일',
    cell: (c) => String(c.getValue() ?? '').slice(0, 10) || '—',
  },
];

export const mailTemplatesConfig: ResourceConfig<MailTemplateRow> = {
  key: 'mail-templates',
  table: 'mail_templates',
  title: '메일링 관리',
  listColumns: columns,
  defaultSort: { column: 'sort_order', asc: true },
  pageSize: 50,
  filters: [
    { name: 'q', label: '메일 검색', kind: 'search', searchColumns: ['name', 'key', 'description'] },
    { name: 'audience', label: '받는 사람', kind: 'select', options: AUDIENCE_OPTS },
  ],
  formFields: [
    { name: 'name', label: '메일 이름', kind: 'text', required: true, hint: '어드민 목록에서만 쓰는 이름입니다.' },
    {
      name: 'key',
      label: '식별자(key)',
      kind: 'text',
      required: true,
      hint: '코드가 이 값으로 템플릿을 찾습니다. 시스템 메일은 바꾸지 마세요 — 바꾸면 기본 문구로 나갑니다.',
    },
    { name: 'audience', label: '받는 사람', kind: 'select', options: AUDIENCE_OPTS, required: true },
    { name: 'description', label: '언제 나가는 메일인지', kind: 'textarea' },
    { name: 'is_active', label: '이 문구로 보내기', kind: 'toggle' },
    { name: 'sort_order', label: '정렬 순서', kind: 'number' },
    // 운영자 메일 = 한국어 단일, 고객 메일 = ko/en. 폼에는 둘 다 두고 화면에서 안내한다.
    { name: 'subject', label: '제목 (운영자 메일)', kind: 'text' },
    { name: 'body_html', label: '본문 HTML (운영자 메일)', kind: 'textarea' },
    { name: 'subject_i18n', label: '제목 (고객 메일 · 한/영)', kind: 'i18n', bilingual: true },
    { name: 'body_html_i18n', label: '본문 HTML (고객 메일 · 한/영)', kind: 'i18n-multiline', bilingual: true },
    { name: 'variables', label: '쓸 수 있는 변수', kind: 'json' },
    // 미리보기 + 테스트 발송. 저장된 값이 아니라 '지금 입력 중인 값'을 그대로 렌더한다.
    { name: '__preview', label: '미리보기 · 테스트 발송', kind: 'custom' },
  ],
  omitOnWrite: ['__preview'],
  schema: z
    .object({
      key: z
        .string()
        .min(1)
        .regex(/^[a-z0-9_]+$/, '식별자는 영문 소문자·숫자·밑줄만 쓸 수 있습니다.'),
      name: z.string().min(1),
      audience: z.enum(['admin', 'user']),
    })
    .partial(),
};
