import { notFound } from "next/navigation";
import BackLink from "@/components/BackLink";
import ToolIcon from "@/components/ToolIcon";
import ToolRunner from "@/components/ToolRunner";
import { getManifest, tools } from "@/lib/registry";

export function generateStaticParams() {
  return tools.map((t) => ({ toolId: t.manifest.id }));
}

export default async function ToolPage({ params }: { params: Promise<{ toolId: string }> }) {
  const { toolId } = await params;
  const manifest = getManifest(toolId);
  if (!manifest || manifest.status !== "available") notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex items-start gap-3 sm:gap-4">
        <BackLink />
        <span
          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white"
          style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}
        >
          <ToolIcon name={manifest.icon} className="h-7 w-7" />
        </span>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{manifest.category}</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{manifest.name}</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">{manifest.description}</p>
        </div>
      </header>

      <ToolRunner toolId={manifest.id} />
    </main>
  );
}
