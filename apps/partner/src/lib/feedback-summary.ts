// 행사 피드백 응답 → 요약 대시보드용 집계.
//
// 응답이 수십 건만 돼도 한 건씩 펼쳐 읽어서는 '대체로 어땠나' 가 안 보인다. 여기서 한 번에 센다.
// 화면(FeedbackSummary)과 AI 요약 라우트가 같은 집계를 쓴다 — 둘이 서로 다른 숫자를 말하면 안 된다.
import {
  FEEDBACK_SECTIONS,
  FEEDBACK_RATING_MAX,
  type FeedbackField,
} from '@123band/shared';
import type { FeedbackResponse } from '@/lib/queries/partner-feedback';

type Lang = 'ko' | 'en';
const label = (x: { ko: string; en: string }, lang: Lang) => (lang === 'ko' ? x.ko : x.en);

/**
 * 평점 문항의 대시보드용 짧은 이름. 설문 문구('행사 전반을 평가해 주세요')는 묻는 말이라
 * 막대 옆 라벨로는 길고, 나란히 놓았을 때 무엇끼리 비교하는지가 흐려진다.
 * 여기 없는 코드(나중에 늘어난 문항)는 설문 문구를 그대로 쓴다.
 */
const RATING_SHORT: Record<string, { ko: string; en: string }> = {
  overall_rating: { ko: '행사 전반', en: 'Overall' },
  lineup_rating: { ko: '아티스트 라인업', en: 'Artist lineup' },
  workshop_rating: { ko: '워크숍', en: 'Workshops' },
  dj_rating: { ko: 'DJ', en: 'DJs' },
  sound_rating: { ko: '음향', en: 'Sound' },
  venue_rating: { ko: '장소·위치', en: 'Venue' },
  floor_rating: { ko: '바닥 상태', en: 'Dance floor' },
  organization_rating: { ko: '운영·안내', en: 'Organization' },
  value_rating: { ko: '가격 대비', en: 'Value for money' },
};

export interface RatingStat {
  code: string;
  label: string;
  avg: number;
  n: number;
}

export interface ChoiceStat {
  code: string;
  label: string;
  section: string;
  multi: boolean;
  /** 이 문항에 답한 사람 수 — 비율의 분모. 다중 선택은 합이 100% 를 넘는다. */
  answered: number;
  options: { value: string; label: string; count: number; pct: number }[];
}

export interface TextStat {
  code: string;
  label: string;
  section: string;
  items: { text: string; name: string | null; at: string }[];
}

export interface FeedbackSummary {
  total: number;
  last7: number;
  overall: { avg: number; n: number };
  /** '꼭/아마' 라고 답한 비율. 답한 사람이 없으면 null. */
  attendAgain: { pct: number; n: number } | null;
  recommend: { pct: number; n: number } | null;
  ratings: RatingStat[];
  choices: ChoiceStat[];
  texts: TextStat[];
}

const POSITIVE = new Set(['definitely', 'probably']);
const DAY = 24 * 60 * 60 * 1000;

function positiveRate(responses: FeedbackResponse[], code: string) {
  let n = 0;
  let yes = 0;
  for (const r of responses) {
    const v = (r.answers as Record<string, unknown>)[code];
    if (typeof v !== 'string' || !v) continue;
    n++;
    if (POSITIVE.has(v)) yes++;
  }
  return n ? { pct: Math.round((yes / n) * 100), n } : null;
}

export function summarizeFeedback(
  responses: FeedbackResponse[],
  lang: Lang,
  now: number = Date.now(),
): FeedbackSummary {
  const answers = responses.map((r) => r.answers as Record<string, unknown>);

  const ratings: RatingStat[] = [];
  const choices: ChoiceStat[] = [];
  const texts: TextStat[] = [];

  for (const section of FEEDBACK_SECTIONS) {
    const sectionLabel = label(section, lang);
    for (const f of section.fields as FeedbackField[]) {
      if (f.type === 'rating') {
        const nums = answers
          .map((a) => Number(a[f.code]))
          .filter((v) => Number.isFinite(v) && v >= 1 && v <= FEEDBACK_RATING_MAX);
        if (nums.length) {
          ratings.push({
            code: f.code,
            label: label(RATING_SHORT[f.code] ?? f, lang),
            avg: nums.reduce((s, v) => s + v, 0) / nums.length,
            n: nums.length,
          });
        }
      } else if (f.type === 'single' || f.type === 'multi') {
        const counts = new Map<string, number>();
        let answered = 0;
        for (const a of answers) {
          const v = a[f.code];
          const picked = Array.isArray(v) ? v : typeof v === 'string' && v ? [v] : [];
          if (picked.length === 0) continue;
          answered++;
          for (const p of picked) counts.set(String(p), (counts.get(String(p)) ?? 0) + 1);
        }
        if (answered === 0) continue;
        choices.push({
          code: f.code,
          label: label(f, lang),
          section: sectionLabel,
          multi: f.type === 'multi',
          answered,
          // 선택지는 정의 순서를 지킨다 — 많은 순으로 섞으면 '꼭/아마/모르겠/아니' 같은 척도가 깨진다.
          options: (f.choices ?? []).map((c) => {
            const count = counts.get(c.value) ?? 0;
            return { value: c.value, label: label(c, lang), count, pct: Math.round((count / answered) * 100) };
          }),
        });
      } else if (f.type === 'textarea') {
        const items = responses
          .map((r) => {
            const v = (r.answers as Record<string, unknown>)[f.code];
            return typeof v === 'string' && v.trim()
              ? { text: v.trim(), name: r.respondent_name, at: r.created_at }
              : null;
          })
          .filter((x): x is { text: string; name: string | null; at: string } => x !== null);
        if (items.length) texts.push({ code: f.code, label: label(f, lang), section: sectionLabel, items });
      }
    }
  }

  const overallStat = ratings.find((r) => r.code === 'overall_rating');

  return {
    total: responses.length,
    last7: responses.filter((r) => now - new Date(r.created_at).getTime() <= 7 * DAY).length,
    overall: overallStat ? { avg: overallStat.avg, n: overallStat.n } : { avg: 0, n: 0 },
    attendAgain: positiveRate(responses, 'attend_again'),
    recommend: positiveRate(responses, 'recommend'),
    ratings,
    choices,
    texts,
  };
}
