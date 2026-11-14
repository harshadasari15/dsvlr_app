import type { Metadata } from "next";
import BackLink from "@/components/BackLink";
import RunList from "@/components/RunList";

export const metadata: Metadata = { title: "Run history · Civil Automation Hub" };

export default function HistoryPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex items-center gap-3">
        <BackLink />
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Run history</h1>
      </div>
      <p className="mt-3 text-sm text-muted">Select a run to see its details and download its output file.</p>
      <div className="mt-5">
        <RunList limit={50} emptyText="No runs yet. Process a file with any tool and it will show up here." />
      </div>
    </main>
  );
}
