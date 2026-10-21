import { NextResponse } from "next/server";
import { SmokeRequestSchema, TriageRequestSchema } from "../../../lib/schema";
import { triageTicket, estimateCost } from "../../../lib/llm";
import { mapError } from "../../../lib/errors";
import { loadLabels, loadTickets, pool, sample, ticketText, type Label } from "../../../lib/tickets";
import { logRun } from "../../../lib/runs";
import { PROMPT_VERSION } from "../../../lib/prompt";
import type { Outcome, RunSummary, SmokeRow } from "../../../lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = SmokeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", message: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }
  const { dataset, n } = parsed.data;

  let tickets;
  let labels: Map<string, Label> | null = null;
  try {
    tickets = await loadTickets();
    if (dataset === "dev100") {
      labels = await loadLabels();
      tickets = tickets.filter((t) => labels!.has(t.ticket_id));
      if (tickets.length === 0) throw new Error("No ticket matches the labels file.");
    }
  } catch (e) {
    return NextResponse.json({ error: "data_unavailable", message: e instanceof Error ? e.message : "Dataset unavailable." }, { status: 500 });
  }

  const chosen = sample(tickets, n);
  const model = process.env.LLM_MODEL ?? "unknown";

  const rows: SmokeRow[] = await pool(chosen, 2, async (t) => {
    const expected = labels?.get(t.ticket_id) ?? null;
    const base = { ticket_id: t.ticket_id, subject: t.subject, expected };
    const check = TriageRequestSchema.safeParse({ ticket: ticketText(t) });
    if (!check.success) {
      return { ...base, outcome: "invalid_request" as Outcome, message: check.error.issues[0]?.message, predicted: null, category_match: null, priority_match: null, input_tokens: 0, output_tokens: 0, latency_ms: 0 };
    }
    const t0 = Date.now();
    try {
      const r = await triageTicket(check.data.ticket);
      return {
        ...base,
        outcome: "ok" as Outcome,
        predicted: { category: r.result.category, priority: r.result.priority },
        category_match: expected ? expected.category === r.result.category : null,
        priority_match: expected ? expected.priority === r.result.priority : null,
        input_tokens: r.usage.input_tokens,
        output_tokens: r.usage.output_tokens,
        latency_ms: r.latency_ms,
      };
    } catch (e) {
      const m = mapError(e);
      return { ...base, outcome: m.outcome, message: m.message, predicted: null, category_match: null, priority_match: null, input_tokens: 0, output_tokens: 0, latency_ms: Date.now() - t0 };
    }
  });

  const outcomes: RunSummary["outcomes"] = {};
  for (const r of rows) outcomes[r.outcome] = (outcomes[r.outcome] ?? 0) + 1;

  const compared = rows.filter((r) => r.category_match !== null);
  const catMis = compared.filter((r) => r.category_match === false).length;
  const priMis = compared.filter((r) => r.priority_match === false).length;
  const totalIn = rows.reduce((s, r) => s + r.input_tokens, 0);
  const totalOut = rows.reduce((s, r) => s + r.output_tokens, 0);
  const priced = estimateCost({ input_tokens: totalIn, output_tokens: totalOut, total_tokens: totalIn + totalOut });
  const okRows = rows.filter((r) => r.outcome === "ok");

  const summary: RunSummary = {
    ts: new Date().toISOString(),
    dataset,
    requested: n,
    total: rows.length,
    model,
    prompt_version: PROMPT_VERSION,
    outcomes,
    compared: compared.length,
    category_mismatches: labels ? catMis : null,
    priority_mismatches: labels ? priMis : null,
    category_accuracy: labels && compared.length ? (compared.length - catMis) / compared.length : null,
    priority_accuracy: labels && compared.length ? (compared.length - priMis) / compared.length : null,
    avg_latency_ms: okRows.length ? Math.round(okRows.reduce((s, r) => s + r.latency_ms, 0) / okRows.length) : 0,
    total_tokens: totalIn + totalOut,
    cost_usd: priced,
  };

  try {
    await logRun(summary, rows);
  } catch (e) {
    console.error("[smoke] could not write run log:", e);
  }
  return NextResponse.json({ summary, rows });
}
