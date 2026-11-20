import { NextResponse } from "next/server";

// Placeholder endpoint for the early deploy step.
// Live review is intentionally not wired up yet: return an honest error
// instead of any fake analysis.
export const dynamic = "force-dynamic";

export function POST() {
  return NextResponse.json(
    { error: "Live review is not ready yet." },
    { status: 503 },
  );
}
