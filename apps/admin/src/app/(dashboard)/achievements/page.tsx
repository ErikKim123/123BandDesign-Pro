// Design Ref: 업적관리 — 업적 목록(뱃지 등록 포함) / 회원 획득 현황 (탭)
'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { tr, trI18n } from '@/i18n/tr';
import { RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { ResourceListPage } from '@/components/resource/ResourceListPage';
import { ResourceFormPage } from '@/components/resource/ResourceFormPage';
import { FormDrawer } from '@/components/resource/FormDrawer';
import { BadgeImageField } from '@/components/achievement/BadgeImageField';
import { AchievementConditions } from '@/components/achievement/AchievementConditions';
import { AchievementCard } from '@/components/achievement/AchievementCard';
import { ManualGrantButton, ManualGrantPanel } from '@/components/achievement/ManualGrant';
import { StationsPanel } from '@/components/achievement/StationsPanel';
import { achievementsConfig, type AchievementRow } from '@/lib/resource/configs/achievements';
import { userAchievementsConfig } from '@/lib/resource/configs/user-achievements';
import { createClient } from '@/lib/supabase/client';
import { NULL_FILTER } from '@/lib/queries/resource';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'catalog', label: '업적 목록' },
  { key: 'earned', label: '회원 획득 현황' },
  { key: 'stations', label: '현장 QR' },
  { key: 'grant', label: '수동 지급' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

// 업적을 새로 만들거나 조건을 바꾼 뒤, 이미 조건을 만족한 회원에게 소급 지급한다.
function ReevaluateButton() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function run() {
    if (
      !window.confirm(
        tr('전체 회원을 대상으로 업적 달성 여부를 다시 확인할까요?\n조건을 이미 만족한 회원에게 뱃지가 소급 지급됩니다.'),
      )
    )
      return;
    setBusy(true);
    try {
      const { data, error } = await createClient().rpc('reevaluate_all_achievements');
      if (error) {
        window.alert(`${tr('재평가에 실패했습니다')}: ${error.message}`);
        return;
      }
      qc.invalidateQueries({ queryKey: ['user-achievements'] });
      window.alert(`${tr('재평가 완료 — 새로 지급된 업적')} ${Number(data ?? 0).toLocaleString()}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="btn btn-secondary btn-sm" disabled={busy} onClick={run}>
      <RefreshCw size={14} /> {busy ? tr('재평가 중…') : tr('전체 회원 재평가')}
    </button>
  );
}

interface EventOpt {
  id: string;
  name_i18n: Record<string, string> | null;
}

/** 적용 행사 — 비우면 모든 행사 공통, 고르면 그 행사 전용(조건도 그 행사 기록만 센다). */
function EventScopeField({
  label,
  value,
  set,
  events,
}: {
  label: string;
  value: unknown;
  set: (v: unknown) => void;
  events: EventOpt[];
}) {
  return (
    <div className="space-y-1.5">
      <label className="label-caps">{tr(label)}</label>
      <select
        className="input"
        value={(value as string | null) ?? ''}
        onChange={(e) => set(e.target.value || null)}
      >
        <option value="">{tr('공통 (모든 행사)')}</option>
        {events.map((e) => (
          <option key={e.id} value={e.id}>
            {trI18n(e.name_i18n) || e.id}
          </option>
        ))}
      </select>
      <p className="text-xs text-grey-500">
        {tr('행사를 고르면 그 행사 전용 뱃지가 됩니다. 패스 구매·주문·얼리버드·입장 체크인·후기·문의·피드백 설문 조건은 그 행사 기록만 셉니다.')}
      </p>
    </div>
  );
}

// useSearchParams 는 Suspense 경계가 필요하다(Next CSR bailout).
export default function AchievementsPage() {
  return (
    <Suspense fallback={null}>
      <AchievementsView />
    </Suspense>
  );
}

function AchievementsView() {
  const params = useSearchParams();
  // 회원활동에서 '업적 지급'으로 넘어오면 ?member=<id> — 수동 지급 탭을 그 회원으로 연다.
  const memberParam = params.get('member');
  const [tab, setTab] = useState<TabKey>(memberParam ? 'grant' : 'catalog');
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [creating, setCreating] = useState(false);
  const [events, setEvents] = useState<EventOpt[]>([]);

  useEffect(() => {
    void createClient()
      .from('products')
      .select('id, name_i18n')
      .eq('product_type', 'ticket')
      .order('created_at', { ascending: false })
      .then(({ data }) => setEvents((data ?? []) as EventOpt[]));
  }, []);
  const eventName = useMemo(() => {
    const m = new Map(events.map((e) => [e.id, trI18n(e.name_i18n) || e.id]));
    return (id: string | null) => (id ? m.get(id) : undefined);
  }, [events]);

  // 행사 필터는 행사 목록을 받은 뒤에 옵션이 채워진다 — 공통 / 행사별.
  const config = useMemo(
    () => ({
      ...achievementsConfig,
      filters: [
        ...achievementsConfig.filters,
        {
          name: 'product_id',
          label: '행사',
          kind: 'select' as const,
          options: [
            { value: NULL_FILTER, label: '공통' },
            ...events.map((e) => ({ value: e.id, label: trI18n(e.name_i18n) || e.id })),
          ],
        },
      ],
    }),
    [events],
  );

  const form = (initial: Record<string, unknown> | null, onDone: () => void) => (
    <ResourceFormPage
      config={config as never}
      initial={initial}
      onDone={onDone}
      renderCustom={((
        field: { name: string; label: string },
        value: unknown,
        set: (v: unknown) => void,
        allValues: Record<string, unknown>,
      ) => {
        if (field.name === 'badge_image_url') {
          return (
            <div className="space-y-1.5">
              <label className="label-caps">{tr(field.label)}</label>
              <BadgeImageField
                value={value as string | undefined}
                set={set as (v: string | null) => void}
                allValues={allValues}
              />
            </div>
          );
        }
        if (field.name === 'product_id') {
          return <EventScopeField label={field.label} value={value} set={set} events={events} />;
        }
        if (field.name === 'conditions') {
          return <AchievementConditions value={value} set={set} />;
        }
        return null;
      }) as never}
    />
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl uppercase tracking-tight">{tr('업적관리')}</h1>
        <div className="flex flex-wrap gap-2">
          <ManualGrantButton />
          <ReevaluateButton />
        </div>
      </div>

      <p className="text-sm text-grey-600">
        {tr('회원이 정해진 임무(조건)를 모두 달성하면 업적을 얻고 뱃지를 받습니다. 조건은 결제·구독·후기 작성 등이 일어날 때마다 자동으로 확인됩니다.')}{' '}
        {tr('현장 스캔·SNS 태그처럼 자동으로 확인할 수 없는 업적은 수동 지급으로 줍니다. 전체 목록과 판정 방식은 docs/achievements.md 에 있습니다.')}
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

      {tab === 'catalog' && (
        // 목록은 뱃지 이미지 중심 카드 보기 — 어떤 뱃지인지 눈으로 먼저 확인하고 눌러서 수정한다.
        <ResourceListPage
          config={config as never}
          onRowClick={(row) => setEditing(row as Record<string, unknown>)}
          onCreate={() => setCreating(true)}
          renderCard={((row: AchievementRow) => (
            <AchievementCard row={row} eventName={eventName(row.product_id)} />
          )) as never}
        />
      )}
      {tab === 'earned' && <ResourceListPage config={userAchievementsConfig as never} />}
      {tab === 'stations' && <StationsPanel />}
      {tab === 'grant' && <ManualGrantPanel initialMemberId={memberParam} />}

      <FormDrawer open={!!editing} title={tr('업적 수정')} onClose={() => setEditing(null)}>
        {editing && form(editing, () => setEditing(null))}
      </FormDrawer>
      <FormDrawer open={creating} title={tr('업적 추가')} onClose={() => setCreating(false)}>
        {creating && form(null, () => setCreating(false))}
      </FormDrawer>
    </div>
  );
}
