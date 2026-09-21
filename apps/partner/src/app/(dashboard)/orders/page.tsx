// 주문관리 (오거나이저) — 서버에서 인증 후 내 상품이 포함된 주문만 조회해 뷰(OrdersView)에 주입.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getPartnerOrders } from '@/lib/queries/partner-orders';
import { OrdersView } from './OrdersView';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const rows = await getPartnerOrders(user.id);
  return <OrdersView rows={rows} />;
}
