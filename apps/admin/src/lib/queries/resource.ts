// Design Ref: §4.1 — react-query 데이터 훅 (anon 클라이언트 + RLS). 컴포넌트서 직접 supabase 호출 금지.
'use client';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { tr } from '@/i18n/tr';
import type { ResourceConfig } from '@/lib/resource/types';

export interface ListParams {
  page: number;
  pageSize: number;
  search?: string;
  searchColumns?: string[];
  filters?: Record<string, string>; // 컬럼 eq 필터
}

/** select 필터에서 '값 없음(is null)' 을 뜻하는 옵션 값. */
export const NULL_FILTER = '__null';

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
      // eq 필터
      for (const [col, val] of Object.entries(params.filters ?? {})) {
        if (!val) continue;
        // '__null' = 값이 비어 있는 행만(예: 행사를 지정하지 않은 공통 업적)
        q = val === NULL_FILTER ? q.is(col, null) : q.eq(col, val);
      }
      // ilike 검색 (or 결합) — 컬럼 + (옵션) 판매자(profiles/partners) 매칭 + (옵션) 커스텀 리졸버
      if (params.search && (params.searchColumns?.length || config.searchSellers || config.buildSearchOr)) {
        const term = params.search;
        const ors = (params.searchColumns ?? []).map((c) => `${c}.ilike.%${term}%`);
        if (config.searchSellers) {
          const ids = new Set<string>();
          const [pr, pa] = await Promise.all([
            supabase.from('profiles').select('id').or(`email.ilike.%${term}%,name.ilike.%${term}%`).limit(200),
            supabase.from('partners').select('user_id').ilike('company_name', `%${term}%`).limit(200),
          ]);
          (pr.data as { id: string }[] | null)?.forEach((r) => ids.add(r.id));
          (pa.data as { user_id: string | null }[] | null)?.forEach((r) => r.user_id && ids.add(r.user_id));
          if (ids.size) ors.push(`seller_id.in.(${Array.from(ids).join(',')})`);
        }
        if (config.buildSearchOr) {
          ors.push(...(await config.buildSearchOr(term, supabase as never)));
        }
        if (ors.length) q = q.or(ors.join(','));
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
      // 조인 임베드(profiles/seller 등)는 실제 컬럼이 아니므로 쓰기 전 제거
      const payload = { ...(values as Record<string, unknown>) };
      for (const k of config.omitOnWrite ?? []) delete payload[k];
      const { data, error } = await supabase
        .from(config.table)
        .upsert(payload as never)
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
      // .select() 로 실제 삭제된 행을 회수 — RLS 로 0행 삭제(권한 없음)도 감지.
      const { data, error } = await supabase.from(table).delete().eq('id', id).select('id');
      if (error) {
        // 23503 = foreign_key_violation: 주문/참조가 있어 삭제 불가.
        if ((error as { code?: string }).code === '23503') {
          throw new Error('이미 주문/참조된 항목이라 삭제할 수 없어요. 대신 "품절" 또는 비활성 처리하세요.');
        }
        throw error;
      }
      if (!data || data.length === 0) {
        throw new Error('삭제할 권한이 없거나 이미 삭제된 항목입니다.');
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
    onError: (err) => {
      // 우리가 던진 한국어 메시지는 카탈로그로 번역되고, 서버(Supabase) 원문은 그대로 나온다.
      window.alert(tr(err instanceof Error ? err.message : '삭제에 실패했습니다.'));
    },
  });
}

export interface BulkDeleteResult {
  deleted: number;
  blocked: string[]; // 주문/참조(23503)로 삭제 불가한 id
  failed: string[]; // 권한 없음/이미 삭제 등
}

/** 여러 행 일괄 삭제 (선택 삭제). 23503(참조)·RLS 0행을 개별 분류해 반환. */
export function useResourceBulkDelete(table: string, queryKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]): Promise<BulkDeleteResult> => {
      const supabase = createClient();
      let deleted = 0;
      const blocked: string[] = [];
      const failed: string[] = [];
      for (const id of ids) {
        const { data, error } = await supabase.from(table).delete().eq('id', id).select('id');
        if (error) {
          if ((error as { code?: string }).code === '23503') blocked.push(id);
          else failed.push(id);
          continue;
        }
        if (!data || data.length === 0) failed.push(id);
        else deleted++;
      }
      return { deleted, blocked, failed };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
  });
}

/**
 * 리소스 복제 — 전체 행을 읽어 새 '초안'으로 insert.
 * id/created_at/updated_at 제외, status=draft, is_active=false(있으면 노출 숨김),
 * code 에 -COPY / slug 에 -copy 접미(unique 제약 충돌 방지).
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
      if ('is_active' in copy) copy.is_active = false;
      if (typeof copy.code === 'string' && copy.code) copy.code = `${copy.code}-COPY`;
      if (typeof copy.slug === 'string' && copy.slug) copy.slug = `${copy.slug}-copy`;
      const { error: insErr } = await supabase.from(table).insert(copy as never);
      if (insErr) throw insErr;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
  });
}

/** 여러 행을 순서대로 복제(선택 복사) — 실패한 건 건너뛰고 계속 진행, 개수만 반환. */
export function useResourceBulkDuplicate(table: string, queryKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]): Promise<{ duplicated: number; failed: number }> => {
      const supabase = createClient();
      let duplicated = 0;
      let failed = 0;
      for (const id of ids) {
        const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
        if (error) { failed++; continue; }
        const copy: Record<string, unknown> = { ...(data as Record<string, unknown>) };
        delete copy.id;
        delete copy.created_at;
        delete copy.updated_at;
        if ('status' in copy) copy.status = 'draft';
        if ('is_active' in copy) copy.is_active = false;
        if (typeof copy.code === 'string' && copy.code) copy.code = `${copy.code}-COPY`;
        if (typeof copy.slug === 'string' && copy.slug) copy.slug = `${copy.slug}-copy`;
        const { error: insErr } = await supabase.from(table).insert(copy as never);
        if (insErr) failed++; else duplicated++;
      }
      return { duplicated, failed };
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
    onError: (err) => {
      window.alert(tr(err instanceof Error ? err.message : '상태 변경에 실패했습니다.'));
    },
  });
}
