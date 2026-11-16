type GroqMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export class GroqError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Tokens a reasoning model may spend thinking, on top of the answer's own limit.
const REASONING_ALLOWANCE = 256;

/** `maxTokens` is the answer's length; a reasoning model gets a short think on top of it. */
export async function completeWithGroq(messages: GroqMessage[], maxTokens = 400): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new GroqError(503, 'GROQ_API_KEY is not configured');

  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
  // gpt-oss thinks before it answers, and the thinking counts against max_completion_tokens.
  // At its default effort it used the whole limit thinking and returned no text.
  const reasoning = model.startsWith('openai/gpt-oss');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.55,
      max_completion_tokens: reasoning ? maxTokens + REASONING_ALLOWANCE : maxTokens,
      ...(reasoning && { reasoning_effort: 'low' }),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error('Groq API error', response.status, detail.slice(0, 500));
    throw new GroqError(response.status, 'Groq request failed');
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new GroqError(502, 'Groq returned an empty response');
  return content;
}
