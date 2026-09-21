// Design Ref: 포인트관리 — 회원 보유현황 / 적립·사용 내역 / 쿠폰 교환 내역 / 정책 설정 (탭)
'use client';
import { useState } from 'react';
import { tr } from '@/i18n/tr';
import type { ColumnDef } from '@tanstack/react-table';
import { ResourceListPage } from '@/components/resource/ResourceListPage';
import { FormDrawer } from '@/components/resource/FormDrawer';
import { PointAdjustForm } from '@/components/point/PointAdjustForm';
import { PointPolicyForm } from '@/components/point/PointPolicyForm';
import { pointBalancesConfig, type PointBalanceRow } from '@/lib/resource/configs/point-balances';
import { pointLedgerConfig } from '@/lib/resource/configs/point-ledger';
import { userCouponsConfig } from '@/lib/resource/configs/user-coupons';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'balances', label: '회원 포인트' },
  { key: 'ledger', label: '적립/사용 내역' },
  { key: 'exchanges', label: '쿠폰 교환 내역' },
  { key: 'policy', label: '정책 설정' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function PointsPage() {
  const [tab, setTab] = useState<TabKey>('balances');
  const [adjusting, setAdjusting] = useState<PointBalanceRow | null>(null);

  // 행 클릭 = 지급/차감 — 목록에도 버튼을 노출해 동작을 분명히 한다.
  const actionCol: ColumnDef<PointBalanceRow, unknown> = {
    id: 'actions',
    header: '처리',
    cell: (c) => (
      <button
        className="btn btn-secondary btn-sm"
        onClick={(e) => {
          e.stopPropagation();
          setAdjusting(c.row.original);
        }}
      >
        {tr('지급/차감')}
      </button>
    ),
  };
  const balancesConfig = {
    ...pointBalancesConfig,
    listColumns: [...pointBalancesConfig.listColumns, actionCol],
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl uppercase tracking-tight">{tr('포인트관리')}</h1>

      <div className="flex flex-wrap gap-1 border-b border-grey-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm transition-colors',
              tab === t.key
                ? 'border-black font-medium text-ink'
                : 'border-transparent text-grey-500 hover:text-grey-700',
            )}
          >
            {tr(t.label)}
          </button>
        ))}
      </div>

      {tab === 'balances' && (
        <ResourceListPage
          config={balancesConfig as never}
          onRowClick={(row) => setAdjusting(row as PointBalanceRow)}
        />
      )}
      {tab === 'ledger' && <ResourceListPage config={pointLedgerConfig as never} />}
      {tab === 'exchanges' && <ResourceListPage config={userCouponsConfig as never} />}
      {tab === 'policy' && <PointPolicyForm />}

      <FormDrawer open={!!adjusting} title={tr('포인트 지급/차감')} onClose={() => setAdjusting(null)}>
        {adjusting && <PointAdjustForm member={adjusting} onDone={() => setAdjusting(null)} />}
      </FormDrawer>
    </div>
  );
}
