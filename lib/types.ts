export type Outcome =
  | "ok"
  | "invalid_request"
  | "invalid_model_output"
  | "rate_limited"
  | "triage_unavailable"
  | "triage_timeout"
  | "internal_error";

export type Dataset = "dev100" | "full500";

export type SmokeRow = {
  ticket_id: string;
  subject: string;
  outcome: Outcome;
  message?: string;
  predicted: { category: string; priority: string } | null;
  expected: { category: string; priority: string } | null;
  category_match: boolean | null;
  priority_match: boolean | null;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
};

export type RunSummary = {
  ts: string;
  dataset: Dataset;
  requested: number;
  total: number;
  model: string;
  prompt_version: string;
  outcomes: Partial<Record<Outcome, number>>;
  compared: number; // predictions that could be compared with a label
  category_mismatches: number | null;
  priority_mismatches: number | null;
  category_accuracy: number | null;
  priority_accuracy: number | null;
  avg_latency_ms: number;
  total_tokens: number;
  cost_usd: number | null;
};
