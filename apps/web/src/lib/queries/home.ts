// Design Ref: §5 Phase 2 — 메인페이지 데이터 (서버 컴포넌트 SSR 조회, anon+RLS)
import { createClient } from '@/lib/supabase/server';
import { createPublicClient } from '@/lib/supabase/public';
import { withSlugCols } from '@/lib/queries/columns';
import type { ActivePass, I18n, Prices } from '@123band/shared';

export interface MainSection {
  id: string;
  section_type: 'hero' | 'slider' | 'featured' | 'category_strip' | string;
  config: Record<string, unknown>;
  sort_order: number;
}

export interface NavMenu {
  id: string;
  label_i18n: I18n;
  path: string;
  sort_order: number;
}

/**
 * 상단 네비 메뉴 — 활성만 sort 순서대로 (없으면 헤더가 코드 기본값으로 폴백).
 * 공개 데이터라 세션 없는 클라이언트로 읽는다 — 만료된 사용자 토큰 때문에 401 이 나서
 * 메뉴가 통째로 기본값으로 떨어지는 일을 막는다(RLS: is_active = true 는 누구나 읽기 가능).
 */
export async function getNavMenus(): Promise<NavMenu[]> {
  const { data, error } = await createPublicClient()
    .from('menus')
    .select('id, label_i18n, path, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as NavMenu[];
}

export interface Banner {
  id: string;
  position: string | null;
  title_i18n: I18n;
  subtitle_i18n: I18n | null;
  image_url: string | null;
  /** 이미지 제공(크레딧) — 슬라이드 우측 하단 표기. 비어 있으면 미노출. */
  image_credit: string | null;
  link_url: string | null;
  sort_order: number;
}

export interface HomeProduct {
  id: string;
  code: string | null;
  product_type: string;
  is_partner_product: boolean;
  category_id: string | null;
  name_i18n: I18n;
  prices: Prices;
  image_url: string | null;
  status: string;
  /** 티켓 상품 전용 — 각 패스(Full/Party 등)의 이름+현재가. 목록 카드에 패스명·가격 표기. 실물/구독은 없음. */
  passes?: ActivePass[];
  /** 티켓 상품 전용 — 행사 국가(ISO-2). 결제 통화 가격이 없을 때 그 나라 통화로 표기하기 위한 기준. */
  country?: string | null;
  /** URL 슬러그(0035). 카드 링크가 정식 주소로 곧장 가게 한다(301 경유 없음). */
  slug?: string | null;
}

/** 목록 카드용 공통 컬럼 — slug 는 컬럼 존재 시에만 덧붙인다(withSlugCols). */
export const LIST_COLS =
  'id, code, product_type, is_partner_product, category_id, name_i18n, prices, image_url, status';

export interface HomeCategory {
  id: string;
  code: string | null;
  name_i18n: I18n;
  sort_order: number;
}

/** 메인 섹션 — 활성만 sort 순서대로 */
export async function getMainSections(): Promise<MainSection[]> {
  const { data, error } = await createClient()
    .from('main_sections')
    .select('id, section_type, config, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as MainSection[];
}

/** 노출 배너 — is_active + 노출 기간(오늘 포함) 만 */
export async function getActiveBanners(): Promise<Banner[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await createClient()
    .from('banners')
    .select('id, position, title_i18n, subtitle_i18n, image_url, image_credit, link_url, sort_order')
    .eq('is_active', true)
    .or(`start_at.is.null,start_at.lte.${today}`)
    .or(`end_at.is.null,end_at.gte.${today}`)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Banner[];
}

/** 추천(판매중) 상품 — 상세 HTML 제외하고 가볍게 */
export async function getFeaturedProducts(limit = 8): Promise<HomeProduct[]> {
  const { data, error } = await createClient()
    .from('products')
    .select(await withSlugCols(LIST_COLS))
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  // select 문자열이 동적(withSlugCols)이라 행 타입 추론이 안 된다 → unknown 경유 단언.
  return (data ?? []) as unknown as HomeProduct[];
}

/** 노출 카테고리 (대분류 위주, sort 순) */
export async function getVisibleCategories(): Promise<HomeCategory[]> {
  const { data, error } = await createClient()
    .from('categories')
    .select('id, code, name_i18n, sort_order')
    .eq('is_visible', true)
    .is('parent_id', null)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as HomeCategory[];
}
