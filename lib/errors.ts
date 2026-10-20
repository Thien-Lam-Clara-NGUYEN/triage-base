import OpenAI from "openai";
import type { Outcome } from "./types";

export class LlmInvalidOutputError extends Error {}

export type MappedError = { status: number; outcome: Outcome; message: string };

// One failure -> one status and one safe message. Nothing from the provider reaches the browser.
export function mapError(e: unknown): MappedError {
  if (e instanceof LlmInvalidOutputError)
    return { status: 502, outcome: "invalid_model_output", message: "The model returned an answer we could not use. Try again." };
  if (e instanceof OpenAI.APIConnectionTimeoutError)
    return { status: 504, outcome: "triage_timeout", message: "The model took too long to answer. Try again." };
  if (e instanceof OpenAI.RateLimitError)
    return { status: 429, outcome: "rate_limited", message: "Too many requests. Wait a moment and try again." };
  if (e instanceof OpenAI.APIConnectionError)
    return { status: 502, outcome: "triage_unavailable", message: "The model provider is unreachable. Try again later." };
  if (e instanceof OpenAI.APIError && (e.status ?? 500) >= 500)
    return { status: 502, outcome: "triage_unavailable", message: "The model provider is unavailable. Try again later." };
  // 400/401/403/404 = our configuration (key, model, parameter): log on the server only
  console.error("[triage] internal error:", e instanceof Error ? e.message : e);
  return { status: 500, outcome: "internal_error", message: "Something went wrong on the server." };
}
