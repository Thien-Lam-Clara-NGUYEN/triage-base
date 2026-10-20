import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RunSummary, SmokeRow } from "./types";

const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "smoke-runs.jsonl");

export async function logRun(summary: RunSummary, rows: SmokeRow[]) {
  await mkdir(LOG_DIR, { recursive: true });
  await appendFile(LOG_FILE, JSON.stringify(summary) + "\n"); // no ticket text, no key
  const runsDir = path.join(process.cwd(), "runs");
  await mkdir(runsDir, { recursive: true });
  const stamp = summary.ts.replace(/[:.]/g, "-");
  const model = summary.model.replace(/[^a-z0-9._-]/gi, "_");
  await writeFile(path.join(runsDir, `${stamp}-${summary.prompt_version}-${model}.json`), JSON.stringify({ summary, rows }, null, 2));
}

export async function readRuns(): Promise<RunSummary[]> {
  try {
    const text = await readFile(LOG_FILE, "utf8");
    return text
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as RunSummary)
      .reverse();
  } catch {
    return [];
  }
}
