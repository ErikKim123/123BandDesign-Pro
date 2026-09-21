// Design Ref: 업적관리 — 달성 조건 편집기. achievements.conditions(jsonb 배열)을 폼으로 다룬다.
// 저장 형태: [{"type":"newsletter_subscribed"},{"type":"ticket_purchase","count":1}]
// 배열 안의 조건을 '모두' 만족해야 달성(AND) — DB 의 evaluate_achievements_for 와 같은 규칙.
'use client';
import { trIn } from '@/i18n/tr';
import { useLocale } from '@/lib/locale/LocaleContext';

export interface Condition {
  type: string;
  count?: number;
}

// 라벨은 한국어 원문으로 두고 렌더 시점에 번역한다.
// (모듈 상수에서 번역하면 import 시점 로케일로 고정되어 EN 전환이 반영되지 않는다)
/** 켜기/끄기만 있는 조건 */
const FLAGS: { type: string; label: string; hint?: string }[] = [
  {
    type: 'newsletter_subscribed',
    label: '뉴스레터 구독',
    hint: '회원 이메일과 같은 주소로 뉴스레터를 구독했는지 확인합니다.',
  },
  {
    type: 'profile_complete',
    label: '프로필 완성',
    hint: '이름·연락처·국가와 프로필 사진(또는 캐릭터)이 모두 있어야 합니다.',
  },
  {
    type: 'manual',
    label: '운영진 수동 지급',
    hint: '자동으로는 절대 지급되지 않습니다. 업적관리 > 수동 지급에서 회원에게 직접 줍니다(현장 스캔·SNS 태그·제보 등).',
  },
];

/** 횟수/수량 기준 조건 */
const COUNTS: { type: string; label: string; unit: string; hint?: string }[] = [
  {
    type: 'ticket_purchase',
    label: '패스(행사티켓) 구매',
    unit: '개 이상',
    hint: '결제완료된 주문의 패스 수량 합계입니다. 입금확인 대기 중인 주문은 세지 않습니다.',
  },
  { type: 'order_count', label: '결제완료 주문', unit: '건 이상' },
  { type: 'review_count', label: '상품후기 작성', unit: '개 이상' },
  { type: 'qna_count', label: '상품문의(댓글) 작성', unit: '개 이상' },
  { type: 'point_total', label: '보유 포인트', unit: 'P 이상' },
  {
    type: 'audience_judge_count',
    label: '관객 심사위원 참가',
    unit: '개 대회 이상',
    hint: 'J&J 관객 심사위원으로 접수한 대회 수입니다. 회원 이메일과 같은 주소로 접수했는지로 맞춥니다. 한 대회에서 여러 부문에 접수해도 1회로 셉니다.',
  },
  {
    type: 'ticket_order_count',
    label: '패스 주문',
    unit: '건 이상',
    hint: '패스가 든 결제완료 주문 건수입니다. 한 주문에서 여러 장을 사도 1건입니다.',
  },
  {
    type: 'ticket_country_count',
    label: '방문 국가',
    unit: '개국 이상',
    hint: '결제완료한 패스의 행사 국가(행사 기본정보의 국가) 종류 수입니다.',
  },
  {
    type: 'early_bird_purchase',
    label: '얼리버드 구매',
    unit: '건 이상',
    hint: '행사 시작 90일 이상 전에 결제한 패스 주문 수입니다(행사 시작 시각은 한국 시간 기준).',
  },
  {
    type: 'referral_signup_count',
    label: '추천 가입(프로필 완성)',
    unit: '명 이상',
    hint: '내 추천 코드로 가입해 프로필까지 완성한 회원 수입니다.',
  },
  {
    type: 'referral_purchase_count',
    label: '추천 구매',
    unit: '명 이상',
    hint: '내 추천으로 가입해 패스를 결제한 회원 수입니다.',
  },
  {
    type: 'ticket_checkin_count',
    label: '입장 체크인',
    unit: '회 이상',
    hint: '행사장에서 입장 확인(QR 스캔)된 내 패스 수입니다.',
  },
  {
    type: 'station_scan',
    label: '현장 QR 스캔',
    unit: '곳 이상',
    hint: "이 업적에 연결된 현장 QR 중 서로 다른 곳을 몇 곳 찍어야 하는지입니다. QR 은 업적관리 > 현장 QR 탭에서 만듭니다.",
  },
  {
    type: 'feedback_submitted',
    label: '피드백 설문 제출',
    unit: '회 이상',
    hint: '로그인한 상태로 낸 행사 피드백 설문 수입니다. 비로그인 응답은 누구 것인지 몰라 세지 못합니다.',
  },
];

function parse(value: unknown): Condition[] {
  if (Array.isArray(value)) return value as Condition[];
  if (typeof value === 'string') {
    try {
      const v = JSON.parse(value);
      return Array.isArray(v) ? (v as Condition[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function AchievementConditions({
  value,
  set,
}: {
  value: unknown;
  set: (v: unknown) => void;
}) {
  const { locale } = useLocale();
  const t = (v: string | undefined) => trIn(v, locale);
  const conds = parse(value);
  const find = (type: string) => conds.find((c) => c.type === type);

  function toggleFlag(type: string, on: boolean) {
    set(on ? [...conds.filter((c) => c.type !== type), { type }] : conds.filter((c) => c.type !== type));
  }

  function toggleCount(type: string, on: boolean) {
    set(
      on
        ? [...conds.filter((c) => c.type !== type), { type, count: 1 }]
        : conds.filter((c) => c.type !== type),
    );
  }

  function setCount(type: string, n: number) {
    set(conds.map((c) => (c.type === type ? { ...c, count: Math.max(1, n || 1) } : c)));
  }

  return (
    <div className="space-y-3">
      <label className="label-caps">{t('달성 조건 (아래 조건을 모두 만족하면 획득)')}</label>

      <div className="space-y-2 rounded-lg border border-grey-200 p-4">
        {FLAGS.map((f) => {
          const on = !!find(f.type);
          return (
            <div key={f.type}>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={on} onChange={(e) => toggleFlag(f.type, e.target.checked)} />
                {t(f.label)}
              </label>
              {f.hint && <p className="ml-6 text-xs text-grey-500">{t(f.hint)}</p>}
            </div>
          );
        })}

        {COUNTS.map((c) => {
          const cur = find(c.type);
          const on = !!cur;
          return (
            <div key={c.type}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={on} onChange={(e) => toggleCount(c.type, e.target.checked)} />
                  {t(c.label)}
                </label>
                {on && (
                  <>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      className="input w-24 py-1"
                      value={cur?.count ?? 1}
                      onChange={(e) => setCount(c.type, Number(e.target.value))}
                    />
                    <span className="text-grey-600">{t(c.unit)}</span>
                  </>
                )}
              </div>
              {on && c.hint && <p className="ml-6 text-xs text-grey-500">{t(c.hint)}</p>}
            </div>
          );
        })}
      </div>

      {conds.length === 0 && (
        <p className="text-xs text-danger">
          {t('조건이 하나도 없으면 아무도 달성할 수 없습니다. 최소 하나를 선택해 주세요.')}
        </p>
      )}
    </div>
  );
}
