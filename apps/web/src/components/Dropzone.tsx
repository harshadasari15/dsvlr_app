"use client";

import type { InputSlot, LoadedFile } from "@civil/tool-sdk";
import { useId, useState } from "react";

interface Props {
  slot: InputSlot;
  loaded: LoadedFile | undefined;
  disabled?: boolean;
  onFile: (file: File | undefined) => void;
}

export default function Dropzone({ slot, loaded, disabled, onFile }: Props) {
  const id = useId();
  const [over, setOver] = useState(false);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {slot.label}
          <span className="ml-1.5 text-xs font-normal text-muted">{slot.required ? "Required" : "Optional"}</span>
        </label>
        <span className="text-xs text-muted">{slot.accept.join(" ")}</span>
      </div>
      {slot.description && <p className="mt-0.5 text-xs text-muted">{slot.description}</p>}

      {loaded ? (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 p-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: "var(--ok-bg)", color: "var(--ok-fg)" }}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{loaded.name}</p>
              <p className="text-xs text-muted">
                {loaded.sheets.length} sheet{loaded.sheets.length === 1 ? "" : "s"} loaded
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onFile(undefined)}
            className="shrink-0 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition hover:text-text disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            if (!disabled) onFile(e.dataTransfer.files?.[0]);
          }}
          className={`mt-2 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-8 text-center transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
            over ? "border-accent bg-accent-soft" : "border-border bg-surface-2 hover:border-accent/60"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-accent" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 16V4M7 9l5-5 5 5" />
            <path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
          </svg>
          <span className="text-sm font-medium">
            Drop a file here or <span className="text-accent underline">browse</span>
          </span>
          <span className="text-xs text-muted">Processed locally. Nothing is uploaded.</span>
          <input
            id={id}
            type="file"
            accept={slot.accept.join(",")}
            disabled={disabled}
            className="sr-only"
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      )}
    </div>
  );
}
