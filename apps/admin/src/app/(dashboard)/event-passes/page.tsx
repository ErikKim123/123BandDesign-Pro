// 행사패스관리 — 목록 + 단계형(마법사) 등록/수정 + 승인 전이.
// 오거나이저(파트너)와 동일한 EventPassWizard 사용. products 테이블/전이를 공유하되 queryKey 'event-passes' 로 캐시 분리.
'use client';
import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { ResourceListPage } from '@/components/resource/ResourceListPage';
import { FormDrawer } from '@/components/resource/FormDrawer';
import {
  useStatusTransition,
  useResourceDelete,
  useResourceDuplicate,
} from '@/lib/queries/resource';
import { PRODUCT_TRANSITIONS, type ProductRow } from '@/lib/resource/configs/products';
import { buildEventPassesConfig } from '@/lib/resource/configs/event-passes';
import { EventPassWizard } from '@/components/event-pass/EventPassWizard';
import { useT, useLocale } from '@/lib/locale/LocaleContext';
import { ActiveLocaleProvider } from '@/lib/locale/active-locale';
import { fmt } from '@/i18n/dict';
import { IconButton } from '@/components/ui/IconButton';
import { TRANSITION_ICON } from '@/components/ui/actionIcons';
import { Eye, Copy, Trash2, CheckCircle2 } from 'lucide-react';
import type { Locale } from '@123band/shared';
import { trI18nIn } from '@/i18n/tr';

// 입력 언어 토글 — 마법사 모든 i18n 필드가 이 언어로 표시/입력된다(헤더에 배치).
function InputLangToggle({ locale, onChange }: { locale: Locale; onChange: (l: Locale) => void }) {
  return (
    <div className="inline-flex items-center rounded-pill border border-grey-200 p-0.5">
      {(['en', 'ko'] as Locale[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          className={`rounded-pill px-2.5 py-1 text-xs font-medium uppercase transition-colors ${
            l === locale ? 'bg-black text-white' : 'text-grey-500 hover:text-black'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

const QKEY = 'event-passes';
// 고객 웹 베이스 URL — 미리보기 링크용
const WEB_BASE = process.env.NEXT_PUBLIC_WEB_URL ?? 'https://123band-web.vercel.app';

function EventPassActions({ row }: { row: ProductRow }) {
  const t = useT();
  const { locale } = useLocale();
  const transition = useStatusTransition('products', QKEY);
  const del = useResourceDelete('products', QKEY);
  const dup = useResourceDuplicate('products', QKEY);
  const allowed = PRODUCT_TRANSITIONS[row.status] ?? [];
  const busy = transition.isPending || del.isPending || dup.isPending;
  const name =
    trI18nIn(row.name_i18n, locale) || row.code || t.eventPasses.fallbackName;

  return (
    <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
      <IconButton
        icon={Eye}
        label={t.common.previewTitle}
        href={`${WEB_BASE}/${locale}/products/${row.id}?preview=1`}
        target="_blank"
        rel="noopener noreferrer"
      />
      {allowed.map((tr) => (
        <IconButton
          key={tr.to}
          icon={TRANSITION_ICON[tr.labelKey] ?? CheckCircle2}
          label={t.transitions[tr.labelKey] ?? tr.label}
          disabled={busy}
          onClick={() => transition.mutate({ id: row.id, status: tr.to })}
        />
      ))}
      <IconButton
        icon={Copy}
        label={t.eventPasses.duplicateTitle}
        disabled={busy}
        onClick={() => dup.mutate(row.id)}
      />
      <IconButton
        icon={Trash2}
        label={t.common.delete}
        danger
        disabled={busy}
        onClick={() => {
          if (window.confirm(fmt(t.eventPasses.deleteConfirm, { name }))) del.mutate(row.id);
        }}
      />
    </div>
  );
}

export default function EventPassesPage() {
  const t = useT();
  const { locale } = useLocale();
  const [editing, setEditing] = useState<Record<string, unknown> | null | undefined>(undefined);
  // 마법사 입력 언어(전역 토글) — EN 으로 작성 후 KO 로 전환해 빈/채움을 바로 확인.
  const [inputLocale, setInputLocale] = useState<Locale>('en');

  const eventPassesConfig = buildEventPassesConfig(t, locale);
  const actionCol: ColumnDef<ProductRow, unknown> = {
    id: 'actions',
    header: t.eventPasses.col.actions,
    cell: (c) => <EventPassActions row={c.row.original} />,
  };
  const config = { ...eventPassesConfig, listColumns: [...eventPassesConfig.listColumns, actionCol] };

  const open = editing !== undefined;
  return (
    <>
      <ResourceListPage
        config={config as never}
        onRowClick={(row) => setEditing(row as Record<string, unknown>)}
        onCreate={() => setEditing(null)}
      />
      <FormDrawer
        open={open}
        size="wide"
        title={editing ? t.eventPasses.drawerEdit : t.eventPasses.drawerCreate}
        onClose={() => setEditing(undefined)}
        headerRight={open ? <InputLangToggle locale={inputLocale} onChange={setInputLocale} /> : undefined}
      >
        {open && (
          <ActiveLocaleProvider value={{ locale: inputLocale, setLocale: setInputLocale }}>
            <EventPassWizard
              initial={editing ?? null}
              config={eventPassesConfig}
              onDone={() => setEditing(undefined)}
              onCancel={() => setEditing(undefined)}
            />
          </ActiveLocaleProvider>
        )}
      </FormDrawer>
    </>
  );
}
