import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export type Ticket = { ticket_id: string; subject: string; body: string };
export type Label = { category: string; priority: string };

const DATA_DIR = path.join(process.cwd(), "data");

const VALID_CATEGORIES = ["billing", "technical_bug", "account", "feature_request"];
const VALID_PRIORITIES = ["low", "medium", "high"];

export const ticketText = (t: Ticket) => `${t.subject}\n\n${t.body}`;

export async function loadTickets(): Promise<Ticket[]> {
  const raw = JSON.parse(await readFile(path.join(DATA_DIR, "support_tickets_500.json"), "utf8"));
  const list = Array.isArray(raw) ? raw : raw.tickets;
  return list.map((t: Record<string, unknown>) => ({
    ticket_id: String(t.ticket_id),
    subject: String(t.subject ?? ""),
    body: String(t.body ?? ""),
  }));
}

function parseCsv(text: string): Record<string, string>[] {
  text = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  const head = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}

// Labels file from the instructor: put it in data/ (any .json/.csv with "label" in its name,
// or set LABELS_FILE). Accepts an array of rows or an object keyed by ticket id.
export async function loadLabels(): Promise<Map<string, Label>> {
  let file = process.env.LABELS_FILE ? path.resolve(process.env.LABELS_FILE) : "";
  if (!file) {
    const names = await readdir(DATA_DIR);
    const found = names.find((n) => /label/i.test(n) && /\.(json|csv)$/i.test(n));
    if (!found) throw new Error("Labels file not found. Put the instructor's labels file in data/ or set LABELS_FILE.");
    file = path.join(DATA_DIR, found);
  }
  const text = await readFile(file, "utf8");
  let rows: Record<string, unknown>[];
  if (file.toLowerCase().endsWith(".csv")) rows = parseCsv(text);
  else {
    const j = JSON.parse(text);
    if (Array.isArray(j)) rows = j;
    else {
      const obj = j.labels ?? j;
      rows = Object.entries(obj).map(([id, v]) => ({ ticket_id: id, ...(v as object) }));
    }
  }
  const map = new Map<string, Label>();
  for (const r of rows) {
    const id = r.ticket_id ?? r.id;
    const category = r.category ?? r.expected_category;
    const priority = r.priority ?? r.expected_priority;
    if (id && VALID_CATEGORIES.includes(String(category)) && VALID_PRIORITIES.includes(String(priority))) {
      map.set(String(id), { category: String(category), priority: String(priority) });
    }
  }
  return map;
}

// Fisher-Yates, then take n
export function sample<T>(items: T[], n: number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

export async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}