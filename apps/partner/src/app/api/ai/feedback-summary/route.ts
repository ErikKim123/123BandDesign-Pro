// 행사 피드백 서술형 답변 AI 요약 — 응답이 많이 쌓였을 때 '사람들이 뭐라고 했나' 를 한 장으로.
//
// 숫자(평점·선택 분포)는 화면이 직접 센다. AI 가 맡는 건 서술형뿐이다 — 숫자까지 AI 에게 맡기면
// 화면의 숫자와 요약의 숫자가 달라질 수 있다.
//
// 개인정보: 응답자 이름·이메일은 보내지 않는다. 답변 글만 보낸다.
// 읽기는 본인 세션으로 한다 — RLS 가 '그 행사를 파는 사람' 에게만 응답을 보여 주므로 남의 행사는
// productId 를 알아도 빈 결과가 된다.
import { NextResponse } from 'next/server';
import { callClaude } from '@/lib/ai/claude';
import { requireStaff } from '@/lib/ai/guard';
import { summarizeFeedback } from '@/lib/feedback-summary';
import type { FeedbackResponse } from '@/lib/queries/partner-feedback';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 프롬프트에 넣는 서술형 글의 총량 상한 — 응답이 수백 건이어도 한 번의 호출 안에 들어가게. */
const MAX_CHARS = 40_000;
const MAX_PER_ANSWER = 600;

export interface FeedbackAiSummary {
  overview: string;
  highlights: string[];
  painPoints: string[];
  suggestions: string[];
  mentionedArtists: string[];
  mentionedDjs: string[];
}

function system(lang: 'ko' | 'en') {
  const out = lang === 'ko' ? 'Korean' : 'English';
  return `You summarize post-event survey answers for a Latin dance festival organizer.
Write in ${out}. Be concrete and faithful to what respondents actually wrote — never invent praise or complaints.
When several people say the same thing, say so ("여러 명이" / "several people"). Quote short phrases only when they add color.
Return ONLY a JSON object, no prose, with exactly these keys:
{"overview": string (2-3 sentences),
 "highlights": string[] (what people loved, max 5),
 "painPoints": string[] (what did not work, max 5),
 "suggestions": string[] (concrete changes people asked for, max 5),
 "mentionedArtists": string[] (artist/instructor names people praised or want back, most-mentioned first, max 8),
 "mentionedDjs": string[] (DJ names people enjoyed, most-mentioned first, max 8)}
Use empty arrays when there is nothing for a key.`;
}

function parse(raw: string): FeedbackAiSummary | null {
  // 모델이 코드펜스로 감싸 보내는 경우가 있다 — 첫 { 부터 마지막 } 까지만 읽는다.
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const j = JSON.parse(raw.slice(start, end + 1)) as Partial<FeedbackAiSummary>;
    const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
    return {
      overview: typeof j.overview === 'string' ? j.overview : '',
      highlights: list(j.highlights),
      painPoints: list(j.painPoints),
      suggestions: list(j.suggestions),
      mentionedArtists: list(j.mentionedArtists),
      mentionedDjs: list(j.mentionedDjs),
    };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { productId?: string; lang?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const productId = (body.productId ?? '').trim();
  const lang = body.lang === 'ko' ? 'ko' : 'en';
  if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 });

  const { data, error } = await auth.supabase
    .from('event_feedback')
    .select('id, product_id, respondent_name, respondent_email, answers, created_at')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const summary = summarizeFeedback((data ?? []) as unknown as FeedbackResponse[], lang);
  if (summary.texts.length === 0) {
    return NextResponse.json({ error: 'no_text' }, { status: 422 });
  }

  // 문항별로 묶어 보낸다. 이름은 빼고 글만. 상한을 넘으면 뒤쪽(오래된) 답부터 잘린다.
  let budget = MAX_CHARS;
  const blocks: string[] = [];
  for (const t of summary.texts) {
    const lines: string[] = [];
    for (const it of t.items) {
      const line = `- ${it.text.replace(/\s+/g, ' ').slice(0, MAX_PER_ANSWER)}`;
      if (budget - line.length < 0) break;
      budget -= line.length;
      lines.push(line);
    }
    if (lines.length) blocks.push(`## ${t.section} — ${t.label}\n${lines.join('\n')}`);
  }

  const context = [
    `Responses: ${summary.total}`,
    summary.overall.n ? `Overall rating: ${summary.overall.avg.toFixed(1)}/5 (n=${summary.overall.n})` : '',
    ...summary.ratings.map((r) => `${r.label}: ${r.avg.toFixed(1)}/5 (n=${r.n})`),
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const raw = await callClaude(
      system(lang),
      `Numeric context (already shown to the organizer — use only to weigh the comments):\n${context}\n\nFree-text answers:\n\n${blocks.join('\n\n')}`,
      1800,
    );
    const parsed = parse(raw);
    if (!parsed) return NextResponse.json({ error: 'parse_failed' }, { status: 502 });
    return NextResponse.json({ summary: parsed, basedOn: summary.total });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'ai_failed' },
      { status: 502 },
    );
  }
}
