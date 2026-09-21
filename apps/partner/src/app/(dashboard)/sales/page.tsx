// 판매·정산 (오거나이저) — 서버에서 인증/집계 후 클라이언트 뷰(SalesView)에 주입.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getPartnerSettlement } from '@/lib/queries/partner-stats';
import { SalesView } from './SalesView';

export const dynamic = 'force-dynamic';

export default async function SalesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const data = await getPartnerSettlement(user.id);
  return <SalesView data={data} />;
}
