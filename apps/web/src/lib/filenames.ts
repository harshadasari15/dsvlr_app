const pad = (n: number) => String(n).padStart(2, "0");

/** Local-time stamp for file names, e.g. 20261114-174530. */
export function fileStamp(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/** e.g. borehole-plan-output_20261114-174530.xlsx */
export function outputFileName(toolId: string, ranAt: Date): string {
  return `${toolId}-output_${fileStamp(ranAt)}.xlsx`;
}

/** Triggers a browser download of the given bytes. */
export function downloadBuffer(buf: ArrayBuffer, filename: string): void {
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
