// Design Ref: 알림관리 — 회원에게 보내는 메시지(작성/발송 + 보낸 알림 이력).
//
// 회원 화면에서는 사이트를 열어둔 사람에게 메시지 카드가 즉시 뜨고 소리가 난다(Realtime).
// 닫아둔 사람은 웹푸시로 받고, 어느 쪽이든 마이페이지 '알림'에 쌓인다.
//
// 받는 사람은 두 갈래다: '일반회원 전체'(공지) 또는 검색해서 담은 사람들.
// 회원을 훑어보며 고르는 편이 빠를 때는 일반회원 목록에서 체크해 보내는 길도 그대로 있다.
'use client';
import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { tr } from '@/i18n/tr';
import { createClient } from '@/lib/supabase/client';
import { NoticeComposer } from '@/components/notice/NoticeComposer';

interface NoticeRow {
  batch_id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

interface Batch {
  batchId: string;
  title: string;
  body: string;
  sentAt: string;
  recipients: number;
  read: number;
}

/** 발송 묶음으로 접는다 — 회원 수만큼 있는 행을 한 건으로 읽는다. */
function foldBatches(rows: NoticeRow[]): Batch[] {
  const map = new Map<string, Batch>();
  for (const r of rows) {
    const b = map.get(r.batch_id);
    if (b) {
      b.recipients += 1;
      if (r.read_at) b.read += 1;
      // 같은 묶음은 같은 시각이지만, 안전하게 가장 이른 시각을 발송 시각으로 둔다.
      if (r.created_at < b.sentAt) b.sentAt = r.created_at;
    } else {
      map.set(r.batch_id, {
        batchId: r.batch_id,
        title: r.title,
        body: r.body,
        sentAt: r.created_at,
        recipients: 1,
        read: r.read_at ? 1 : 0,
      });
    }
  }
  return [...map.values()].sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
}

function fmtDateTime(raw: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function NoticesPage() {
  const qc = useQueryClient();

  // 최근 행 2000개까지만 본다 — 이력 화면이라 오래된 발송까지 다 셀 이유가 없다.
  const { data, isLoading } = useQuery({
    queryKey: ['member-notices'],
    queryFn: async () => {
      const { data } = await createClient()
        .from('member_notices')
        .select('batch_id, title, body, read_at, created_at')
        .order('created_at', { ascending: false })
        .limit(2000);
      return (data ?? []) as NoticeRow[];
    },
  });

  const batches = useMemo(() => foldBatches(data ?? []), [data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl uppercase tracking-tight">{tr('알림관리')}</h1>
        <p className="mt-2 text-sm text-grey-600">
          {tr('회원에게 메시지를 보냅니다. 사이트를 열어둔 회원에게는 즉시 알림 카드가 뜨고 소리가 나며, 마이페이지 알림함에 남습니다. 일부에게만 보내려면 받는 사람에서 직접 고르기로 검색해 담으세요.')}
        </p>
      </div>

      <section className="rounded-lg border border-grey-200 p-5">
        <h2 className="mb-4 text-lg">{tr('새 알림')}</h2>
        <NoticeComposer
          pickable
          target={{ userIds: null, label: tr('일반회원 전체') }}
          onSent={() => qc.invalidateQueries({ queryKey: ['member-notices'] })}
        />
      </section>

      <section className="rounded-lg border border-grey-200">
        <h2 className="border-b border-grey-200 px-5 py-4 text-lg">{tr('보낸 알림')}</h2>
        {isLoading ? (
          <p className="px-5 py-10 text-center text-sm text-grey-500">{tr('불러오는 중…')}</p>
        ) : batches.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-grey-500">{tr('아직 보낸 알림이 없습니다.')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-grey-200 bg-grey-50">
                  <th className="px-4 py-3 text-left label-caps">{tr('보낸 시각')}</th>
                  <th className="px-4 py-3 text-left label-caps">{tr('제목')}</th>
                  <th className="px-4 py-3 text-left label-caps">{tr('받은 사람')}</th>
                  <th className="px-4 py-3 text-left label-caps">{tr('읽음')}</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.batchId} className="border-b border-grey-100">
                    <td className="whitespace-nowrap px-4 py-3 text-grey-600">
                      {fmtDateTime(b.sentAt)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{b.title}</p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-grey-500">{b.body}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                      {b.recipients.toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-grey-600">
                      {b.read.toLocaleString()} / {b.recipients.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
