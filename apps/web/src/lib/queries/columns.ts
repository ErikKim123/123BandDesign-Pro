// Design Ref: §7 SEO — 마이그레이션 적용 시점과 배포 시점이 어긋나도 화면이 깨지지 않게 하는 컬럼 탐지.
//
// 배경: select 목록에 없는 컬럼이 하나라도 들어가면 PostgREST 는 42703 으로 쿼리 전체를 실패시킨다.
//       (0034 미적용 상태로 배포됐을 때 주문내역이 통째로 깨졌던 것과 같은 함정)
//       → products.slug(0035) 는 '있으면 쓰고 없으면 레거시 URL' 이어야 하므로 존재 여부를 1회만 확인해 캐시한다.
import { createClient } from '@/lib/supabase/server';

let slugColumn: boolean | null = null;

/** products.slug(0035) 적용 여부. 프로세스당 1회 탐지 후 재사용. */
export async function hasProductSlug(): Promise<boolean> {
  if (slugColumn !== null) return slugColumn;
  const { error } = await createClient().from('products').select('slug').limit(1);
  if (!error) {
    slugColumn = true;
    return true;
  }
  // 42703 = undefined_column → 0035 미적용(확정) → 캐시.
  // 그 외(네트워크·권한 등)는 일시적일 수 있으니 캐시하지 않고 이번 요청만 레거시로 처리한다.
  if ((error as { code?: string }).code === '42703') {
    slugColumn = false;
    return false;
  }
  return false;
}

/** select 컬럼 목록에 slug 계열 컬럼을 조건부로 덧붙인다. */
export async function withSlugCols(cols: string, extra = 'slug'): Promise<string> {
  return (await hasProductSlug()) ? `${cols}, ${extra}` : cols;
}
