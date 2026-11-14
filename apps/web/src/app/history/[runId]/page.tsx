import type { Metadata } from "next";
import RunDetail from "@/components/RunDetail";

export const metadata: Metadata = { title: "Run details · Civil Automation Hub" };

export default async function RunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  return <RunDetail runId={runId} />;
}
