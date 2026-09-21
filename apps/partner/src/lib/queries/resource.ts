// Design Ref: §4.1 — react-query 데이터 훅 (anon 클라이언트 + RLS). 컴포넌트서 직접 supabase 호출 금지.
'use client';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { ResourceConfig } from '@/lib/resource/types';

export interface ListParams {
  page: number;
  pageSize: number;
  search?: string;
  searchColumns?: string[];
  filters?: Record<string, string>; // 컬럼 eq 필터 (UI 필터바)
  /** 항상 적용되는 동적 범위 eq 필터 (예: seller_id = 현재 오거나이저). RLS 보강 + 타인 active 상품 숨김. */
  scope?: Record<string, string>;
}

export function useResourceList<T>(config: ResourceConfig<T>, params: ListParams) {
  return useQuery({
    queryKey: [config.key, 'list', params],
    queryFn: async () => {
      const supabase = createClient();
      let q = supabase
        .from(config.table)
        .select(config.selectColumns ?? '*', { count: 'exact' });

      // 고정 필터 (config.baseFilter) — 항상 적용 (예: 행사패스 = product_type ticket)
      if (config.baseFilter) {
        const { column, op, value } = config.baseFilter;
        q = op === 'neq' ? q.neq(column, value) : q.eq(column, value);
      }
      // 동적 범위 필터 (config.scope) — 항상 적용 (예: seller_id = 현재 오거나이저)
      for (const [col, val] of Object.entries(params.scope ?? {})) {
        if (val) q = q.eq(col, val);
      }
      // eq 필터
      for (const [col, val] of Object.entries(params.filters ?? {})) {
        if (val) q = q.eq(col, val);
      }
      // ilike 검색 (or 결합)
      if (params.search && params.searchColumns?.length) {
        const or = params.searchColumns
          .map((c) => `${c}.ilike.%${params.search}%`)
          .join(',');
        q = q.or(or);
      }
      if (config.defaultSort) {
        q = q.order(config.defaultSort.column, { ascending: config.defaultSort.asc });
      }
      const from = (params.page - 1) * params.pageSize;
      q = q.range(from, from + params.pageSize - 1);

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as T[], total: count ?? 0 };
    },
  });
}

export function useResourceDetail<T>(config: ResourceConfig<T>, id: string | null) {
  return useQuery({
    queryKey: [config.key, 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from(config.table)
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as T;
    },
  });
}

export function useResourceUpsert<T extends { id?: string }>(config: ResourceConfig<T>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Partial<T>) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from(config.table)
        .upsert(values as never)
        .select()
        .single();
      if (error) throw error;
      return data as T;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [config.key] });
    },
  });
}

/** 리소스 삭제 (RLS: products_seller_write = is_admin() 허용). */
export function useResourceDelete(table: string, queryKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
  });
}

/**
 * 리소스 복제 — 전체 행을 읽어 새 '초안'으로 insert.
 * id/created_at/updated_at 제외, status=draft, code 에 -COPY 접미.
 */
export function useResourceDuplicate(table: string, queryKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
      if (error) throw error;
      const copy: Record<string, unknown> = { ...(data as Record<string, unknown>) };
      delete copy.id;
      delete copy.created_at;
      delete copy.updated_at;
      if ('status' in copy) copy.status = 'draft';
      if (typeof copy.code === 'string' && copy.code) copy.code = `${copy.code}-COPY`;
      const { error: insErr } = await supabase.from(table).insert(copy as never);
      if (insErr) throw insErr;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
  });
}

/** 상태 전이 전용 (partners/products). 허용 전이는 UI에서 가드. */
export function useStatusTransition(table: string, queryKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const supabase = createClient();
      const { error } = await supabase.from(table).update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
  });
}
