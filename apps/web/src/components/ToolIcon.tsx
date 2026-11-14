const PATHS: Record<string, React.ReactNode> = {
  // drill rig / borehole
  drill: (
    <>
      <path d="M12 2v14" />
      <path d="M8 6h8M8 10h8" />
      <path d="M12 16l-3 6M12 16l3 6" />
      <path d="M5 22h14" />
    </>
  ),
  // water / culvert
  waves: (
    <>
      <path d="M2 8c2.5-3 5-3 7.5 0s5 3 7.5 0 3-2 5-1" />
      <path d="M2 14c2.5-3 5-3 7.5 0s5 3 7.5 0 3-2 5-1" />
      <path d="M2 20c2.5-3 5-3 7.5 0s5 3 7.5 0 3-2 5-1" />
    </>
  ),
  default: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M9 12h6M12 9v6" />
    </>
  ),
};

export default function ToolIcon({ name, className = "h-6 w-6" }: { name: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[name] ?? PATHS.default}
    </svg>
  );
}
