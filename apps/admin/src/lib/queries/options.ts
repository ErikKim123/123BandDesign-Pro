// Design Ref: §5.4 — 상품/카테고리 폼의 select 옵션 (카테고리 목록)
// 주: Supabase 는 snake_case 컬럼 반환 → raw row 는 snake_case 로 다룬다.
'use client';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { I18n } from '@123band/shared';
import { trI18nIn, trIn } from '@/i18n/tr';
import { DIVISION_OPTS } from '@/lib/resource/configs/jnj-winners';
import { useLocale } from '@/lib/locale/LocaleContext';

interface CategoryRow {
  id: string;
  name_i18n: I18n;
  parent_id: string | null;
}

/** 카테고리 select 옵션 (parent select / 상품 category 공용) */
export function useCategoryOptions() {
  // 라벨을 queryFn 안에서 만들기 때문에 로케일이 키에 들어가야 한다 —
  // 키가 같으면 캐시된(이전 언어) 라벨이 그대로 돌아온다.
  const { locale } = useLocale();
  return useQuery({
    queryKey: ['categories', 'options', locale],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('categories')
        .select('id, name_i18n, parent_id')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data as CategoryRow[]).map((c) => ({
        value: c.id,
        label: (c.parent_id ? '— ' : '') + trI18nIn(c.name_i18n, locale),
      }));
    },
  });
}

/** 행사(티켓 상품) select 옵션 — J&J 대회를 실제 행사에 연결할 때 쓴다. */
export function useEventProductOptions() {
  const { locale } = useLocale();
  return useQuery({
    queryKey: ['products', 'ticket-options', locale],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('products')
        .select('id, name_i18n')
        .eq('product_type', 'ticket')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as { id: string; name_i18n: I18n }[]).map((p) => ({
        value: p.id,
        label: trI18nIn(p.name_i18n, locale),
      }));
    },
  });
}

/** J&J 에디션 select 옵션 — 우승자 등록 시 소속 대회를 고른다. */
export function useJnjEditionOptions() {
  const { locale } = useLocale();
  return useQuery({
    queryKey: ['jnj_editions', 'options', locale],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('jnj_editions')
        .select('id, year, title_i18n')
        .order('year', { ascending: false })
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data as { id: string; year: number; title_i18n: I18n }[]).map((e) => ({
        value: e.id,
        label: `${e.year} · ${trI18nIn(e.title_i18n, locale)}`,
      }));
    },
  });
}

/** J&J 부문 select 옵션 — 심사위원의 소속 부문을 고른다. edition_id 로 좁혀 쓴다. */
export function useJnjDivisionOptions() {
  const { locale } = useLocale();
  return useQuery({
    queryKey: ['jnj_divisions', 'options', locale],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('jnj_divisions')
        .select('id, edition_id, kind, title_i18n, sort_order')
        .order('sort_order', { ascending: true });
      // 0053 미적용 환경에서도 폼이 죽지 않게 — 빈 목록으로 폴백(부문 = '전 부문 공통' 만 선택 가능).
      if (error) return [];
      return (data as { id: string; edition_id: string; kind?: string; title_i18n: I18n }[]).map((d) => ({
        value: d.id,
        editionId: d.edition_id,
        // 0110 미적용 환경에서도 폼이 죽지 않게 — 종류가 없으면 J&J 로 본다.
        kind: d.kind ?? 'jnj',
        label: trI18nIn(d.title_i18n, locale),
      }));
    },
  });
}

/**
 * 코드관리(code_values)의 한 그룹을 select 옵션으로.
 *
 * 테이블이 없거나(0096 미적용) 그 그룹에 값이 하나도 없으면 fallback 을 쓴다 —
 * 코드값을 DB 로 옮긴 뒤에도 화면이 빈 드롭다운이 되는 일은 없어야 한다.
 */
export function useCodeValues(
  groupKey: string,
  fallback: { value: string; label: string }[] = [],
) {
  const { locale } = useLocale();
  return useQuery({
    queryKey: ['code_values', groupKey, locale],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('code_values')
        .select('code, label_i18n, sort_order')
        .eq('group_key', groupKey)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error || !data?.length) {
        return fallback.map((o) => ({ value: o.value, label: trIn(o.label, locale) }));
      }
      return (data as { code: string; label_i18n: I18n }[]).map((r) => ({
        value: r.code,
        label: trI18nIn(r.label_i18n, locale) || r.code,
      }));
    },
  });
}

/**
 * 종류별 부문 코드 선택지 — 코드관리의 `<종류>_division` 그룹 + 그 종류로 등록된 부문의 코드.
 *
 * 배틀 부문 폼에 J&J 코드(아마추어·프로)가 딸려 나오면 잘못 고르기 쉽다. 한 번에 세 종류를
 * 다 받아 두고 폼이 고른 종류의 것만 꺼내 쓴다(종류를 바꿀 때마다 다시 부르지 않게).
 */
export function useDivisionCodeOptionsByKind() {
  const { locale } = useLocale();
  return useQuery({
    queryKey: ['jnj_divisions', 'codes_by_kind', locale],
    queryFn: async () => {
      const supabase = createClient();
      const [codes, divisions] = await Promise.all([
        supabase
          .from('code_values')
          .select('group_key, code, label_i18n, sort_order')
          .in('group_key', ['jnj_division', 'battle_division', 'div_division'])
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
        supabase.from('jnj_divisions').select('code, kind, title_i18n, sort_order').order('sort_order', { ascending: true }),
      ]);
      type Opt = { value: string; label: string };
      const out: Record<string, Opt[]> = { jnj: [], battle: [], div: [] };
      const seen: Record<string, Set<string>> = { jnj: new Set(), battle: new Set(), div: new Set() };
      const put = (kind: string, value: string, label: string) => {
        const code = (value ?? '').trim();
        const list = out[kind];
        const mark = seen[kind];
        if (!code || !list || !mark || mark.has(code)) return;
        mark.add(code);
        list.push({ value: code, label });
      };
      for (const r of (codes.data ?? []) as { group_key: string; code: string; label_i18n: I18n }[]) {
        put(r.group_key.replace('_division', ''), r.code, trI18nIn(r.label_i18n, locale) || r.code);
      }
      // 코드관리가 비어 있는 종류(새로 만든 그룹)는 소스 기본값으로 — J&J 만 기본값이 있다.
      if ((out.jnj ?? []).length === 0) {
        for (const o of DIVISION_OPTS) put('jnj', o.value, trIn(o.label, locale));
      }
      // 이미 등록된 부문의 코드도 고를 수 있어야 그 탭에 데이터가 붙는다.
      for (const d of (divisions.data ?? []) as { code: string; kind?: string; title_i18n: I18n }[]) {
        const kind = d.kind ?? 'jnj';
        put(kind, d.code, `${trI18nIn(d.title_i18n, locale) || d.code} (${d.code})`);
      }
      return out;
    },
  });
}

/**
 * 부문 코드 select 옵션 — 표준 코드(아마추어·프로·살사·오픈) + 이미 등록된 부문의 코드.
 *
 * 한 대회에 오픈이 둘(바차타 오픈 · 키좀바 오픈) 있는 것처럼 표준 코드만으로는 모자란 경우가 있다.
 * 부문관리에서 'open-kizomba' 같은 코드를 직접 만들 수 있으므로, 우승자·점수·참가자 화면도
 * 그 코드를 고를 수 있어야 데이터가 그 탭에 붙는다.
 */
export function useJnjDivisionCodeOptions() {
  const { locale } = useLocale();
  return useQuery({
    queryKey: ['jnj_divisions', 'codes', locale],
    queryFn: async () => {
      // 표준 코드는 이제 코드관리(code_values)가 원본이다. 비어 있으면 소스 기본값으로 폴백.
      const { data: codeRows } = await createClient()
        .from('code_values')
        .select('code, label_i18n, sort_order')
        .eq('group_key', 'jnj_division')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      const std = codeRows?.length
        ? (codeRows as { code: string; label_i18n: I18n }[]).map((r) => ({
            value: r.code,
            label: trI18nIn(r.label_i18n, locale) || r.code,
          }))
        : DIVISION_OPTS.map((o) => ({ value: o.value, label: trIn(o.label, locale) }));
      const { data, error } = await createClient()
        .from('jnj_divisions')
        .select('code, title_i18n, sort_order')
        .order('sort_order', { ascending: true });
      // 0053 미적용 환경 — 표준 코드만 쓴다.
      if (error) return std;
      const seen = new Set(std.map((o) => o.value));
      const extra: { value: string; label: string }[] = [];
      for (const d of (data ?? []) as { code: string; title_i18n: I18n }[]) {
        const code = (d.code ?? '').trim();
        if (!code || seen.has(code)) continue;
        seen.add(code);
        // 코드만으로는 무엇인지 모르니 부문 이름을 같이 보여준다.
        const name = trI18nIn(d.title_i18n, locale);
        extra.push({ value: code, label: name ? `${name} (${code})` : code });
      }
      return [...std, ...extra];
    },
  });
}
