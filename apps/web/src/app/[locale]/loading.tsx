// /[locale] 하위 전체의 기본 로딩 자리표시. 목록형 화면(shop·events·jnj)은 자체 loading.tsx 로 덮는다.
import { SkeletonPage } from '@/components/layout/Skeleton';

export default function Loading() {
  return <SkeletonPage />;
}
