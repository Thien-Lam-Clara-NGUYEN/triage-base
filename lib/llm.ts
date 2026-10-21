import OpenAI from "openai";
import { z } from "zod";
import { TriageSchema, type TriageResponse, type TriageUsage } from "./schema";
import { SYSTEM_PROMPT, PROMPT_VERSION } from "./prompt";
import { LlmInvalidOutputError } from "./errors";

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      baseURL: process.env.LLM_BASE_URL,
      apiKey: process.env.LLM_API_KEY,
      timeout: 60_000,
      maxRetries: 2,
    });
  }
  return _client;
}

// Use 1 (ASK): the same Zod contract, as JSON Schema
const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(TriageSchema);

function stripCodeFence(text: string): string {
  const t = text.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1] : t;
}

export function estimateCost(usage: TriageUsage): number | null {
  const pin = Number(process.env.LLM_PRICE_IN_PER_M);
  const pout = Number(process.env.LLM_PRICE_OUT_PER_M);
  if (!process.env.LLM_PRICE_IN_PER_M || !process.env.LLM_PRICE_OUT_PER_M || Number.isNaN(pin) || Number.isNaN(pout)) return null;
  return (usage.input_tokens / 1e6) * pin + (usage.output_tokens / 1e6) * pout;
}

export async function triageTicket(ticket: string): Promise<TriageResponse> {
  const model = process.env.LLM_MODEL!;
  const mode = process.env.LLM_STRUCTURED_OUTPUT === "prompt" ? "prompt" : "json_schema";
  const t0 = Date.now();

  const completion = await getClient().chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `<ticket>\n${ticket}\n</ticket>` },
    ],
    ...(mode === "json_schema"
      ? {
          response_format: {
            type: "json_schema" as const,
            json_schema: { name: "support_triage", strict: true, schema: jsonSchema as Record<string, unknown> },
          },
        }
      : {}),
  });

  // Use 2 (CHECK): text -> unknown -> validated value
  const choice = completion.choices[0];
  if (!choice || choice.finish_reason === "length") throw new LlmInvalidOutputError("cut off");

  let raw: unknown;
  try {
    raw = JSON.parse(stripCodeFence(choice.message.content ?? ""));
  } catch {
    throw new LlmInvalidOutputError("not JSON");
  }
  const parsed = TriageSchema.safeParse(raw);
  if (!parsed.success) throw new LlmInvalidOutputError("schema mismatch");

  const input = completion.usage?.prompt_tokens ?? 0;
  const output = completion.usage?.completion_tokens ?? 0;
  return {
    result: parsed.data,
    usage: { input_tokens: input, output_tokens: output, total_tokens: input + output },
    model,
    prompt_version: PROMPT_VERSION,
    latency_ms: Date.now() - t0,
  };
}
