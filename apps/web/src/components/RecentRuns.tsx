import Link from "next/link";
import RunList from "./RunList";

export default function RecentRuns() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6" aria-labelledby="recent-h">
      <div className="flex items-baseline justify-between">
        <h2 id="recent-h" className="text-xl font-semibold tracking-tight">
          Recent runs
        </h2>
        <Link href="/history" className="text-sm font-medium text-accent hover:underline">
          View all
        </Link>
      </div>
      <div className="mt-4">
        <RunList limit={5} emptyText="Your runs will appear here after you process a file." />
      </div>
    </section>
  );
}
