import { z } from "zod";

export const CATEGORIES = ["billing", "technical_bug", "account", "feature_request"] as const;
export const PRIORITIES = ["low", "medium", "high"] as const;
export const MAX_TICKET_CHARS = 5000;
export const MAX_SMOKE_N = 100;

// Request sent by the browser to POST /api/triage
export const TriageRequestSchema = z.object({
  ticket: z
    .string("The ticket must be text.")
    .trim()
    .min(1, "The ticket is empty. Paste a customer ticket first.")
    .max(MAX_TICKET_CHARS, `The ticket is too long (max ${MAX_TICKET_CHARS} characters).`),
});

// What we ask the model for, and what we check when it answers
export const TriageSchema = z.object({
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
  summary: z.string().min(1).max(300),
  suggested_action: z.string().min(1).max(500),
});

export const UsageSchema = z.object({
  input_tokens: z.number(),
  output_tokens: z.number(),
  total_tokens: z.number(),
});

// Response sent by POST /api/triage
export const TriageResponseSchema = z.object({
  result: TriageSchema,
  usage: UsageSchema,
  model: z.string(),
  prompt_version: z.string(),
  latency_ms: z.number(),
});

export const SmokeRequestSchema = z.object({
  dataset: z.enum(["dev100", "full500"], "Choose a dataset."),
  n: z
    .number("Enter a number of tickets.")
    .int("The number of tickets must be a whole number.")
    .min(1, "Sample at least 1 ticket.")
    .max(MAX_SMOKE_N, `Sample at most ${MAX_SMOKE_N} tickets per run.`),
});

export type TriageResult = z.infer<typeof TriageSchema>;
export type TriageResponse = z.infer<typeof TriageResponseSchema>;
export type TriageUsage = z.infer<typeof UsageSchema>;
