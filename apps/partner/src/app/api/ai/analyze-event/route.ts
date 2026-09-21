// 행사 포스터 이미지 → AI 분석 → 위저드 자동채움용 구조화 JSON. 관리/오거나이저 전용.
import { NextResponse } from 'next/server';
import { callClaudeVision } from '@/lib/ai/claude';
import { EVENT_ANALYZE_SYSTEM } from '@/lib/ai/prompt';
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

  const base64 = String(body.imageBase64 ?? '');
  const mediaType = String(body.mediaType ?? 'image/jpeg');
  if (!base64) return NextResponse.json({ error: '이미지가 필요합니다.' }, { status: 400 });
  if (!/^image\/(jpeg|png|webp|gif)$/.test(mediaType)) {
    return NextResponse.json({ error: '지원하지 않는 이미지 형식입니다 (JPG/PNG/WebP/GIF).' }, { status: 400 });
  }
  // 과도한 페이로드 방지 (~7MB base64 ≈ 5MB 이미지)
  if (base64.length > 7_500_000) {
    return NextResponse.json({ error: '이미지가 너무 큽니다 (5MB 이하).' }, { status: 413 });
  }

  let text: string;
  try {
    text = await callClaudeVision(
      EVENT_ANALYZE_SYSTEM,
      'Analyze this event poster and return the JSON.',
      { mediaType, base64 },
      // 기본정보 + about + 섹션 초안(4) + SEO 를 한 응답에 담으므로 잘림(→전체 파싱실패) 방지로 여유 확보.
      4096,
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI 분석 실패' },
      { status: 502 },
    );
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

  return NextResponse.json({ data });
}
