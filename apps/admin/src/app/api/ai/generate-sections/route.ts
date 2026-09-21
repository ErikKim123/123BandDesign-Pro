// 행사 상세 섹션 AI 초안 — 이미 입력된 구조화 데이터를 근거로 "빈 섹션 채우기"용 HTML 초안 생성. 스태프 전용.
import { NextResponse } from 'next/server';
import { callClaude } from '@/lib/ai/claude';
import { EVENT_SECTIONS_SYSTEM, buildEventSectionsPrompt, type EventSectionsInput } from '@/lib/ai/prompt';
import { requireStaff } from '@/lib/ai/guard';

export async function POST(req: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }

  const name = String(body.name ?? '').trim();
  if (!name) return NextResponse.json({ error: '패스명은 필수입니다.' }, { status: 400 });

  const str = (v: unknown) => (v == null ? undefined : String(v).trim() || undefined);
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter(Boolean).map(String) : undefined);
  const input: EventSectionsInput = {
    name,
    nameKo: str(body.nameKo),
    eventType: str(body.eventType),
    country: str(body.country),
    venue: str(body.venue),
    venueKo: str(body.venueKo),
    address: str(body.address),
    addressKo: str(body.addressKo),
    startAt: str(body.startAt),
    endAt: str(body.endAt),
    applyStart: str(body.applyStart),
    applyEnd: str(body.applyEnd),
    organizer: str(body.organizer),
    organizerKo: str(body.organizerKo),
    organizerContact: str(body.organizerContact),
    danceStyles: arr(body.danceStyles),
    levels: arr(body.levels),
    tickets: arr(body.tickets),
    priceText: str(body.priceText),
    about: str(body.about),
  };

  let text: string;
  try {
    // 7섹션(티켓 포함 사항 추가)×2언어 HTML → 실측 ~3k. 잘림→JSON 파싱실패 방지로 여유 확보.
    text = await callClaude(EVENT_SECTIONS_SYSTEM, buildEventSectionsPrompt(input), 5120);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'AI 생성 실패' }, { status: 502 });
  }

  // 코드펜스/잡텍스트 방어 후 JSON 파싱
  let data: unknown;
  try {
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const s = cleaned.indexOf('{');
    const e = cleaned.lastIndexOf('}');
    data = JSON.parse(s >= 0 && e > s ? cleaned.slice(s, e + 1) : cleaned);
  } catch {
    return NextResponse.json({ error: 'AI 응답을 해석하지 못했습니다. 다시 시도하세요.' }, { status: 502 });
  }

  const sections = (data as { sections?: unknown }).sections ?? {};
  return NextResponse.json({ sections });
}
