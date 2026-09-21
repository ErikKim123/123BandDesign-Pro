// Design Ref: §3.1 — ResourceConfig (config-driven CRUD)
import type { ColumnDef } from '@tanstack/react-table';
import type { ZodTypeAny } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

export type FieldKind =
  | 'text' | 'textarea' | 'number' | 'date' | 'select' | 'toggle'
  | 'i18n' | 'i18n-multiline' | 'prices' | 'json' | 'image' | 'links' | 'custom';

export interface FieldDef {
  name: string;
  label: string;
  kind: FieldKind;
  options?: { value: string; label: string }[]; // select
  required?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  /** number: 입력 단위. 소수점을 받는 칸(점수 등)은 0.01 처럼 준다. 기본 1(정수). */
  step?: number;
  /** i18n 필드: EN/KO 입력칸을 토글 없이 한 화면에 같이 노출 (게시판 등 원문·번역을 나란히 쓰는 폼). */
  bilingual?: boolean;
  /** image: 업로드 대상 Supabase Storage 버킷 (기본 'product-images'). */
  bucket?: string;
  /** image: 허용 최대 용량(bytes). 기본 5MB. */
  maxBytes?: number;
  /** image: 미리보기 비율 — 배너처럼 가로로 긴 이미지는 'wide'. 기본 정사각. */
  preview?: 'square' | 'wide';
  /** text·number·image·links: 입력 아래 안내 문구(한국어 원문 → tr 로 번역). 없으면 기본 안내. */
  hint?: string;
  /** links: 넣을 수 있는 링크 개수 상한 (기본 3). 상한에 닿으면 '추가' 버튼이 잠긴다. */
  maxItems?: number;
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
  /** 검색 시 판매자(profiles 이메일/이름 + partners 회사명)도 매칭(seller_id 기준). */
  searchSellers?: boolean;
  /** (선택) 검색어를 관련 테이블에서 해석해 추가 or 토큰을 만든다.
   *  searchColumns 의 ilike 절과 함께 .or() 로 결합된다.
   *  예: 주문 목록에서 회원명(buyer_id.in.(…))·오거나이저명(id.in.(…)) 검색. */
  buildSearchOr?: (term: string, supabase: SupabaseClient) => Promise<string[]>;
  /** 제출 전 zod 검증 (부분 입력 허용 위해 .partial() 권장). Design §7 보안 검증. */
  schema?: ZodTypeAny;
  /** upsert 전 페이로드에서 제거할 키 (조인 임베드 등 실제 컬럼이 아닌 필드). 예: ['profiles','seller'] */
  omitOnWrite?: string[];
  /** 저장 시 KO가 비어 있으면 EN→KO 자동번역해 채울 i18n(HTML) 필드들. 예: ['detail_html_i18n'].
   *  이름 등 짧은 필드는 제외(고유명사 영문 폴백 유지). AI 키 미설정/실패 시 무시(영문 폴백). */
  autoTranslate?: string[];
}
