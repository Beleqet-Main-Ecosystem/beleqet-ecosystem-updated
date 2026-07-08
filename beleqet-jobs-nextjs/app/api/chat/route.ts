import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { completeWithGroq, GroqError } from "@/lib/groq";

export const runtime = "nodejs";

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      }),
    )
    .min(1)
    .max(20),
});

const SYSTEM_PROMPT = `You are Beleqet Assistant, a concise and friendly support chatbot for Beleqet Jobs, an Ethiopian hiring and freelance platform.
Help with finding and applying to jobs, accounts, employer job posts, the CV builder, freelance gigs, and site navigation.
Use clear, practical language. Never invent job listings or account information. For unrelated questions, steer back to careers and Beleqet.

When listing steps, features, or details, ALWAYS format them as structured lists:
- Use bullet points (- ) or numbered lists (1. ) for list items.
- Ensure each list item is on its own line.
- Leave an empty line between paragraphs, headers, and lists to keep the structure clear and readable.
- Highlight key terms by wrapping them in bold (e.g. **important term**).`;

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.parse(await req.json());
    const messages = parsed.messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));
    const reply = await completeWithGroq(
      [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      400,
    );
    return NextResponse.json({ reply });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const status = error instanceof GroqError ? error.status : 500;
    const unavailable = status === 429 || status >= 500;
    return NextResponse.json(
      {
        reply: unavailable
          ? "The assistant is temporarily unavailable. Please try again shortly."
          : "The assistant could not process that request.",
      },
      { status: unavailable ? 503 : 400 },
    );
  }
}
