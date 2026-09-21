// Design Ref: §7 SEO — 동적 sitemap. 정적 경로 + Supabase active 상품·카테고리(lastmod) + hreflang(x-default).
// URL 은 반드시 정식 경로(productRelPath)로 낸다 — sitemap 이 301 되는 주소를 실으면 색인이 지연된다.
import type { MetadataRoute } from 'next';
import { productRelPath } from '@123band/shared';
import { activeLocales } from '@/i18n/config';
import { createClient } from '@/lib/supabase/server';
import { withSlugCols } from '@/lib/queries/columns';
import { SITE } from '@/lib/seo'; // canonical/OG 와 동일 도메인(단일 소스) — vercel.app/localhost 유출 방지

type ChangeFreq = MetadataRoute.Sitemap[number]['changeFrequency'];

// 로케일 제외 경로 → 전 로케일 hreflang(+x-default) 맵
function langAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const l of activeLocales) languages[l] = `${SITE}/${l}${path}`;
  languages['x-default'] = `${SITE}/en${path}`;
  return languages;
}

// 한 경로를 전 로케일 엔트리로 확장(각 엔트리에 hreflang 대안 포함)
function expand(
  path: string,
  opts: { changeFrequency?: ChangeFreq; priority?: number; lastModified?: string | Date },
): MetadataRoute.Sitemap {
  return activeLocales.map((l) => ({
    url: `${SITE}/${l}${path}`,
    lastModified: opts.lastModified,
    changeFrequency: opts.changeFrequency,
    priority: opts.priority,
    alternates: { languages: langAlternates(path) },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  // 1) 정적 공개 경로
  const STATIC: { path: string; changeFrequency: ChangeFreq; priority: number }[] = [
    { path: '', changeFrequency: 'daily', priority: 1 },
    { path: '/shop', changeFrequency: 'daily', priority: 0.8 },
    { path: '/events', changeFrequency: 'daily', priority: 0.8 },
    { path: '/boards', changeFrequency: 'weekly', priority: 0.5 },
    { path: '/jnj', changeFrequency: 'weekly', priority: 0.7 },
    { path: '/sell', changeFrequency: 'monthly', priority: 0.4 },
  ];

  // 약관·정책 7종(× 로케일 = 14 URL)은 sitemap 에 넣지 않는다.
  // 색인을 막는 게 아니라(푸터에서 계속 링크되고 크롤 가능) '색인해 달라고 제출하는 목록'에서만 뺀다:
  // 보일러플레이트라 Google 이 매번 '발견됨 - 현재 색인이 생성되지 않음'으로 남겨서
  // sitemap 제출 URL 대비 색인율을 떨어뜨리고 GSC 리포트의 실제 문제를 가린다.
  // (색인시키고 싶어지면 아래 배열을 STATIC 에 되돌리면 된다.)
  // const LEGAL = ['/terms', '/privacy', '/refund', '/cookies', '/guidelines', '/ip', '/organizer-terms'];

  for (const s of STATIC) entries.push(...expand(s.path, s));

  // 2) 동적: active 상품 + 카테고리 (DB 실패해도 정적 sitemap 은 반환)
  try {
    const supabase = createClient();
    const productCols = await withSlugCols('id, product_type, updated_at');
    const [products, categories] = await Promise.all([
      // 공개/색인되는 상품만: draft·pending 은 noindex(상품페이지에서 차단), active·soldout 은 공개 페이지.
      supabase.from('products').select(productCols).in('status', ['active', 'soldout']).limit(5000),
      supabase.from('categories').select('id, updated_at').limit(1000),
    ]);
    for (const row of products.data ?? []) {
      // select 문자열이 동적(withSlugCols)이라 행 타입 추론이 안 된다 → unknown 경유 단언.
      const p = row as unknown as {
        id: string;
        product_type?: string;
        slug?: string | null;
        updated_at?: string;
      };
      entries.push(
        ...expand(productRelPath(p), {
          changeFrequency: 'weekly',
          priority: 0.9,
          lastModified: p.updated_at,
        }),
      );
    }
    for (const c of categories.data ?? []) {
      entries.push(
        ...expand(`/categories/${(c as { id: string }).id}`, {
          changeFrequency: 'weekly',
          priority: 0.6,
          lastModified: (c as { updated_at?: string }).updated_at,
        }),
      );
    }
  } catch {
    /* DB 조회 실패 시 정적 경로만으로 sitemap 유지 */
  }

  // 3) 동적: J&J 대회 에디션 (0052 미적용 환경에서도 조용히 건너뛴다)
  try {
    const { data } = await createClient()
      .from('jnj_editions')
      .select('slug')
      .eq('is_active', true)
      .limit(500);
    for (const e of data ?? []) {
      entries.push(
        ...expand(`/jnj/${(e as { slug: string }).slug}`, {
          changeFrequency: 'monthly',
          priority: 0.6,
        }),
      );
    }
  } catch {
    /* jnj_editions 미적용/조회 실패 → 에디션 URL 만 생략 */
  }

  return entries;
}
