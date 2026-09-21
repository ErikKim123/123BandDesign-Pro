// Design Ref: 결승 성적 한 줄을 누르면 펼쳐지는 채점 상세 — 심사위원 × 채점 항목(0084).
//
// 전체 결과 표의 결승 줄은 '순위 · 총점 · 평균' 세 숫자로 끝난다. 그런데 사람들이 정작 궁금해하는
// 건 그 숫자가 아니라 '어디서 갈렸나'다 — 기본기에서 밀렸는지, 한 심사위원만 다르게 봤는지.
// J&J Dash 결승 채점 화면이 운영자에게 보여주는 그 표를 그대로 줄 밑에 접어 둔다.
//
// 왜 클라이언트인가: 펼침 상태는 각자 다르다. 다만 내용은 접혀 있어도 HTML 에 이미 들어 있다
// (렌더 후 CSS 로만 감춘다) — 눌러야 나타나는 값이 색인에서 빠지지 않게.
'use client';
import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { JnjScoreCriteria } from '@/lib/queries/jnj';

export interface BreakdownLabels {
  /** 상세 표 첫 열 머리 — '심사위원'. */
  judge: string;
  /** 줄 이름 — '심사위원 {n}'. 이름 대신 번호로만 부른다(누가 준 점수인지는 안 싣는다). */
  judgeN: string;
  /** 심사위원 한 명의 항목 합계 열. */
  total: string;
  /** 맨 아랫줄 — 열별 평균. */
  average: string;
  /** 펼침 버튼의 읽어주는 이름. */
  toggle: string;
  /** 표 아래 한 줄 설명. */
  note: string;
}

/** 6 · 8.5 처럼 — 정수는 정수로, 소수는 필요한 자리까지만. 빈 칸은 '—'. */
function fmtCell(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return String(Number(v.toFixed(2)));
}

/** 열 평균 — 안 매긴 칸(null)은 머릿수에서 뺀다. 전부 비었으면 null. */
function mean(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
  return nums.length === 0 ? null : nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** 심사위원 한 명이 그 참가자에게 준 항목 점수의 합. 한 칸도 안 매겼으면 null. */
function rowTotal(scores: (number | null)[]): number | null {
  const nums = scores.filter((v): v is number => v != null && Number.isFinite(v));
  return nums.length === 0 ? null : nums.reduce((a, b) => a + b, 0);
}

/**
 * 채점 상세 표.
 *
 * 맨 아랫줄은 '열별 평균'이다 — 그래서 오른쪽 끝 칸(심사위원 합계의 평균)이 위 표의 총점과
 * 같은 값이 된다. 두 표가 서로 다른 숫자를 말하지 않게 하려는 배치다.
 */
function BreakdownTable({
  criteria,
  itemLabels,
  labels,
}: {
  criteria: JnjScoreCriteria;
  itemLabels: string[];
  labels: BreakdownLabels;
}) {
  const cols = criteria.items.length;
  const totals = criteria.judges.map((j) => rowTotal(j.scores));
  const itemMeans = Array.from({ length: cols }, (_, i) =>
    mean(criteria.judges.map((j) => j.scores[i] ?? null)),
  );

  const th = 'px-2 py-1.5 label-caps !text-[10px] !tracking-[1px] text-grey-500';
  const td = 'px-2 py-1.5 tabular-nums';
  // 심사위원 열은 가로로 밀어도 자리를 지킨다 — 안 그러면 미는 순간 어느 심사위원 줄인지 알 수 없다.
  // sticky 칸은 배경이 없으면 뒤 숫자가 비쳐 보이므로 그 줄의 배경색을 칸에 직접 준다.
  const stick = 'sticky left-0 z-10 border-r border-beige/60';

  return (
    <div className="rounded-lg border border-beige bg-white">
      {/* 심사위원 열 명 × 채점 항목이면 모바일 폭에는 어차피 다 안 들어간다 — 카드 안에서만 민다.
          바깥 성적표가 table-fixed 라(JnjResults) 이 스크롤이 페이지 폭까지 밀어내지 않는다. */}
      {/* w-full 이 있어야 스크롤 박스의 폭이 '바깥 칸 폭'으로 확정된다. 없으면 폭이 auto(=내용 폭)로
          풀려서 안쪽 표(472px)만큼 늘어나 바깥 성적표 밖으로 삐져나갔다.
          표는 w-full 대신 w-max — 100% 로 묶으면 열이 찌그러지고, 자연 폭이어야 여기서 밀린다. */}
      <div className="w-full overflow-x-auto">
        <table className="w-max min-w-full text-xs md:text-sm">
          <thead>
            <tr className="border-b border-beige text-left">
              <th className={`${th} ${stick} min-w-24 bg-white`}>{labels.judge}</th>
              {itemLabels.map((label, i) => (
                <th key={i} className={`${th} text-right`}>
                  {label}
                </th>
              ))}
              <th className={`${th} text-right`}>{labels.total}</th>
            </tr>
          </thead>
          <tbody>
            {criteria.judges.map((judge, r) => (
              <tr key={r} className="border-b border-beige/50">
                {/* 이름이 있으면 이름으로 부른다. 이름 없이 가져온 옛 성적만 번호로 남는다. */}
                <td className={`${td} ${stick} whitespace-nowrap bg-white font-medium text-ink`}>
                  {judge.name?.trim() || labels.judgeN.replace('{n}', String(r + 1))}
                </td>
                {Array.from({ length: cols }, (_, i) => (
                  <td key={i} className={`${td} text-right text-grey-500`}>
                    {fmtCell(judge.scores[i])}
                  </td>
                ))}
                <td className={`${td} text-right font-display font-bold text-ink`}>
                  {fmtCell(totals[r])}
                </td>
              </tr>
            ))}
            <tr className="bg-cream-light">
              <td
                className={`${td} ${stick} label-caps !text-[10px] !tracking-[1px] bg-cream-light text-grey-500`}
              >
                {labels.average}
              </td>
              {itemMeans.map((v, i) => (
                <td key={i} className={`${td} text-right text-grey-500`}>
                  {v == null ? '—' : v.toFixed(2)}
                </td>
              ))}
              <td className={`${td} text-right font-display font-bold text-ink`}>
                {(() => {
                  const v = mean(totals);
                  return v == null ? '—' : v.toFixed(2);
                })()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {/* 설명 줄은 스크롤 영역 밖이다 — 안에 두면 표 폭만큼 늘어나 한 줄이 화면 밖까지 나간다. */}
      <p className="border-t border-beige/60 px-2 py-1.5 text-[11px] leading-snug text-grey-400">
        {labels.note}
      </p>
    </div>
  );
}

/**
 * 채점 상세가 딸린 결승 한 줄 — 줄 전체가 버튼이다.
 * @param children 원래의 <td> 들 · @param colSpan 상세가 깔고 앉을 열 수(펼침 화살표 열 포함)
 */
export function ExpandableScoreRow({
  criteria,
  itemLabels,
  labels,
  colSpan,
  children,
}: {
  criteria: JnjScoreCriteria;
  itemLabels: string[];
  labels: BreakdownLabels;
  colSpan: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <>
      <tr
        className="cursor-pointer border-b border-beige/60 transition-colors last:border-0 hover:bg-cream focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          // 줄 자체가 버튼이므로 Enter·Space 둘 다 받는다(스페이스의 스크롤은 막는다).
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
      >
        {children}
        <td className="w-7 px-1 text-right md:w-9 md:px-2">
          <ChevronDown
            size={16}
            aria-hidden
            className={`inline text-grey-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
          <span className="sr-only">{labels.toggle}</span>
        </td>
      </tr>
      {/* 접혀 있어도 HTML 에는 남는다 — 감추는 건 CSS 뿐이다. */}
      <tr id={panelId} className={`border-b border-beige/60 last:border-0 ${open ? '' : 'hidden'}`}>
        <td colSpan={colSpan} className="bg-cream/40 px-2 pb-3 pt-2 md:px-4">
          <BreakdownTable criteria={criteria} itemLabels={itemLabels} labels={labels} />
        </td>
      </tr>
    </>
  );
}
