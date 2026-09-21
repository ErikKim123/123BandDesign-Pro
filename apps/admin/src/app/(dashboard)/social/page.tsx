// Design Ref: 소셜관리 — 현황/랭킹 · 하트 내역 · 추천 현황 · 회원 소셜 상태 (탭)
// 소셜 하트 = 소셜 댄스 후 서로에게 보내는 "고마움". 회원 QR 을 스캔한 상대에게만
// 하루 1번 보낼 수 있고, 생성은 give_social_heart RPC 로만 가능하다(어드민도 생성 불가).
'use client';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { fmt } from '@/i18n/dict';
import { ResourceListPage } from '@/components/resource/ResourceListPage';
import { useResourceBulkDelete } from '@/lib/queries/resource';
import { SocialStats } from '@/components/social/SocialStats';
import { SocialMembersPanel } from '@/components/social/SocialMembersPanel';
import { socialHeartsConfig, type SocialHeartRow } from '@/lib/resource/configs/social-hearts';
import { socialReferralsConfig } from '@/lib/resource/configs/social-referrals';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'stats', label: '현황 · 랭킹' },
  { key: 'hearts', label: '하트 내역' },
  { key: 'referrals', label: '추천 현황' },
  { key: 'members', label: '회원 소셜 상태' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

// 신고 대응용 하트 삭제 — 목록은 뷰(social_hearts_v)지만 삭제는 기반 테이블로 보낸다.
function HeartBulkBar({ selected, clear }: { selected: SocialHeartRow[]; clear: () => void }) {
  const bulk = useResourceBulkDelete('social_hearts', 'social-hearts');
  async function onDelete() {
    if (!selected.length) return;
    if (!window.confirm(fmt(tr('선택한 {n}개 하트를 삭제하시겠어요? 되돌릴 수 없습니다.'), { n: selected.length })))
      return;
    await bulk.mutateAsync(selected.map((h) => h.id));
    clear();
  }
  return (
    <button
      className="btn btn-primary btn-sm"
      disabled={bulk.isPending || !selected.length}
      onClick={onDelete}
    >
      <Trash2 size={14} />{' '}
      {bulk.isPending ? tr('삭제 중…') : `${tr('선택 삭제')} (${selected.length})`}
    </button>
  );
}

export default function SocialPage() {
  const [tab, setTab] = useState<TabKey>('stats');

  return (
    <div className="space-y-5">
      <h1 className="text-2xl uppercase tracking-tight">{tr('소셜관리')}</h1>

      <p className="text-sm text-grey-600">
        {tr('회원이 마이페이지의 내 QR을 서로 스캔해 "고마움" 하트를 주고받습니다. 같은 상대에게는 하루 1번만 보낼 수 있고, 같은 QR로 친구 추천(가입)도 기록됩니다.')}
      </p>

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

      {tab === 'stats' && <SocialStats />}
      {tab === 'hearts' && (
        <ResourceListPage
          config={socialHeartsConfig as never}
          selectable
          renderBulkBar={({ selected, clear }: { selected: SocialHeartRow[]; clear: () => void }) => (
            <HeartBulkBar selected={selected} clear={clear} />
          )}
        />
      )}
      {tab === 'referrals' && <ResourceListPage config={socialReferralsConfig as never} />}
      {tab === 'members' && <SocialMembersPanel />}
    </div>
  );
}
