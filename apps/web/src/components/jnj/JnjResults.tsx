// Design Ref: J&J 전체 결과 — 예선·본선·결승 전 라운드 성적표(어드민 'J&J 점수관리' 가 채운다).
// 시상대가 '누가 이겼나'라면 이 섹션은 '어떻게 갈렸나'.
//   · 예선/본선 : 심사위원 O표 수 + 통과 여부 (J&J Dash 의 통과자 화면과 같은 값)
//   · 결승      : 순위 + 최종(가중) 총점 + 평균 (+ 줄을 누르면 심사위원 × 채점 항목 상세, 0084)
// 라운드마다 열이 달라 표를 라운드별로 따로 그린다. 리더·팔로워는 PC 에서 좌우로 나란히 놓아
// 예선처럼 줄이 긴 라운드에서도 한 화면에 들어오게 한다. 전부 서버 렌더 = 본문이 그대로 색인된다.
import type { Locale } from '@123band/shared';
import type { Dictionary } from '@/i18n/dictionaries';
import type { JnjRound, JnjScore, JnjScoreCriteria, RoundGroup } from '@/lib/queries/jnj';
import Image from 'next/image';
import { CountryFlag } from './flag';
import { fmtScore } from './score';
import { ExpandableScoreRow, type BreakdownLabels } from './ScoreBreakdown';
import { storageImageProps } from '@/lib/image';

/** 1·2·3위만 색으로 구분한다 — 그 아래는 본문과 같은 톤. */
function rankClass(rank: number): string {
  if (rank === 1) return 'bg-[#ffd900] text-ink';
  if (rank === 2) return 'bg-grey-200 text-ink';
  if (rank === 3) return 'bg-primary text-white';
  return 'border border-beige bg-white text-grey-500';
}

function roundLabel(round: JnjRound, dict: Dictionary): string {
  return dict.jnj.rounds[round];
}

function roleLabel(role: 'leader' | 'follower', dict: Dictionary): string {
  return role === 'leader' ? dict.jnj.leaders : dict.jnj.followers;
}

/**
 * 한 라운드를 표 몇 개로 나눌지 — 리더·팔로워는 Jack & Jill 에서만 뜻이 있는 구분이다.
 * BATTLE·SHOW(div)는 한 사람(또는 한 팀)이 그대로 겨루므로 표 하나로 합치고 '참여자' 로 부른다.
 * 합칠 때 순서는 결승이면 순위, 예선·본선이면 O표가 많은 쪽이 위다.
 */
function tablesFor(
  group: RoundGroup,
  kind: string,
  dict: Dictionary,
): { key: string; label: string; rows: JnjScore[] }[] {
  if (kind === 'jnj') {
    return group.roles.map((r) => ({ key: r.role, label: roleLabel(r.role, dict), rows: r.rows }));
  }
  const rows = group.roles.flatMap((r) => r.rows);
  if (rows.length === 0) return [];
  const merged = [...rows].sort((a, b) =>
    group.round === 'final'
      ? (a.rank ?? 999) - (b.rank ?? 999)
      : (b.votes ?? -1) - (a.votes ?? -1),
  );
  return [{ key: 'all', label: dict.jnj.participants, rows: merged }];
}

/** 참가자 사진 — 없으면 이름 첫 글자. 표에 얼굴이 있어야 번호·이름만 훑는 것보다 훨씬 빨리 찾는다. */
function Avatar({ src, name }: { src: string | null | undefined; name: string }) {
  const box =
    'h-7 w-7 shrink-0 overflow-hidden rounded-full bg-beige/60 ring-1 ring-beige md:h-8 md:w-8';
  if (!src) {
    return (
      <span className={`${box} flex items-center justify-center`}>
        <span className="font-display text-xs font-bold text-grey-500">
          {name.trim().charAt(0).toUpperCase() || '?'}
        </span>
      </span>
    );
  }
  return (
    <span className={`relative ${box} block`}>
      <Image
        {...storageImageProps(src, 96)}
        alt={name}
        fill
        sizes="(max-width: 768px) 28px, 32px"
        className="object-cover"
      />
    </span>
  );
}

/**
 * 참가자 한 칸 — 사진 + 국기 + 이름.
 *
 * 이름은 자르지 않는다. 좁은 화면에서 'Na…' 로 끊기면 그 줄이 누구 성적인지 알 수 없어
 * 표 자체가 쓸모없어진다 — 줄이 늘어나는 편이 낫다.
 * 모바일에서는 참가번호 열을 접고(ScoreTable) 번호를 이름 위에 얹는다 — 열 하나를 통째로
 * 이름에 넘겨야 사람 이름이 한두 줄에 들어온다.
 */
function NameCell({ row, locale }: { row: JnjScore; locale: Locale }) {
  const no = (row.entry_no ?? '').trim();
  return (
    <span className="flex items-center gap-2 md:gap-2.5">
      <Avatar src={row.photo_url} name={row.name} />
      <CountryFlag cc={row.country} locale={locale} />
      <span className="min-w-0 flex-1">
        {no && (
          <span className="block text-[11px] leading-none tabular-nums text-grey-400 md:hidden">
            {no}
          </span>
        )}
        <span className="block font-medium leading-snug text-ink [overflow-wrap:anywhere]">
          {row.name || '—'}
        </span>
      </span>
    </span>
  );
}

/** 채점 상세가 실제로 들어 있는 줄인가 — 0084 미적용 환경이면 아예 오지 않는다(undefined). */
function scoreCriteria(row: JnjScore): JnjScoreCriteria | null {
  const c = row.criteria;
  if (!c || !Array.isArray(c.items) || c.items.length === 0) return null;
  return Array.isArray(c.judges) && c.judges.length > 0 ? c : null;
}

/**
 * 채점 항목 코드 → 화면 이름. 사전에 없는 코드(대회가 새 항목을 쓰면)는 밑줄만 떼고 그대로 쓴다 —
 * 이름을 못 찾았다고 열이 사라지면 점수가 어느 항목인지 알 수 없어진다.
 */
function criteriaLabel(code: string, dict: Dictionary): string {
  const known = (dict.jnj.criteria as Record<string, string | undefined>)[code];
  if (known) return known;
  const words = code.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** 한 라운드 × 한 역할의 표. 라운드에 따라 열이 달라진다. */
function ScoreTable({
  round,
  label,
  rows,
  locale,
  dict,
}: {
  round: JnjRound;
  /** 표 위에 붙는 머리말 — '리더'·'팔로워' 또는 '참여자'. */
  label: string;
  rows: JnjScore[];
  locale: Locale;
  dict: Dictionary;
}) {
  const isFinal = round === 'final';
  // 비어 있는 열은 아예 안 그린다 — '—' 만 늘어선 칸을 만들지 않는다.
  const showNo = rows.some((r) => (r.entry_no ?? '').trim() !== '');
  const showVotes = !isFinal && rows.some((r) => r.votes != null);
  const showPassed = !isFinal && rows.some((r) => r.passed != null);
  const showTotal = isFinal && rows.some((r) => fmtScore(r.total_score) !== null);
  const showAvg = isFinal && rows.some((r) => fmtScore(r.avg_score) !== null);
  const showRank = isFinal && rows.some((r) => r.rank != null);
  // 채점 상세(0084)가 한 줄이라도 있으면 펼침 화살표 열을 연다. 없는 표는 예전 그대로다.
  const showBreakdown = isFinal && rows.some((r) => scoreCriteria(r) !== null);
  const colSpan =
    (showRank ? 1 : 0) +
    (showNo ? 1 : 0) +
    1 + // 참가자
    (showVotes ? 1 : 0) +
    (showPassed ? 1 : 0) +
    (showTotal ? 1 : 0) +
    (showAvg ? 1 : 0) +
    (showBreakdown ? 1 : 0);
  // 표 아래 설명 줄은 '이름으로 부르는지'에 따라 달라야 한다 — 이름이 뜨는데 '익명으로
  // 표시한다'고 적혀 있으면 표와 설명이 서로 다른 말을 한다. 이름을 싣기 전에 가져온 옛
  // 성적은 여전히 번호뿐이라, 실제 데이터를 보고 고른다.
  const namedJudges = rows.some((r) =>
    scoreCriteria(r)?.judges.some((j) => j.name?.trim()),
  );
  const breakdownLabels: BreakdownLabels = {
    judge: dict.jnj.judge,
    judgeN: dict.jnj.judgeN,
    total: dict.jnj.totalScore,
    average: dict.jnj.itemAverage,
    toggle: dict.jnj.breakdown,
    note: namedJudges ? dict.jnj.breakdownNoteNamed : dict.jnj.breakdownNote,
  };

  // 고정폭 열(순위·번호·점수)이 모바일에서 이름 자리를 다 먹는다 — 여백과 폭을 모바일에서만 좁힌다.
  const th = 'px-2 py-2.5 label-caps !text-[10px] text-grey-500 md:px-4';
  const td = 'px-2 py-2.5 md:px-4';
  // 모바일에서 접는 열은 폭을 0 으로 줄인다 — display:none 으로 지우면 안 된다.
  //   펼친 채점 상세의 <td colSpan> 은 고정된 정수(데스크톱 기준 열 수)다. 모바일에서 칸이
  //   사라지면 브라우저가 모자란 수만큼 유령 열을 만들고, table-fixed 라 그 폭을 유일한
  //   가변 열인 이름 열에서 빼앗아 간다. 실제로 상세를 펼치는 순간 이름 열이 150px→50px 로
  //   줄어 이름이 한 글자씩 세로로 쪼개졌다. 열 수를 그대로 두면 그 일이 없다.
  const fold = 'w-0 max-w-0 overflow-hidden !px-0';
  // 접힌 칸의 내용까지 감춘다 — 폭 0 인 칸에 글자가 남아 옆 칸으로 새는 걸 막는다.
  const foldInner = 'hidden md:inline';
  // md 부터는 fold 를 '전부' 되돌린다 — 폭(w-0)·여백(!px-0)뿐 아니라 max-w-0 과 overflow 까지.
  // max-w-0 를 남겨 두면 Chrome 이 table-cell 에도 max-width 를 먹여 칸이 눌리고,
  // overflow-hidden 이 넘친 글자를 잘라 낸다. 실제로 3자리 참가번호가 앞 두 글자만 보여
  // '049' 가 '04' 로, 결승 평균 '9.30' 이 '9.3' 으로 나갔다(040·041·048·049 가 전부 '04').
  const unfoldMd = 'md:w-16 md:max-w-none md:overflow-visible md:!px-4';
  // 참가번호는 모바일에서 열을 접고 이름 칸 안으로 들어간다(NameCell).
  const noCell = `${fold} ${unfoldMd}`;
  // 평균도 모바일에서는 열을 접는다 — 좁은 화면에서 점수 열이 둘이면 이름 자리가 남지 않는다.
  // 대신 총점 칸 밑에 작은 줄로 같이 적어 값 자체는 잃지 않는다(총점 열이 있을 때만).
  const foldAvg = showTotal && showAvg;
  const avgCell = foldAvg ? `${fold} ${unfoldMd}` : 'w-12 md:w-16';

  return (
    <div>
      <p className="mb-2.5 label-caps !text-[11px] !tracking-[2px] text-grey-500">
        {label}
      </p>
      <div className="overflow-x-auto rounded-xl border border-beige bg-cream-light">
        {/* table-fixed 인 이유: 펼친 채점 상세(ExpandableScoreRow)가 이 표의 칸 안에 들어간다.
            auto 레이아웃이면 안쪽 표의 폭이 바깥 표까지 밀어내 모바일에서 총점 열이 화면 밖으로
            나갔다. 고정 레이아웃이면 칸 폭이 내용과 무관해져 넘치는 건 안쪽에서만 스크롤된다. */}
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-beige text-left">
              {showRank && <th className={`${th} w-11 md:w-14`}>{dict.jnj.rankLabel}</th>}
              {showNo && (
                <th className={`${th} ${noCell}`}>
                  <span className={foldInner}>{dict.jnj.entryNo}</span>
                </th>
              )}
              <th className={th}>{dict.jnj.dancer}</th>
              {showVotes && <th className={`${th} w-12 text-right md:w-16`}>{dict.jnj.votes}</th>}
              {/* 고정 레이아웃이라 '통과/탈락' 알약이 들어갈 폭을 모바일에서도 잡아 둔다. */}
              {showPassed && <th className={`${th} w-20 text-right`}>{dict.jnj.result}</th>}
              {showTotal && (
                <th className={`${th} w-16 text-right md:w-20`}>{dict.jnj.totalScore}</th>
              )}
              {showAvg && (
                <th className={`${th} ${avgCell} text-right`}>
                  <span className={foldAvg ? foldInner : ''}>{dict.jnj.avgScore}</span>
                </th>
              )}
              {showBreakdown && <th className={`${th} w-7 md:w-9`} aria-hidden />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const criteria = showBreakdown ? scoreCriteria(r) : null;
              const cells = (
                <>
                  {showRank && (
                    <td className={td}>
                      <span
                        className={`inline-flex h-7 min-w-7 items-center justify-center rounded-pill px-2 text-xs font-bold ${rankClass(r.rank ?? 0)}`}
                      >
                        {r.rank ?? '—'}
                      </span>
                    </td>
                  )}
                  {showNo && (
                    <td className={`${td} ${noCell} whitespace-nowrap tabular-nums text-grey-500`}>
                      <span className={foldInner}>{(r.entry_no ?? '').trim() || '—'}</span>
                    </td>
                  )}
                  <td className={`${td} min-w-0`}>
                    <NameCell row={r} locale={locale} />
                  </td>
                  {showVotes && (
                    <td className={`${td} whitespace-nowrap text-right font-display font-bold tabular-nums text-ink`}>
                      {r.votes ?? '—'}
                    </td>
                  )}
                  {showPassed && (
                    <td className={`${td} whitespace-nowrap text-right`}>
                      {r.passed == null ? (
                        <span className="text-grey-400">—</span>
                      ) : (
                        <span
                          className={`rounded-pill px-2 py-0.5 text-[11px] font-semibold ${
                            r.passed ? 'bg-primary/10 text-primary' : 'text-grey-400'
                          }`}
                        >
                          {r.passed ? dict.jnj.passed : dict.jnj.eliminated}
                        </span>
                      )}
                    </td>
                  )}
                  {showTotal && (
                    <td className={`${td} whitespace-nowrap text-right font-display font-bold tabular-nums text-ink`}>
                      {fmtScore(r.total_score) ?? '—'}
                      {foldAvg && (
                        <span className="mt-0.5 block font-sans text-[11px] font-normal leading-none tabular-nums text-grey-400 md:hidden">
                          {dict.jnj.avgScore} {fmtScore(r.avg_score) ?? '—'}
                        </span>
                      )}
                    </td>
                  )}
                  {showAvg && (
                    <td
                      className={`${td} ${avgCell} whitespace-nowrap text-right tabular-nums text-grey-500`}
                    >
                      <span className={foldAvg ? foldInner : ''}>
                        {fmtScore(r.avg_score) ?? '—'}
                      </span>
                    </td>
                  )}
                </>
              );
              // 채점 상세가 있는 줄만 눌린다. 없는 줄은 화살표 칸만 비워 열을 맞춘다.
              if (!criteria) {
                return (
                  <tr key={r.id} className="border-b border-beige/60 last:border-0">
                    {cells}
                    {showBreakdown && <td className={`${td} w-7 md:w-9`} />}
                  </tr>
                );
              }
              return (
                <ExpandableScoreRow
                  key={r.id}
                  criteria={criteria}
                  itemLabels={criteria.items.map((code) => criteriaLabel(code, dict))}
                  labels={breakdownLabels}
                  colSpan={colSpan}
                >
                  {cells}
                </ExpandableScoreRow>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** 라운드 한 덩어리 — 제목 + 표(리더·팔로워 둘 또는 참여자 하나). */
function RoundBlock({
  group,
  locale,
  dict,
  kind,
}: {
  group: RoundGroup;
  locale: Locale;
  dict: Dictionary;
  kind: string;
}) {
  const tables = tablesFor(group, kind, dict);
  if (tables.length === 0) return null;
  // 표가 하나면 2단 격자에서 왼쪽 반쪽만 차지해 화면이 한쪽으로 쏠린다. 가운데로 모으고
  // 읽기 좋은 너비에서 멈춘다 — 넓은 화면에서 한 줄이 끝까지 늘어나면 눈이 따라가기 힘들다.
  const solo = tables.length === 1;
  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <span className="rounded-pill bg-ink px-3 py-1 font-display text-xs font-bold uppercase tracking-wide text-white">
          {roundLabel(group.round, dict)}
        </span>
        <span className="h-px flex-1 bg-gradient-to-r from-primary/40 to-transparent" />
      </div>
      <div className={solo ? 'mx-auto w-full max-w-3xl' : 'grid gap-6 lg:grid-cols-2'}>
        {tables.map((t) => (
          <ScoreTable
            key={t.key}
            round={group.round}
            label={t.label}
            rows={t.rows}
            locale={locale}
            dict={dict}
          />
        ))}
      </div>
    </section>
  );
}

export function JnjResults({
  groups,
  kind = 'jnj',
  locale,
  dict,
}: {
  groups: RoundGroup[];
  locale: Locale;
  dict: Dictionary;
  /** 이 부문의 종류(0110). 'jnj' 가 아니면 역할을 나누지 않는다. */
  kind?: string;
}) {
  return (
    <div className="space-y-10">
      {groups.map((g) => (
        <RoundBlock key={g.round} group={g} locale={locale} dict={dict} kind={kind} />
      ))}
    </div>
  );
}
