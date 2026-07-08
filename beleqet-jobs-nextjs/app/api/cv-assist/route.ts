import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { completeWithGroq, GroqError } from "@/lib/groq";

export const runtime = "nodejs";

const schema = z.object({
  fullName: z.string().max(100),
  title: z.string().max(120),
  skills: z.string().max(1000),
  experience: z
    .array(
      z.object({
        role: z.string().max(120),
        company: z.string().max(120),
        description: z.string().max(1500),
      }),
    )
    .max(10),
});

export async function POST(request: NextRequest) {
  try {
    const cv = schema.parse(await request.json());
    if (
      !cv.title &&
      !cv.skills &&
      !cv.experience.some((item) => item.role || item.description)
    ) {
      return NextResponse.json(
        { error: "Add a title, skills, or work experience first." },
        { status: 400 },
      );
    }
    const prompt = `Write a strong professional CV summary in 55-80 words. Use only the facts provided. Do not use first-person pronouns, headings, markdown, or generic filler.\n\nCV data:\n${JSON.stringify(cv)}`;
    const summary = await completeWithGroq(
      [
        {
          role: "system",
          content:
            "You are an expert CV writer for the Ethiopian and international job market. Never invent qualifications, metrics, or experience.",
        },
        { role: "user", content: prompt },
      ],
      180,
    );
    return NextResponse.json({ summary });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: "Invalid CV data." }, { status: 400 });
    const status = error instanceof GroqError ? error.status : 500;
    return NextResponse.json(
      {
        error:
          status === 429
            ? "AI capacity reached. Try again shortly."
            : "AI assistance is unavailable.",
      },
      { status: status === 429 ? 429 : 503 },
    );
  }
}
