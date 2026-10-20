import TriagePanel from "../components/TriagePanel";
import SmokePanel from "../components/SmokePanel";

export default function Home() {
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1rem", display: "grid", gap: "2.5rem" }}>
      <h1>Support Triage</h1>
      <TriagePanel />
      <SmokePanel />
      <p><a href="/admin">See all logged smoke test runs</a></p>
    </main>
  );
}
