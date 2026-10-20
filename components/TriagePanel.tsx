"use client";
import { useState } from "react";
import { TriageRequestSchema, type TriageResponse } from "../lib/schema";

const box = { border: "1px solid rgba(128,128,128,.4)", borderRadius: 8, padding: "1rem" } as const;

export default function TriagePanel() {
  const [ticket, setTicket] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TriageResponse | null>(null);

  async function submit() {
    setError(null);
    setData(null);
    const check = TriageRequestSchema.safeParse({ ticket });
    if (!check.success) {
      setError(check.error.issues[0]?.message ?? "Invalid ticket.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: check.data.ticket }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.message ?? `Request failed (${res.status}).`);
        return;
      }
      setData(json as TriageResponse);
    } catch {
      setError("Network error: could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section style={{ display: "grid", gap: "0.75rem" }}>
      <h2>Triage a ticket</h2>
      <textarea
        value={ticket}
        onChange={(e) => setTicket(e.target.value)}
        rows={8}
        placeholder="Paste the customer ticket here (subject and body)"
        style={{ width: "100%", padding: "0.75rem", font: "inherit" }}
      />
      <div>
        <button onClick={submit} disabled={loading}>{loading ? "Triaging…" : "Triage ticket"}</button>
      </div>
      {error && (
        <div role="alert" style={{ ...box, borderColor: "#c0392b", background: "rgba(192,57,43,.12)" }}>{error}</div>
      )}
      {data && (
        <div style={{ ...box, display: "grid", gap: "0.5rem" }}>
          <div><strong>Category:</strong> {data.result.category}</div>
          <div><strong>Priority:</strong> {data.result.priority}</div>
          <div><strong>Summary:</strong> {data.result.summary}</div>
          <div><strong>Suggested action:</strong> {data.result.suggested_action}</div>
          <div style={{ opacity: 0.75, fontSize: "0.9em" }}>
            Tokens: {data.usage.input_tokens} in / {data.usage.output_tokens} out / {data.usage.total_tokens} total
            {" · "}{data.latency_ms} ms{" · "}{data.model}{" · "}{data.prompt_version}
          </div>
        </div>
      )}
    </section>
  );
}
