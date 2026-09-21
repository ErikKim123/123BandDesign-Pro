// Design Ref: §5 — Claude Messages API 직접 호출 (SDK 없이 fetch). 키는 서버 env 전용(노출 금지).
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
// 상품 HTML 생성/번역: 품질·속도 균형 (Claude Sonnet 4.6)
const MODEL = 'claude-sonnet-4-6';

export async function callClaude(
  system: string,
  user: string,
  maxTokens = 2000,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !apiKey.startsWith('sk-ant-')) {
    throw new Error('ANTHROPIC_API_KEY 가 설정되지 않았습니다 (.env 확인).');
  }

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Claude API ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = data.content?.find((b) => b.type === 'text')?.text ?? '';
  return text.trim();
}

/** 이미지(비전) + 텍스트 프롬프트 → 텍스트 응답. 행사 포스터 분석 등. */
export async function callClaudeVision(
  system: string,
  userText: string,
  image: { mediaType: string; base64: string },
  maxTokens = 2500,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !apiKey.startsWith('sk-ant-')) {
    throw new Error('ANTHROPIC_API_KEY 가 설정되지 않았습니다 (.env 확인).');
  }

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.base64 } },
            { type: 'text', text: userText },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Claude API ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  return (data.content?.find((b) => b.type === 'text')?.text ?? '').trim();
}
