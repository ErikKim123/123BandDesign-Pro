// Design Ref: §5.4 오거나이저관리 — 목록 + 승인 전이 + 편집 드로어
'use client';
import { useState } from 'react';
import { tr } from '@/i18n/tr';
import type { ColumnDef } from '@tanstack/react-table';
import { ResourceListPage } from '@/components/resource/ResourceListPage';
import { ResourceFormPage } from '@/components/resource/ResourceFormPage';
import { FormDrawer } from '@/components/resource/FormDrawer';
import {
  useStatusTransition,
  useResourceDelete,
  useResourceBulkDelete,
} from '@/lib/queries/resource';
import { CreatePartnerForm } from '@/components/partner/CreatePartnerForm';
import { BanButtons } from '@/components/member/BanButtons';
import { IconButton } from '@/components/ui/IconButton';
import { useT } from '@/lib/locale/LocaleContext';
import { fmt } from '@/i18n/dict';
import {
  CheckCircle2,
  XCircle,
  PauseCircle,
  PlayCircle,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import {
  partnersConfig,
  PARTNER_TRANSITIONS,
  type PartnerRow,
} from '@/lib/resource/configs/partners';

function PartnerActions({ row }: { row: PartnerRow }) {
  const t = useT();
  const a = t.actions;
  const transition = useStatusTransition('partners', 'partners');
  const del = useResourceDelete('partners', 'partners');
  const allowed = PARTNER_TRANSITIONS[row.status] ?? [];
  const busy = transition.isPending || del.isPending;

  // (현재상태 → 전이대상) 조합별 아이콘 + 툴팁(설명)
  const meta = (to: string): { icon: LucideIcon; label: string; danger?: boolean } => {
    switch (`${row.status}->${to}`) {
      case 'pending->active':
        return { icon: CheckCircle2, label: a.approve };
      case 'pending->suspended':
        return { icon: XCircle, label: a.reject, danger: true };
      case 'active->suspended':
        return { icon: PauseCircle, label: a.suspend };
      case 'suspended->active':
        return { icon: PlayCircle, label: a.restore };
      default:
        return { icon: CheckCircle2, label: to };
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {allowed.map((tr) => {
        const m = meta(tr.to);
        return (
          <IconButton
            key={tr.to}
            icon={m.icon}
            label={m.label}
            danger={m.danger}
            disabled={busy}
            onClick={() => transition.mutate({ id: row.id, status: tr.to })}
          />
        );
      })}
      {/* 로그인 계정 차단/해제 (partners.user_id = auth.users.id) */}
      <BanButtons userId={row.user_id} />
      {/* 오거나이저 레코드 삭제 (주문/참조가 있으면 FK 보호로 차단) */}
      <IconButton
        icon={Trash2}
        label={a.delete}
        danger
        disabled={busy}
        onClick={() => {
          if (window.confirm(fmt(a.confirmDelete, { name: row.company_name ?? '' })))
            del.mutate(row.id);
        }}
      />
    </div>
  );
}

// 선택 삭제 바 — 선택된 오거나이저 레코드를 일괄 삭제(주문/참조가 있으면 삭제 불가 안내).
function PartnersBulkBar({ selected, clear }: { selected: PartnerRow[]; clear: () => void }) {
  const t = useT();
  const bulk = useResourceBulkDelete('partners', 'partners');
  const nameOf = (p: PartnerRow) => p.company_name || p.id;

  async function onDelete() {
    if (!selected.length) return;
    if (
      !window.confirm(
        fmt(tr('선택한 {n}개 오거나이저를 삭제하시겠어요? (로그인 계정은 유지됩니다) 되돌릴 수 없습니다.'), {
          n: selected.length,
        }),
      )
    )
      return;
    const res = await bulk.mutateAsync(selected.map((p) => p.id));
    clear();
    const msgs: string[] = [];
    if (res.deleted) msgs.push(fmt(tr('{n}개 삭제됨'), { n: res.deleted }));
    if (res.blocked.length) {
      const names = selected.filter((p) => res.blocked.includes(p.id)).map(nameOf);
      msgs.push(
        fmt(tr('주문/참조가 있어 삭제 불가 ({names})\n→ 대신 "차단/정지"를 사용하세요.'), {
          names: names.join(', '),
        }),
      );
    }
    if (res.failed.length) {
      const names = selected.filter((p) => res.failed.includes(p.id)).map(nameOf);
      msgs.push(fmt(tr('삭제 실패 ({names})'), { names: names.join(', ') }));
    }
    if (msgs.length) window.alert(msgs.join('\n\n'));
  }

  return (
    <button className="btn btn-primary btn-sm" disabled={bulk.isPending || !selected.length} onClick={onDelete}>
      <Trash2 size={14} /> {bulk.isPending ? tr('삭제 중…') : `${tr('선택 삭제')} (${selected.length})`}
    </button>
  );
}

export default function PartnersPage() {
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [creating, setCreating] = useState(false);

  // 액션 컬럼을 동적으로 덧붙임 (Plan SC: 오거나이저 승인 흐름)
  const actionCol: ColumnDef<PartnerRow, unknown> = {
    id: 'actions',
    header: '승인/상태', // DataTable 이 렌더 시 카탈로그로 번역
    cell: (c) => <PartnerActions row={c.row.original} />,
  };
  // canCreate 활성화 → 목록 헤더의 '추가' 버튼이 계정 생성 폼을 연다.
  const config = {
    ...partnersConfig,
    canCreate: true,
    listColumns: [...partnersConfig.listColumns, actionCol],
  };

  return (
    <>
      <ResourceListPage
        config={config as never}
        onRowClick={(row) => setEditing(row as unknown as Record<string, unknown>)}
        onCreate={() => setCreating(true)}
        selectable
        renderBulkBar={({ selected, clear }: { selected: PartnerRow[]; clear: () => void }) => (
          <PartnersBulkBar selected={selected} clear={clear} />
        )}
      />
      <FormDrawer open={!!editing} title={tr('오거나이저 편집')} onClose={() => setEditing(null)}>
        <ResourceFormPage
          config={partnersConfig as never}
          initial={editing}
          onDone={() => setEditing(null)}
        />
      </FormDrawer>
      <FormDrawer open={creating} title={tr('오거나이저 계정 생성')} onClose={() => setCreating(false)}>
        <CreatePartnerForm onDone={() => setCreating(false)} />
      </FormDrawer>
    </>
  );
}
