import { tool as culvert } from "@civil/tool-culvert-gl";
import { tool as borehole } from "@civil/tool-borehole";
import type { Tool, ToolManifest } from "@civil/tool-sdk";

/**
 * Runnable tools. Adding a tool = new package + one line here.
 * Tools not listed here but present in `manifests` show as "coming soon".
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tools: Tool<any>[] = [culvert, borehole];

export const toolManifests: ToolManifest[] = tools.map((t) => t.manifest);

export function getManifest(id: string): ToolManifest | undefined {
  return toolManifests.find((m) => m.id === id);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTool(id: string): Tool<any> | undefined {
  return tools.find((t) => t.manifest.id === id);
}
