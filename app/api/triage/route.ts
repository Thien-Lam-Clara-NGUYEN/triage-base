import { NextResponse } from "next/server";
import { TriageRequestSchema } from "../../../lib/schema";
import { triageTicket } from "../../../lib/llm";
import { mapError } from "../../../lib/errors";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = TriageRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", message: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(await triageTicket(parsed.data.ticket));
  } catch (e) {
    const m = mapError(e);
    return NextResponse.json({ error: m.outcome, message: m.message }, { status: m.status });
  }
}
