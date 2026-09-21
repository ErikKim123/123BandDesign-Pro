// Design Ref: §5.4 회원관리 화면 — 목록 + 수정 드로어 + 계정 생성
'use client';
import { Suspense, useEffect, useState } from 'react';
import { tr } from '@/i18n/tr';
import { fmt } from '@/i18n/dict';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { ResourceListPage } from '@/components/resource/ResourceListPage';
import { ResourceFormPage } from '@/components/resource/ResourceFormPage';
import { FormDrawer } from '@/components/resource/FormDrawer';
import { CreateMemberForm } from '@/components/member/CreateMemberForm';
import { CountrySelect } from '@/components/form/CountrySelect';
import { BanButtons } from '@/components/member/BanButtons';
import { LoginStatusDot, LoginStatusInfo } from '@/components/member/LoginStatus';
import { IconButton } from '@/components/ui/IconButton';
import { NoticeComposer } from '@/components/notice/NoticeComposer';
import { useT } from '@/lib/locale/LocaleContext';
import { Activity, BellRing, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { membersConfig, type MemberRow } from '@/lib/resource/configs/members';

// 선택 삭제 바 — 선택된 회원(관리자 제외)들을 순차 완전 삭제.
function MembersBulkBar({ selected, clear }: { selected: MemberRow[]; clear: () => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  // 관리자 계정은 삭제 대상에서 제외(체크 자체가 막혀 있지만 방어적으로 한 번 더)
  const targets = selected.filter((m) => m.role !== 'admin');

  async function onDeleteSelected() {
    if (targets.length === 0) return;
    if (
      !window.confirm(
        `${targets.length}${tr('명의 회원을 완전 삭제하시겠어요? 로그인 계정까지 삭제되며 되돌릴 수 없습니다.')}`,
      )
    )
      return;
    setBusy(true);
    const failed: string[] = [];
    const blockedByOrder: string[] = []; // 주문 등 참조(FK, 409)로 막힌 회원
    try {
      for (const m of targets) {
        const r = await fetch('/api/users/delete', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ userId: m.id }),
        });
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string };
          if (r.status === 409) blockedByOrder.push(m.email ?? m.id);
          failed.push(`${m.email ?? m.id}: ${tr(j.error) || tr('삭제 실패')}`);
        }
      }
    } finally {
      setBusy(false);
      clear();
      qc.invalidateQueries({ queryKey: ['members'] });
    }

    if (blockedByOrder.length) {
      // 주문이 있어 삭제 불가 → 안내 후 주문관리로 이동 제안
      const goOrders = window.confirm(
        fmt(
          tr(
            '주문이 있어 삭제할 수 없는 회원이 있어요:\n{names}\n\n주문관리 페이지에서 해당 주문을 먼저 처리해야 삭제할 수 있어요.\n주문관리로 이동할까요?',
          ),
          { names: blockedByOrder.join(', ') },
        ),
      );
      if (goOrders) router.push('/orders');
      return;
    }
    if (failed.length) {
      window.alert(`${tr('일부 삭제에 실패했습니다.')}\n\n${failed.join('\n')}`);
    }
  }

  return (
    <button
      className="btn btn-primary btn-sm"
      disabled={busy || targets.length === 0}
      onClick={onDeleteSelected}
    >
      <Trash2 size={14} /> {busy ? tr('삭제 중…') : `${tr('선택 삭제')} (${targets.length})`}
    </button>
  );
}

// 선택 발송 — 고른 회원에게만 알림을 보낸다. 전체 발송은 알림관리 페이지에서.
function SendNoticeButton({ selected, clear }: { selected: MemberRow[]; clear: () => void }) {
  const [open, setOpen] = useState(false);
  const ids = selected.map((m) => m.id);

  return (
    <>
      <button className="btn btn-secondary btn-sm" disabled={ids.length === 0} onClick={() => setOpen(true)}>
        <BellRing size={14} /> {`${tr('알림 보내기')} (${ids.length})`}
      </button>
      <FormDrawer open={open} title={tr('알림 보내기')} onClose={() => setOpen(false)}>
        {open && (
          <NoticeComposer
            target={{ userIds: ids, label: `${tr('선택한 회원')} ${ids.length}${tr('명')}` }}
            onSent={() => {
              setOpen(false);
              clear();
            }}
          />
        )}
      </FormDrawer>
    </>
  );
}

function MemberActions({ row }: { row: MemberRow }) {
  const t = useT();
  const qc = useQueryClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (
      !window.confirm(
        `'${row.email ?? ''}' ${tr('회원을 완전 삭제하시겠어요? 로그인 계정까지 삭제되며 되돌릴 수 없습니다.')}`,
      )
    )
      return;
    setBusy(true);
    try {
      const r = await fetch('/api/users/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: row.id }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        // 409 = 주문 등 참조 데이터가 있어 삭제 불가 → 주문관리로 이동 제안
        if (r.status === 409) {
          const goOrders = window.confirm(
            fmt(
              tr(
                "'{email}' 회원은 주문이 있어 완전 삭제할 수 없어요.\n주문관리 페이지에서 해당 주문을 먼저 처리해야 삭제할 수 있어요.\n\n주문관리로 이동할까요?",
              ),
              { email: row.email ?? '' },
            ),
          );
          if (goOrders) router.push('/orders');
        } else {
          window.alert(tr(j.error) || tr('삭제에 실패했습니다.'));
        }
        return;
      }
      qc.invalidateQueries({ queryKey: ['members'] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {/* 활동 추적 — 회원활동 드로어로. 조치(차단·삭제)와 나란히 두어 '보고 나서 조치' 흐름이 한 줄에 있다. */}
      <IconButton icon={Activity} label={tr('활동 보기')} onClick={() => router.push(`/member-activity?member=${row.id}`)} />
      <BanButtons userId={row.id} />
      {/* 관리자 계정은 삭제 불가(자가 삭제 방지). 주문 참조가 있으면 서버가 차단 안내. */}
      {row.role !== 'admin' && (
        <IconButton icon={Trash2} label={t.actions.delete} danger disabled={busy} onClick={onDelete} />
      )}
    </div>
  );
}

// useSearchParams 는 Suspense 경계가 필요하다(Next CSR bailout).
export default function MembersPage() {
  return (
    <Suspense fallback={null}>
      <MembersView />
    </Suspense>
  );
}

function MembersView() {
  const params = useSearchParams();
  const router = useRouter();
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [creating, setCreating] = useState(false);

  // 회원활동 드로어의 '회원관리' 링크로 오면 ?edit=<id> — 그 회원의 수정 드로어를 바로 연다.
  const editParam = params.get('edit');
  useEffect(() => {
    if (!editParam) return;
    void createClient()
      .from('profiles')
      .select(membersConfig.selectColumns ?? '*')
      .eq('id', editParam)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setEditing(data as unknown as Record<string, unknown>);
      });
  }, [editParam]);
  function closeEdit() {
    setEditing(null);
    if (editParam) router.replace('/members', { scroll: false });
  }

  // 로그인 상태 컬럼 — 초록: 로그인 중 / 주황: 세션 유지(무활동) / 회색: 로그아웃
  const statusCol: ColumnDef<MemberRow, unknown> = {
    id: 'login_status',
    header: tr('접속'),
    cell: (c) => <LoginStatusDot userId={c.row.original.id} />,
  };
  // 차단/해제 + 삭제 액션 컬럼 (계정 = profiles.id = auth.users.id)
  const actionCol: ColumnDef<MemberRow, unknown> = {
    id: 'actions',
    header: tr('계정'),
    cell: (c) => <MemberActions row={c.row.original} />,
  };
  // canCreate 활성화 → 목록 헤더의 '추가' 버튼이 계정 생성 폼을 연다.
  const config = { ...membersConfig, canCreate: true, listColumns: [...membersConfig.listColumns, statusCol, actionCol] };

  return (
    <>
      <ResourceListPage
        config={config as never}
        onRowClick={(row) => setEditing(row as unknown as Record<string, unknown>)}
        onCreate={() => setCreating(true)}
        selectable
        isRowSelectable={(row: MemberRow) => row.role !== 'admin'}
        renderBulkBar={({ selected, clear }: { selected: MemberRow[]; clear: () => void }) => (
          <div className="flex flex-wrap items-center gap-2">
            <SendNoticeButton selected={selected} clear={clear} />
            <MembersBulkBar selected={selected} clear={clear} />
          </div>
        )}
      />
      <FormDrawer open={!!editing} title={tr('회원 수정')} onClose={closeEdit}>
        <ResourceFormPage
          config={membersConfig as never}
          initial={editing}
          onDone={closeEdit}
          renderCustom={(field, value, set, allValues) =>
            field.name === 'country' ? (
              <div className="space-y-1.5">
                <label className="label-caps">{field.label}</label>
                <CountrySelect
                  value={(value as string) ?? undefined}
                  onChange={(cc) => set(cc ?? null)}
                />
              </div>
            ) : field.name === 'login_status' ? (
              <LoginStatusInfo userId={String(allValues.id ?? '')} />
            ) : null
          }
        />
      </FormDrawer>
      <FormDrawer open={creating} title={tr('회원 계정 생성')} onClose={() => setCreating(false)}>
        <CreateMemberForm onDone={() => setCreating(false)} />
      </FormDrawer>
    </>
  );
}
