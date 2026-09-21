// Design Ref: 스탬프관리 — 회원 보유현황 / 적립·소진 내역 / 발급 쿠폰 / 정책 설정 (탭)
// 포인트관리와 같은 구조다. 다른 점은 "잔액"이 아니라 "카드 진행도"라는 것 —
// 카드가 차면 쿠폰으로 바뀌며 그만큼 소진되므로 숫자가 늘기만 하지 않는다.
'use client';
import { useState } from 'react';
import { tr } from '@/i18n/tr';
import type { ColumnDef } from '@tanstack/react-table';
import { ResourceListPage } from '@/components/resource/ResourceListPage';
import { FormDrawer } from '@/components/resource/FormDrawer';
import { StampAdjustForm } from '@/components/stamp/StampAdjustForm';
import { StampPolicyForm } from '@/components/stamp/StampPolicyForm';
import { stampBalancesConfig, type StampBalanceRow } from '@/lib/resource/configs/stamp-balances';
import { stampLedgerConfig } from '@/lib/resource/configs/stamp-ledger';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'balances', label: '회원 스탬프' },
  { key: 'ledger', label: '적립/소진 내역' },
  { key: 'policy', label: '정책 설정' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function StampsPage() {
  const [tab, setTab] = useState<TabKey>('balances');
  const [adjusting, setAdjusting] = useState<StampBalanceRow | null>(null);

  // 행 클릭 = 지급/차감 — 목록에도 버튼을 노출해 동작을 분명히 한다.
  const actionCol: ColumnDef<StampBalanceRow, unknown> = {
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
    ...stampBalancesConfig,
    listColumns: [...stampBalancesConfig.listColumns, actionCol],
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl uppercase tracking-tight">{tr('스탬프관리')}</h1>

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
          onRowClick={(row) => setAdjusting(row as StampBalanceRow)}
        />
      )}
      {tab === 'ledger' && <ResourceListPage config={stampLedgerConfig as never} />}
      {tab === 'policy' && <StampPolicyForm />}

      <FormDrawer
        open={!!adjusting}
        title={tr('스탬프 지급/차감')}
        onClose={() => setAdjusting(null)}
      >
        {adjusting && <StampAdjustForm member={adjusting} onDone={() => setAdjusting(null)} />}
      </FormDrawer>
    </div>
  );
}
