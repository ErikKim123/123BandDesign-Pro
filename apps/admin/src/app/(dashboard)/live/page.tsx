// 라이브 방송관리 — 목록 + 전용 편집 드로어.
// 방송 1건 = 유튜브 라이브 1개. 앵글 전환은 각 방송의 스위처 콘솔(/live/[id]/switcher)에서 한다.
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Copy, SlidersHorizontal, Trash2 } from 'lucide-react';
import { ResourceListPage } from '@/components/resource/ResourceListPage';
import { FormDrawer } from '@/components/resource/FormDrawer';
import { LiveBroadcastForm } from '@/components/live/LiveBroadcastForm';
import { liveBroadcastsConfig } from '@/lib/resource/configs/live-broadcasts';
import { useResourceBulkDelete, useResourceDelete } from '@/lib/queries/resource';
import { useDuplicateBroadcasts } from '@/lib/queries/live';
import type { LiveBroadcastRow } from '@/lib/queries/live';
import { IconButton } from '@/components/ui/IconButton';
import { tr, trI18n } from '@/i18n/tr';
import { fmt } from '@/i18n/dict';

function RowActions({ row }: { row: LiveBroadcastRow }) {
  const del = useResourceDelete('live_broadcasts', 'live_broadcasts');
  const name = trI18n(row.title_i18n) || row.slug;
  return (
    <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
      <Link
        href={`/live/${row.id}/switcher`}
        className="btn btn-secondary btn-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <SlidersHorizontal size={14} /> {tr('스위처')}
      </Link>
      <IconButton
        icon={Trash2}
        label={tr('삭제')}
        disabled={del.isPending}
        onClick={() => {
          if (!window.confirm(fmt(tr('{name} 방송을 삭제할까요? 카메라·전환 기록도 함께 지워집니다.'), { name })))
            return;
          del.mutate(row.id);
        }}
      />
    </div>
  );
}

/** 선택 액션 바 — 체크한 방송을 복사하거나 지운다. 복사는 카메라 세팅을 그대로 가져오는 게 목적. */
function BulkBar({ selected, clear }: { selected: LiveBroadcastRow[]; clear: () => void }) {
  const dup = useDuplicateBroadcasts();
  const del = useResourceBulkDelete('live_broadcasts', 'live_broadcasts');
  const busy = dup.isPending || del.isPending;

  async function onCopy() {
    if (!selected.length) return;
    await dup.mutateAsync(selected.map((r) => r.id));
    clear();
  }
  async function onDelete() {
    if (!selected.length) return;
    if (
      !window.confirm(
        fmt(tr('선택한 {n}개 방송을 삭제할까요? 카메라·전환 기록도 함께 지워집니다.'), {
          n: selected.length,
        }),
      )
    )
      return;
    await del.mutateAsync(selected.map((r) => r.id));
    clear();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-grey-500">
        {tr('복사본은 예정 상태로 만들어지고, 유튜브 영상은 비워집니다.')}
      </span>
      <button className="btn btn-secondary btn-sm" disabled={busy} onClick={onCopy}>
        <Copy size={14} /> {dup.isPending ? tr('복사 중…') : `${tr('선택 복사')} (${selected.length})`}
      </button>
      <button className="btn btn-primary btn-sm" disabled={busy} onClick={onDelete}>
        <Trash2 size={14} /> {del.isPending ? tr('삭제 중…') : `${tr('선택 삭제')} (${selected.length})`}
      </button>
    </div>
  );
}

export default function LiveBroadcastsPage() {
  // undefined = 닫힘 / null = 신규 / 객체 = 편집
  const [editing, setEditing] = useState<Partial<LiveBroadcastRow> | null | undefined>(undefined);
  const open = editing !== undefined;

  const config = {
    ...liveBroadcastsConfig,
    listColumns: [
      ...liveBroadcastsConfig.listColumns,
      {
        id: 'actions',
        header: '',
        cell: ({ row }: { row: { original: LiveBroadcastRow } }) => (
          <RowActions row={row.original} />
        ),
      },
    ],
  } as typeof liveBroadcastsConfig;

  return (
    <>
      <ResourceListPage
        config={config}
        selectable
        renderBulkBar={({ selected, clear }) => <BulkBar selected={selected} clear={clear} />}
        onRowClick={(row) => setEditing(row)}
        onCreate={() => setEditing(null)}
      />
      <FormDrawer
        open={open}
        size="wide"
        title={editing ? tr('라이브 방송 수정') : tr('라이브 방송 추가')}
        onClose={() => setEditing(undefined)}
      >
        <LiveBroadcastForm initial={editing ?? null} onDone={() => setEditing(undefined)} />
      </FormDrawer>
    </>
  );
}
