// Design Ref: 코드관리 — 목록 + 생성/수정 드로어 + 선택 삭제
'use client';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { fmt } from '@/i18n/dict';
import { ResourceListPage } from '@/components/resource/ResourceListPage';
import { ResourceFormPage } from '@/components/resource/ResourceFormPage';
import { FormDrawer } from '@/components/resource/FormDrawer';
import { useResourceBulkDelete } from '@/lib/queries/resource';
import { createClient } from '@/lib/supabase/client';
import { codeValuesConfig, type CodeValueRow } from '@/lib/resource/configs/code-values';

/**
 * 선택 삭제.
 *
 * 시스템 코드는 지우지 않는다. code 는 우승자·점수·참가자 행에 그대로 저장돼 있어서,
 * 지우면 그 데이터가 어느 부문이었는지 알 수 없어진다. 화면에서도 '사용 안 함'으로
 * 끄라고 안내하고, 시스템 코드가 섞여 있으면 그것만 빼고 지운다.
 */
function BulkBar({ selected, clear }: { selected: CodeValueRow[]; clear: () => void }) {
  const bulk = useResourceBulkDelete('code_values', 'code_values');
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!selected.length) return;

    // 1) 시스템 코드 — 코드가 참조하는 값이라 애초에 대상이 아니다.
    const system = selected.filter((r) => r.is_system);
    let targets = selected.filter((r) => !r.is_system);

    // 2) 쓰이고 있는 코드 — 지우면 그 데이터가 코드명 없이 raw 값으로 나온다.
    //    외래키가 아니라 DB 는 막아 주지 않으므로 여기서 세어 보고 막는다(0097).
    setBusy(true);
    const inUse: { row: CodeValueRow; where: string }[] = [];
    try {
      const byGroup = new Map<string, CodeValueRow[]>();
      for (const r of targets) {
        const list = byGroup.get(r.group_key) ?? [];
        list.push(r);
        byGroup.set(r.group_key, list);
      }
      for (const [group, rows] of byGroup) {
        const { data, error } = await createClient().rpc('code_value_usage', {
          p_group: group,
          p_codes: rows.map((r) => r.code),
        });
        if (error) continue; // 0097 미적용 — 확인을 못 했다고 삭제까지 막지는 않는다
        const usage = (data ?? {}) as Record<string, Record<string, number>>;
        for (const r of rows) {
          const u = usage[r.code];
          if (u && Object.keys(u).length) {
            inUse.push({
              row: r,
              where: Object.entries(u)
                .map(([k, v]) => `${tr(k)} ${v}${tr('건')}`)
                .join(', '),
            });
          }
        }
      }
    } finally {
      setBusy(false);
    }

    const blocked = new Set(inUse.map((x) => x.row.id));
    targets = targets.filter((r) => !blocked.has(r.id));

    // 3) 막힌 것들을 먼저 알린다 — 왜 안 지워지는지 모르면 같은 시도를 반복한다.
    const notes: string[] = [];
    if (system.length) notes.push(fmt(tr('시스템 코드 {n}개'), { n: system.length }));
    if (inUse.length) {
      notes.push(
        tr('사용 중인 코드:') +
          '\n' +
          inUse.map((x) => `  · ${x.row.code} — ${x.where}`).join('\n'),
      );
    }

    if (!targets.length) {
      window.alert(
        tr('지울 수 있는 코드가 없습니다.') + (notes.length ? '\n\n' + notes.join('\n') : ''),
      );
      return;
    }

    const warn = notes.length ? '\n\n' + tr('아래는 빼고 지웁니다.') + '\n' + notes.join('\n') : '';
    if (
      !window.confirm(
        fmt(tr('코드값 {n}개를 삭제하시겠어요? 이미 이 코드로 저장된 데이터는 코드 그대로 남습니다.'), {
          n: targets.length,
        }) + warn,
      )
    )
      return;

    await bulk.mutateAsync(targets.map((r) => r.id));
    clear();
  }

  // 버튼 숫자는 '시스템을 뺀 개수'. 사용 중 여부는 눌러야 알 수 있어서(조회가 필요하다)
  // 여기서는 세지 않는다 — 누르면 확인 후 걸러 준다.
  const deletable = selected.filter((r) => !r.is_system).length;

  return (
    <div className="flex gap-2">
      <button
        className="btn btn-primary btn-sm"
        disabled={busy || bulk.isPending || !selected.length}
        onClick={onDelete}
      >
        <Trash2 size={14} />{' '}
        {busy
          ? tr('사용 여부 확인 중…')
          : bulk.isPending
            ? tr('삭제 중…')
            : `${tr('선택 삭제')} (${deletable})`}
      </button>
    </div>
  );
}

export default function CodeValuesPage() {
  const [editing, setEditing] = useState<Record<string, unknown> | null | undefined>(undefined);
  const open = editing !== undefined;

  return (
    <>
      <ResourceListPage
        config={codeValuesConfig as never}
        onRowClick={(row) => setEditing(row as unknown as Record<string, unknown>)}
        onCreate={() => setEditing(null)}
        selectable
        renderBulkBar={({ selected, clear }: { selected: CodeValueRow[]; clear: () => void }) => (
          <BulkBar selected={selected} clear={clear} />
        )}
      />
      <FormDrawer
        open={open}
        title={editing ? tr('코드값 수정') : tr('코드값 추가')}
        onClose={() => setEditing(undefined)}
      >
        <ResourceFormPage
          config={codeValuesConfig as never}
          initial={editing ?? null}
          onDone={() => setEditing(undefined)}
        />
      </FormDrawer>
    </>
  );
}
