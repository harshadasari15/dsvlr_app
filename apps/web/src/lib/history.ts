import type { Platform } from "@civil/platform";

/** Stored outputs are kept this long; the run's metadata stays in history. */
export const OUTPUT_RETENTION_DAYS = 30;

/**
 * Best-effort cleanup (the free tier has no scheduled jobs): delete output files
 * older than the retention window and forget their paths. Never throws.
 */
export async function pruneExpiredOutputs(platform: Platform): Promise<void> {
  if (!platform.files) return;
  try {
    const cutoff = new Date(Date.now() - OUTPUT_RETENTION_DAYS * 86_400_000).toISOString();
    const expired = await platform.runs.listWithOutputBefore(cutoff, 25);
    for (const run of expired) {
      if (!run.outputPath) continue;
      try {
        await platform.files.delete(run.outputPath);
        await platform.runs.clearOutput(run.id);
      } catch {
        /* try again next time */
      }
    }
  } catch {
    /* cleanup is optional */
  }
}
