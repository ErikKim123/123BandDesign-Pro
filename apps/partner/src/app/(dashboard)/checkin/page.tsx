// 오거나이저 입장확인 — 고객 주문 QR 스캔(또는 주문번호 입력) → 내가 판매한 티켓을 입장완료 처리.
// 처리는 SECURITY DEFINER RPC(checkin_order)가 판매자 검증 후 수행(마이그레이션 0019).
'use client';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { QrCode, CheckCircle2, XCircle, Camera } from 'lucide-react';
import { pickI18n, type I18n, type Locale } from '@123band/shared';
import { createClient } from '@/lib/supabase/client';
import { useGlobalLocale } from '@/lib/i18n/locale-context';
import { usePartner } from '@/lib/partner/context';
import { useT } from '@/i18n/useT';
import { QrScanner } from './QrScanner';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// QR/입력값 해석. 현행: `.../checkin?pass=<시크릿>`(패스 소각). 구형/폴백: `?order=<id>`·`/checkin/<id>`·원문.
type Scan = { mode: 'pass'; secret: string } | { mode: 'order'; token: string };
function extractScan(text: string): Scan {
  const t = text.trim();
  const pass = t.match(/[?&]pass=([^&#]+)/);
  if (pass && pass[1]) return { mode: 'pass', secret: decodeURIComponent(pass[1]) };
  // 원문이 곧 시크릿(uuid)인 경우도 패스로 간주 — 수동 입력 지원.
  const q = t.match(/[?&]order=([^&#]+)/);
  if (q && q[1]) return { mode: 'order', token: decodeURIComponent(q[1]) };
  const p = t.match(/\/checkin\/([^/?#]+)/);
  if (p && p[1]) return { mode: 'order', token: decodeURIComponent(p[1]) };
  if (UUID_RE.test(t)) return { mode: 'pass', secret: t };
  return { mode: 'order', token: t };
}

type Item = { id: string; qty: number; checked_in_count: number; products: { name_i18n: I18n } | null };
type Result =
  | {
      kind: 'success' | 'already';
      orderNo: string;
      status: string;
      newly: number;
      remaining: number;
      items: Item[];
      /** 패스 소각 모드 — 상품명/소유자 표시(주문 카운터 대신) */
      mode?: 'pass' | 'order';
      productName?: I18n;
      ownerName?: string;
    }
  | { kind: 'forbidden' | 'notfound' | 'error' };

export default function CheckinPage() {
  // useSearchParams 는 Suspense 경계 안에서만 안전(정적 최적화 회피).
  return (
    <Suspense fallback={null}>
      <CheckinInner />
    </Suspense>
  );
}

function CheckinInner() {
  const t = useT();
  const locale = useGlobalLocale().locale ?? 'ko';
  const { userId } = usePartner();
  const searchParams = useSearchParams();
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [camError, setCamError] = useState<string | null>(null);

  const process = useCallback(
    async (raw: string) => {
      if (busy) return;
      setBusy(true);
      setResult(null);
      try {
        const supabase = createClient();
        const scan = extractScan(raw);

        // ── 패스 소각(현행) — 시크릿으로 원자적 체크인. 회전된 시크릿/위조는 notfound.
        if (scan.mode === 'pass') {
          const { data, error } = await supabase.rpc('checkin_pass', { p_secret: scan.secret });
          if (error) {
            const msg = error.message || '';
            if (msg.includes('forbidden')) setResult({ kind: 'forbidden' });
            else if (msg.includes('pass_not_found')) setResult({ kind: 'notfound' });
            else setResult({ kind: 'error' });
            return;
          }
          const row = Array.isArray(data) ? data[0] : data;
          if (!row) {
            setResult({ kind: 'error' });
            return;
          }
          setResult({
            kind: row.already ? 'already' : 'success',
            mode: 'pass',
            orderNo: row.order_no as string,
            status: (row.pass_status as string) ?? 'used',
            newly: row.already ? 0 : 1,
            remaining: 0,
            items: [],
            productName: (row.product_name as I18n) ?? undefined,
            ownerName: (row.owner_name as string) ?? undefined,
          });
          return;
        }

        // ── 주문 단위(구형/실물 폴백) — 주문번호/uuid → checkin_order.
        const token = scan.token;
        let orderId = token;
        if (!UUID_RE.test(token)) {
          const { data } = await supabase.from('orders').select('id').eq('order_no', token).maybeSingle();
          if (!data?.id) {
            setResult({ kind: 'notfound' });
            return;
          }
          orderId = data.id as string;
        }

        const { data, error } = await supabase.rpc('checkin_order', { p_order_id: orderId });
        if (error) {
          const msg = error.message || '';
          if (msg.includes('forbidden')) setResult({ kind: 'forbidden' });
          else if (msg.includes('order_not_found')) setResult({ kind: 'notfound' });
          else setResult({ kind: 'error' });
          return;
        }
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) {
          setResult({ kind: 'error' });
          return;
        }

        // 처리 후 내 티켓 목록(입장 카운트 포함) 조회해 표시
        const { data: items } = await supabase
          .from('order_items')
          .select('id, qty, checked_in_count, products(name_i18n)')
          .eq('order_id', orderId)
          .eq('seller_id', userId);

        setResult({
          kind: row.already ? 'already' : 'success',
          orderNo: row.order_no as string,
          status: row.order_status as string,
          newly: (row.newly_checked as number) ?? 0,
          remaining: (row.remaining as number) ?? 0,
          items: (items ?? []) as unknown as Item[],
        });
      } catch {
        setResult({ kind: 'error' });
      } finally {
        setBusy(false);
      }
    },
    [busy, userId],
  );

  const onDecode = useCallback(
    (text: string) => {
      setScanning(false);
      void process(text);
    },
    [process],
  );

  // 폰 기본 카메라로 QR 을 찍어 파트너 포털 /checkin?pass=<secret>(현행) 또는 ?order=<id>(구형)로
  // 들어온 경우 자동 처리(1회). 쿼리 형태로 넘겨 extractScan 이 모드를 판별하게 한다.
  const autoRan = useRef(false);
  useEffect(() => {
    const passParam = searchParams.get('pass');
    const orderParam = searchParams.get('order');
    if (!autoRan.current && (passParam || orderParam)) {
      autoRan.current = true;
      void process(passParam ? `?pass=${passParam}` : `?order=${orderParam}`);
    }
    // process 는 최초 마운트 시점 것으로 충분(1회 실행). 의존성 최소화.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const statusLabel = (s: string) => (t.status as Record<string, string>)[s] ?? s;

  return (
    <div className="mx-auto max-w-xl p-4 sm:p-6">
      <div className="mb-1 flex items-center gap-2">
        <QrCode size={22} />
        <h1 className="font-display text-2xl">{t.checkin.title}</h1>
      </div>
      <p className="mb-6 text-sm text-grey-500">{t.checkin.subtitle}</p>

      {/* 스캐너 */}
      <div className="mb-4">
        {scanning ? (
          <div className="flex flex-col items-center gap-3">
            <QrScanner
              onDecode={onDecode}
              onError={(m) => {
                setCamError(m);
                setScanning(false);
              }}
            />
            <p className="text-xs text-grey-500">{t.checkin.scanning}</p>
            <button
              type="button"
              onClick={() => setScanning(false)}
              className="btn btn-secondary btn-sm"
            >
              {t.checkin.stopScan}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setCamError(null);
              setScanning(true);
            }}
            className="btn btn-primary flex w-full items-center justify-center gap-2"
          >
            <Camera size={18} /> {t.checkin.startScan}
          </button>
        )}
        {camError && <p className="mt-2 text-sm text-danger">{t.checkin.cameraError}</p>}
      </div>

      {/* 수동 입력 */}
      <div className="mb-6">
        <label className="label-caps text-grey-500">{t.checkin.manualLabel}</label>
        <div className="mt-1.5 flex gap-2">
          <input
            className="input flex-1"
            placeholder={t.checkin.manualPh}
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && manual.trim()) void process(manual.trim());
            }}
          />
          <button
            type="button"
            disabled={busy || !manual.trim()}
            onClick={() => void process(manual.trim())}
            className="btn btn-primary whitespace-nowrap"
          >
            {busy ? t.checkin.processing : t.checkin.lookupBtn}
          </button>
        </div>
      </div>

      {/* 결과 */}
      {!result ? (
        <p className="rounded-lg border border-dashed border-grey-200 py-10 text-center text-sm text-grey-400">
          {t.checkin.empty}
        </p>
      ) : (
        <ResultCard result={result} t={t} locale={locale} statusLabel={statusLabel} />
      )}
    </div>
  );
}

function ResultCard({
  result,
  t,
  locale,
  statusLabel,
}: {
  result: Result;
  t: ReturnType<typeof useT>;
  locale: Locale;
  statusLabel: (s: string) => string;
}) {
  if (result.kind !== 'success' && result.kind !== 'already') {
    const msg =
      result.kind === 'forbidden'
        ? t.checkin.msgForbidden
        : result.kind === 'notfound'
          ? t.checkin.msgNotFound
          : t.checkin.msgError;
    return (
      <div className="flex items-center gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-danger">
        <XCircle size={22} className="shrink-0" />
        <span className="text-sm font-medium">{msg}</span>
      </div>
    );
  }

  const ok = result.kind === 'success';
  return (
    <div
      className={`rounded-lg border p-4 ${ok ? 'border-success/30 bg-success/5' : 'border-grey-300 bg-grey-50'}`}
    >
      <div className={`mb-3 flex items-center gap-2 ${ok ? 'text-success' : 'text-grey-600'}`}>
        <CheckCircle2 size={22} className="shrink-0" />
        <span className="text-sm font-semibold">
          {ok ? t.checkin.msgSuccess(result.newly) : t.checkin.msgAlready}
        </span>
      </div>

      {result.mode === 'pass' ? (
        // 패스 소각 모드 — 주문 카운터 대신 상품명/소유자를 보여준다.
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-grey-500">{t.checkin.orderNo}</dt>
            <dd className="font-mono">{result.orderNo}</dd>
          </div>
          {result.productName && (
            <div className="flex justify-between gap-4">
              <dt className="text-grey-500">{t.checkin.items}</dt>
              <dd className="min-w-0 truncate text-right font-medium text-grey-800">
                {pickI18n(result.productName, locale) || '—'}
              </dd>
            </div>
          )}
          {result.ownerName && (
            <div className="flex justify-between gap-4">
              <dt className="text-grey-500">{t.checkin.orderStatus}</dt>
              <dd className="truncate text-right">{result.ownerName}</dd>
            </div>
          )}
        </dl>
      ) : (
        <>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-grey-500">{t.checkin.orderNo}</dt>
              <dd className="font-mono">{result.orderNo}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-grey-500">{t.checkin.orderStatus}</dt>
              <dd>{statusLabel(result.status)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-grey-500">{t.checkin.remaining}</dt>
              <dd className={`font-semibold ${result.remaining > 0 ? 'text-primary' : 'text-grey-500'}`}>
                {result.remaining}
              </dd>
            </div>
          </dl>

          <p className="mt-3 label-caps text-grey-500">{t.checkin.items}</p>
          <ul className="mt-1 divide-y divide-grey-100 border-t border-grey-100">
            {result.items.map((it) => {
              const used = it.checked_in_count ?? 0;
              const full = used >= it.qty;
              return (
                <li key={it.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate text-grey-700">
                    {pickI18n(it.products?.name_i18n, locale) || '—'} · {t.checkin.admitted} {used}/{it.qty}
                  </span>
                  <span
                    className={`shrink-0 rounded-pill px-2.5 py-0.5 text-xs font-medium ${
                      full
                        ? 'bg-success/10 text-success'
                        : used > 0
                          ? 'bg-primary/10 text-primary'
                          : 'bg-grey-100 text-grey-500'
                    }`}
                  >
                    {full ? t.checkin.checkedIn : `${t.checkin.remaining} ${it.qty - used}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
