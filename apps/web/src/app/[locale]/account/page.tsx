// 마이페이지 진입점 — 탭 구조로 바뀌면서 기본 탭(주문내역)으로 보낸다.
// 공통 헤더(캐릭터/QR/요약)와 탭은 account/layout.tsx 가 담당한다.
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function AccountPage({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/account/orders`);
}
