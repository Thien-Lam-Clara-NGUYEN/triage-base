"use client";
import { useState } from "react";
import { MAX_SMOKE_N, SmokeRequestSchema } from "../lib/schema";
import type { Dataset, RunSummary, SmokeRow } from "../lib/types";

const cell = { padding: "0.35rem 0.5rem", borderBottom: "1px solid rgba(128,128,128,.3)", textAlign: "left" as const };
const bad = { background: "rgba(192,57,43,.2)" };

export default function SmokePanel() {
  const [dataset, setDataset] = useState<Dataset>("dev100");
  const [n, setN] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<SmokeRow[] | null>(null);
  const [summary, setSummary] = useState<RunSummary | null>(null);

  async function run() {
    setError(null);
    setRows(null);
    setSummary(null);
    const check = SmokeRequestSchema.safeParse({ dataset, n });
    if (!check.success) {
      setError(check.error.issues[0]?.message ?? "Invalid settings.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/smoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(check.data),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.message ?? `Request failed (${res.status}).`);
        return;
      }
      setRows(json.rows);
      setSummary(json.summary);
    } catch {
      setError("Network error: could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  const labelled = summary?.category_mismatches !== null && summary?.category_mismatches !== undefined;

  return (
    <section style={{ display: "grid", gap: "0.75rem" }}>
      <h2>Smoke test</h2>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "end" }}>
        <label style={{ display: "grid", gap: 4 }}>
          Dataset
          <select value={dataset} onChange={(e) => setDataset(e.target.value as Dataset)}>
            <option value="dev100">Labelled set (100 tickets)</option>
            <option value="full500">Full set (500 tickets, no labels)</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          Random tickets to run
          <input type="number" min={1} max={MAX_SMOKE_N} value={n} onChange={(e) => setN(Number(e.target.value))} style={{ width: 100 }} />
        </label>
        <button onClick={run} disabled={loading}>{loading ? "Running…" : "Run smoke test"}</button>
      </div>
      {loading && <p>Running {n} tickets. This can take a minute.</p>}
      {error && (
        <div role="alert" style={{ border: "1px solid #c0392b", background: "rgba(192,57,43,.12)", borderRadius: 8, padding: "1rem" }}>{error}</div>
      )}
      {rows && summary && (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={cell}>Ticket</th>
                  <th style={cell}>Outcome</th>
                  <th style={cell}>Category (LLM)</th>
                  {labelled && <th style={cell}>Category (label)</th>}
                  <th style={cell}>Priority (LLM)</th>
                  {labelled && <th style={cell}>Priority (label)</th>}
                  <th style={cell}>Tokens</th>
                  <th style={cell}>Latency</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.ticket_id}>
                    <td style={cell} title={r.subject}>{r.ticket_id}</td>
                    <td style={cell}>{r.outcome}{r.message ? ` (${r.message})` : ""}</td>
                    <td style={{ ...cell, ...(r.category_match === false ? bad : {}) }}>{r.predicted?.category ?? "–"}</td>
                    {labelled && <td style={{ ...cell, ...(r.category_match === false ? bad : {}) }}>{r.expected?.category ?? "–"}</td>}
                    <td style={{ ...cell, ...(r.priority_match === false ? bad : {}) }}>{r.predicted?.priority ?? "–"}</td>
                    {labelled && <td style={{ ...cell, ...(r.priority_match === false ? bad : {}) }}>{r.expected?.priority ?? "–"}</td>}
                    <td style={cell}>{r.input_tokens + r.output_tokens}</td>
                    <td style={cell}>{r.latency_ms} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ border: "1px solid rgba(128,128,128,.4)", borderRadius: 8, padding: "1rem", display: "grid", gap: 4 }}>
            <div><strong>{summary.total}</strong> tickets run with {summary.model}. Outcomes: {Object.entries(summary.outcomes).map(([k, v]) => `${k} ${v}`).join(", ")}.</div>
            {labelled ? (
              <>
                <div>Category mismatches: <strong>{summary.category_mismatches}</strong> of {summary.compared} predictions.</div>
                <div>Priority mismatches: <strong>{summary.priority_mismatches}</strong> of {summary.compared} predictions.</div>
              </>
            ) : (
              <div>The full set has no labels, so predictions are shown without a comparison.</div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
