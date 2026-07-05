type GroqMessage = { role: "system" | "user" | "assistant"; content: string };

export class GroqError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function completeWithGroq(
  messages: GroqMessage[],
  maxTokens = 400,
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new GroqError(503, "GROQ_API_KEY is not configured");

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL ?? "llama-3.1-8b-instant",
        messages,
        temperature: 0.55,
        max_completion_tokens: maxTokens,
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    console.error("Groq API error", response.status, detail.slice(0, 500));
    throw new GroqError(response.status, "Groq request failed");
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new GroqError(502, "Groq returned an empty response");
  return content;
}
