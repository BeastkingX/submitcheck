import { NextResponse } from "next/server";
import { handleAgentRequest } from "@/lib/agent";

// Live review: validate input, call Gemini (one retry on 5xx), verify evidence.
export const dynamic = "force-dynamic";
// Vercel Hobby allows up to 300 s. Two 30 s attempts plus overhead must fit,
// so this is 90 s. Must stay a literal: Next.js statically analyses segment
// config, so importing the value breaks the build. test/agent.test.ts asserts
// RETRY_BUDGET_MS fits inside this number.
export const maxDuration = 90;

export async function POST(request: Request) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      { error: "Could not read the request body." },
      { status: 400 },
    );
  }

  // The key and model are read here, server-side only. They are never sent to
  // the client, echoed in a response, or logged.
  const result = await handleAgentRequest({
    rawBody,
    env: {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      GEMINI_MODEL: process.env.GEMINI_MODEL,
    },
  });

  return NextResponse.json(result.body, { status: result.status });
}
