// 행사패스관리 (오거나이저) — 내 티켓 상품만(seller_id 범위) + 단계형(마법사) 등록/수정.
// products 와 같은 테이블/전이를 공유하되 queryKey 'event-passes' 로 캐시 분리.
'use client';
import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { ResourceListPage } from '@/components/resource/ResourceListPage';
import { FormDrawer } from '@/components/resource/FormDrawer';
import {
  useStatusTransition,
  useResourceDelete,
  useResourceDuplicate,
} from '@/lib/queries/resource';
import { PARTNER_PRODUCT_TRANSITIONS, type ProductRow } from '@/lib/resource/configs/products';
import { eventPassesConfig, makeEventPassColumns } from '@/lib/resource/configs/event-passes';
import { EventPassWizard } from '@/components/event-pass/EventPassWizard';
import { usePartner } from '@/lib/partner/context';
import { useT } from '@/i18n/useT';
import { useGlobalLocale, ActiveLocaleProvider, useI18nText } from '@/lib/i18n/locale-context';
import { IconButton } from '@/components/ui/IconButton';
import { TRANSITION_ICON, FALLBACK_TRANSITION_ICON } from '@/components/ui/actionIcons';
import { Eye, Copy, Trash2, Loader2, FileSpreadsheet } from 'lucide-react';
import type { Locale } from '@123band/shared';

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

// 엑셀 마스터 파일 내려받기 — 목록은 20건씩 끊기지만 이 버튼은 내 행사패스 '전부'를 받는다.
// 서버(/api/event-passes/export)가 4개 시트(행사패스·티켓/가격·상세섹션·미디어)로 조립해 준다.
function ExcelExportButton() {
  const t = useT();
  const locale = useGlobalLocale().locale ?? 'en';
  const [busy, setBusy] = useState(false);

  async function download() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/event-passes/export?locale=${locale}`);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      // 파일명은 서버 Content-Disposition(filename*) 을 그대로 쓴다.
      const cd = res.headers.get('content-disposition') ?? '';
      const star = /filename\*=UTF-8''([^;]+)/i.exec(cd)?.[1];
      const plain = /filename="([^"]+)"/i.exec(cd)?.[1];
      const name = star ? decodeURIComponent(star) : (plain ?? 'event-passes.xlsx');

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.alert(t.excel.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      title={t.excel.title}
      disabled={busy}
      onClick={download}
    >
      {busy ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
      {busy ? t.excel.busy : t.excel.download}
    </button>
  );
}

const QKEY = 'event-passes';
// 고객 페이지(미리보기) 베이스 URL — 행사패스 상세는 /{locale}/products/{id}
const WEB_BASE = process.env.NEXT_PUBLIC_WEB_URL ?? 'https://123band-web.vercel.app';

function EventPassActions({ row }: { row: ProductRow }) {
  const t = useT();
  const i18nText = useI18nText();
  const transition = useStatusTransition('products', QKEY);
  const del = useResourceDelete('products', QKEY);
  const dup = useResourceDuplicate('products', QKEY);
  const allowed = PARTNER_PRODUCT_TRANSITIONS[row.status] ?? [];
  const busy = transition.isPending || del.isPending || dup.isPending;
  const name = i18nText(row.name_i18n) || row.code || t.rowActions.fallbackEventPass;

  return (
    <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
      {allowed.map((tr) => (
        <IconButton
          key={tr.to}
          icon={TRANSITION_ICON[tr.labelKey] ?? FALLBACK_TRANSITION_ICON}
          label={t.transitions[tr.labelKey]}
          disabled={busy}
          onClick={() => {
            transition.mutate({ id: row.id, status: tr.to });
            // 승인요청(→pending) 시 운영자에게 알림 메일 (실패 무시)
            if (tr.to === 'pending') {
              fetch('/api/notify/approval', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ productId: row.id, kind: 'eventPass' }),
              }).catch(() => {});
            }
          }}
        />
      ))}
      <IconButton
        icon={Copy}
        label={t.rowActions.duplicateEventPass}
        disabled={busy}
        onClick={() => dup.mutate(row.id)}
      />
      <IconButton
        icon={Trash2}
        label={t.common.delete}
        danger
        disabled={busy}
        onClick={() => {
          if (window.confirm(t.rowActions.confirmDeleteEventPass(name))) del.mutate(row.id);
        }}
      />
      <IconButton
        icon={Eye}
        label={t.rowActions.previewTitle}
        href={`${WEB_BASE}/en/products/${row.id}?preview=1`}
        target="_blank"
        rel="noopener noreferrer"
      />
    </div>
  );
}

export default function EventPassesPage() {
  const t = useT();
  const locale = useGlobalLocale().locale ?? 'en';
  const { userId } = usePartner();
  // undefined = 닫힘, null = 신규, object = 수정
  const [editing, setEditing] = useState<Record<string, unknown> | null | undefined>(undefined);
  // 마법사 입력 언어(전역 토글) — EN 으로 작성 후 KO 로 전환해 빈/채움을 바로 확인.
  const [inputLocale, setInputLocale] = useState<Locale>('en');

  const actionCol: ColumnDef<ProductRow, unknown> = {
    id: 'actions',
    header: t.columns.status,
    cell: (c) => <EventPassActions row={c.row.original} />,
  };

  const listConfig = useMemo(
    () => ({
      ...eventPassesConfig,
      title: t.nav.eventPasses,
      listColumns: [...makeEventPassColumns(t, locale), actionCol],
      filters: [{ ...eventPassesConfig.filters[0]!, label: t.list.codeSearch }],
    }),
    [t, locale], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const open = editing !== undefined;
  return (
    <>
      <ResourceListPage
        config={listConfig as never}
        scope={{ seller_id: userId }}
        onRowClick={(row) => setEditing(row as Record<string, unknown>)}
        onCreate={() => setEditing(null)}
        headerActions={<ExcelExportButton />}
      />
      <FormDrawer
        open={open}
        size="wide"
        title={editing ? t.drawer.eventPassEdit : t.drawer.eventPassCreate}
        onClose={() => setEditing(undefined)}
        headerRight={open ? <InputLangToggle locale={inputLocale} onChange={setInputLocale} /> : undefined}
      >
        {open && (
          <ActiveLocaleProvider value={{ locale: inputLocale, setLocale: setInputLocale }}>
            <EventPassWizard
              initial={editing ?? null}
              sellerId={userId}
              onDone={() => setEditing(undefined)}
              onCancel={() => setEditing(undefined)}
            />
          </ActiveLocaleProvider>
        )}
      </FormDrawer>
    </>
  );
}
