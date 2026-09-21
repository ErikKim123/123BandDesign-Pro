// Design Ref: §5.4 메인화면관리 — 메인 배너(히어로 슬라이드) 관리 + 메인 섹션 목록/드로어
'use client';
import { useState } from 'react';
import { tr } from '@/i18n/tr';
import { fmt } from '@/i18n/dict';
import { Trash2 } from 'lucide-react';
import { ResourceListPage } from '@/components/resource/ResourceListPage';
import { ResourceFormPage } from '@/components/resource/ResourceFormPage';
import { FormDrawer } from '@/components/resource/FormDrawer';
import { useResourceBulkDelete } from '@/lib/queries/resource';
import { mainSectionsConfig } from '@/lib/resource/configs/main-sections';
import { heroBannersConfig } from '@/lib/resource/configs/hero-banners';
import type { BannerRow } from '@/lib/resource/configs/banners';

// 히어로 슬라이드 선택 삭제 바
function HeroBulkBar({ selected, clear }: { selected: BannerRow[]; clear: () => void }) {
  const bulk = useResourceBulkDelete('banners', 'hero_banners');
  async function onDelete() {
    if (!selected.length) return;
    if (!window.confirm(fmt(tr('선택한 {n}개 배너를 삭제하시겠어요? 되돌릴 수 없습니다.'), { n: selected.length })))
      return;
    await bulk.mutateAsync(selected.map((b) => b.id));
    clear();
  }
  return (
    <button className="btn btn-primary btn-sm" disabled={bulk.isPending || !selected.length} onClick={onDelete}>
      <Trash2 size={14} /> {bulk.isPending ? tr('삭제 중…') : `${tr('선택 삭제')} (${selected.length})`}
    </button>
  );
}

export default function MainSectionsPage() {
  const [editing, setEditing] = useState<Record<string, unknown> | null | undefined>(undefined);
  const [editingBanner, setEditingBanner] = useState<Record<string, unknown> | null | undefined>(undefined);
  const open = editing !== undefined;
  const bannerOpen = editingBanner !== undefined;

  return (
    <div className="space-y-10">
      {/* ── 메인 배너 (히어로 슬라이드) ── */}
      <section className="space-y-2">
        <ResourceListPage
          config={heroBannersConfig as never}
          onRowClick={(row) => setEditingBanner(row as unknown as Record<string, unknown>)}
          onCreate={() => setEditingBanner(null)}
          selectable
          renderBulkBar={({ selected, clear }: { selected: BannerRow[]; clear: () => void }) => (
            <HeroBulkBar selected={selected} clear={clear} />
          )}
        />
        <p className="text-xs text-grey-500">
          홈 상단에서 5초마다 자동으로 넘어가는 슬라이드입니다. 노출순서 순으로 <b>최대 5개</b>까지 보여집니다. (와이드 이미지 권장)
        </p>
      </section>

      {/* ── 메인 섹션 (히어로/슬라이더/추천/카테고리띠) ── */}
      <section>
        <ResourceListPage
          config={mainSectionsConfig as never}
          onRowClick={(row) => setEditing(row as Record<string, unknown>)}
          onCreate={() => setEditing(null)}
        />
      </section>

      <FormDrawer
        open={bannerOpen}
        title={editingBanner ? tr('메인 배너 수정') : tr('메인 배너 등록')}
        onClose={() => setEditingBanner(undefined)}
      >
        <ResourceFormPage
          config={heroBannersConfig as never}
          initial={editingBanner ?? null}
          onDone={() => setEditingBanner(undefined)}
        />
      </FormDrawer>

      <FormDrawer open={open} title={editing ? tr('섹션 수정') : tr('섹션 추가')} onClose={() => setEditing(undefined)}>
        <ResourceFormPage
          config={mainSectionsConfig as never}
          initial={editing ?? null}
          onDone={() => setEditing(undefined)}
        />
      </FormDrawer>
    </div>
  );
}
