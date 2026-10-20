import { readRuns } from "../../lib/runs";

export const dynamic = "force-dynamic";

const cell = { padding: "0.4rem 0.6rem", borderBottom: "1px solid rgba(128,128,128,.3)", textAlign: "left" as const, whiteSpace: "nowrap" as const };
const pct = (v: number | null) => (v === null ? "n/a" : `${(v * 100).toFixed(1)}%`);

export default async function AdminPage() {
  const runs = await readRuns();
  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem 1rem", display: "grid", gap: "1rem" }}>
      <h1>Smoke test runs</h1>
      <p><a href="/">Back to the triage page</a></p>
      {runs.length === 0 ? (
        <p>No run logged yet. Start a smoke test from the home page.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={cell}>Date</th>
                <th style={cell}>Model</th>
                <th style={cell}>Prompt</th>
                <th style={cell}>Dataset</th>
                <th style={cell}>Tickets</th>
                <th style={cell}>Category accuracy</th>
                <th style={cell}>Priority accuracy</th>
                <th style={cell}>Outcomes</th>
                <th style={cell}>Avg latency</th>
                <th style={cell}>Tokens</th>
                <th style={cell}>Cost</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.ts}>
                  <td style={cell}>{new Date(r.ts).toLocaleString("en-GB")}</td>
                  <td style={cell}>{r.model}</td>
                  <td style={cell}>{r.prompt_version}</td>
                  <td style={cell}>{r.dataset === "dev100" ? "Labelled 100" : "Full 500"}</td>
                  <td style={cell}>{r.total}</td>
                  <td style={cell}>{pct(r.category_accuracy)}</td>
                  <td style={cell}>{pct(r.priority_accuracy)}</td>
                  <td style={cell}>{Object.entries(r.outcomes).map(([k, v]) => `${k}: ${v}`).join(", ")}</td>
                  <td style={cell}>{r.avg_latency_ms} ms</td>
                  <td style={cell}>{r.total_tokens}</td>
                  <td style={cell}>{r.cost_usd === null ? "n/a" : `$${r.cost_usd.toFixed(4)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
