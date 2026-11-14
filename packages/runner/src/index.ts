import type { ExecutionRunner, InputFiles, ProgressFn, Tool } from "@civil/tool-sdk";

/**
 * Runs a tool in the current JS context. A Web Worker wrapper will be added
 * around this for heavy tools (e.g. 117k-point topo) without changing callers.
 */
export class BrowserRunner implements ExecutionRunner {
  async run(
    tool: Tool,
    files: InputFiles,
    options: Record<string, unknown>,
    onProgress: ProgressFn,
  ) {
    const parsed = await tool.parse(files);
    const validation = tool.validate(parsed);
    if (!validation.ok) return { validation };
    const result = await tool.run(parsed, options, onProgress);
    return { validation, result };
  }
}
