// Design Ref: §3.1 — ResourceConfig (config-driven CRUD)
import type { ColumnDef } from '@tanstack/react-table';
import type { ZodTypeAny } from 'zod';

export type FieldKind =
  | 'text' | 'textarea' | 'number' | 'date' | 'select' | 'toggle'
  | 'i18n' | 'i18n-multiline' | 'prices' | 'json' | 'custom';

export interface FieldDef {
  name: string;
  label: string;
  kind: FieldKind;
  options?: { value: string; label: string }[]; // select
  required?: boolean;
  readOnly?: boolean;
  placeholder?: string;
}

export interface FilterDef {
  name: string;
  label: string;
  kind: 'select' | 'search';
  options?: { value: string; label: string }[];
  /** ilike 검색 대상 컬럼들 (kind=search) */
  searchColumns?: string[];
}

export interface ResourceConfig<T = Record<string, unknown>> {
  key: string;            // 'members' | 'partners' | ...
  table: string;          // supabase 테이블명
  title: string;
  listColumns: ColumnDef<T, unknown>[];
  filters: FilterDef[];
  formFields: FieldDef[];
  /** 목록 select (예: products는 detail_html 제외). 기본 '*' */
  selectColumns?: string;
  defaultSort?: { column: string; asc: boolean };
  pageSize?: number;
  /** 생성 허용 여부 (예: members는 읽기/수정만) */
  canCreate?: boolean;
  /** 항상 적용되는 고정 필터 (예: 행사패스관리 = product_type eq 'ticket'). 사용자 필터와 별개. */
  baseFilter?: { column: string; op: 'eq' | 'neq'; value: string };
  /** 생성(신규) 시 폼 초기값으로 주입 (예: 행사패스 = product_type 'ticket'). 수정 시에는 무시. */
  createDefaults?: Record<string, unknown>;
  /** 설정 시 code 필드를 폼에서 숨기고, 비어 있으면 저장 시 이 접두어로 자동 생성. */
  autoCodePrefix?: string;
  /** 제출 전 zod 검증 (부분 입력 허용 위해 .partial() 권장). Design §7 보안 검증. */
  schema?: ZodTypeAny;
}
