import RecentRuns from "@/components/RecentRuns";
import ToolGrid from "@/components/ToolGrid";
import { toolManifests } from "@/lib/registry";

const FEATURES = [
  { title: "Excel in, Excel out", body: "Upload your workbook, get a clean workbook back." },
  { title: "Runs in your browser", body: "Files never leave your computer." },
  { title: "Checks before you run", body: "Data problems are flagged up front, not buried." },
];

export default function LandingPage() {
  return (
    <main>
      <section className="relative overflow-hidden">
        <div className="hero-grid absolute inset-0 -z-10" aria-hidden />
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-14 sm:px-6 sm:pb-14 sm:pt-20">
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent-2)" }} />
            Civil engineering automation
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Turn day-to-day survey and design data into <span className="gradient-text">ready results</span>.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            Pick a tool, upload your Excel inputs, review the checks, and download the output. No installs, no AutoCAD.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#tools" className="btn-primary rounded-lg px-5 py-2.5 text-sm font-semibold">
              Browse tools
            </a>
          </div>
          <ul className="mt-10 grid gap-3 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="rounded-xl border border-border bg-surface/70 p-4 backdrop-blur">
                <p className="text-sm font-semibold">{f.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{f.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <ToolGrid manifests={toolManifests} />
      <RecentRuns />
    </main>
  );
}
