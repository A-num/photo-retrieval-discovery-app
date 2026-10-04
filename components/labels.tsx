import Link from "next/link";
import { Quote, Database, Check, CircleHelp, TriangleAlert } from "lucide-react";
import type { Dataset } from "@/types";
import { cn } from "@/lib/utils";

/** Marks content that is original user text. */
export function UserEvidenceLabel({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border border-evidence-border bg-evidence px-1.5 py-0.5 text-xs font-semibold tracking-wider text-evidence-foreground uppercase",
        className,
      )}
    >
      <Quote className="size-3" /> User evidence
    </span>
  );
}

/** One-line scope of the dataset an insight page is based on. */
export function DatasetBanner({ ds }: { ds: Dataset }) {
  const total = ds.conversations.length;
  if (total === 0) return null;
  const sources = [...new Set(ds.conversations.map((c) => c.source))];
  const years = ds.conversations
    .map((c) => c.date?.slice(0, 4))
    .filter((y): y is string => !!y)
    .sort();
  const range = years.length ? (years[0] === years[years.length - 1] ? years[0] : `${years[0]}–${years[years.length - 1]}`) : null;
  return (
    <p className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <Database className="size-3.5" />
      <span>
        Based on <span className="font-medium text-foreground tabular-nums">{total.toLocaleString()}</span> analyzed conversations
      </span>
      <span>·</span>
      <span>{sources.join(", ")}</span>
      {range && (
        <>
          <span>·</span>
          <span>{range}</span>
        </>
      )}
    </p>
  );
}

/** Shown on analysis pages before any conversations have been analyzed. */
export function EmptyDataset() {
  return (
    <div className="rounded-xl border border-dashed bg-background p-10 text-center">
      <Database className="mx-auto size-6 text-muted-foreground" />
      <h2 className="mt-3 font-semibold">No analyzed conversations yet</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Import conversations to start discovering retrieval problems.
      </p>
      <Link href="/data" className="mt-4 inline-block text-sm font-medium underline underline-offset-2">
        Go to Data →
      </Link>
    </div>
  );
}

export type ChipVariant = "neutral" | "remember" | "forget" | "failure";

// Color is never the only cue: each variant also has its own icon (and chips sit under a labeled heading).
const CHIP_STYLE: Record<ChipVariant, string> = {
  neutral: "bg-muted text-foreground ring-1 ring-border",
  remember: "bg-remember-bg text-remember-fg ring-1 ring-remember-border",
  forget: "bg-forget-bg text-forget-fg ring-1 ring-forget-border",
  failure: "bg-muted text-foreground ring-1 ring-border",
};
const CHIP_ICON: Record<ChipVariant, typeof Check | null> = {
  neutral: null,
  remember: Check,
  forget: CircleHelp,
  failure: TriangleAlert,
};

export function Chips({
  items,
  variant = "neutral",
  counts,
}: {
  items: { label: string; count?: number }[] | string[];
  variant?: ChipVariant;
  counts?: boolean;
}) {
  const Icon = CHIP_ICON[variant];
  const list = items.map((i) => (typeof i === "string" ? { label: i } : i));
  if (!list.length) return <span className="text-sm text-muted-foreground">None recorded</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((i) => (
        <span key={i.label} className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium", CHIP_STYLE[variant])}>
          {Icon && <Icon className="size-3.5 shrink-0" aria-hidden />}
          {i.label}
          {counts && i.count !== undefined && <span className="font-semibold tabular-nums">· {i.count}</span>}
        </span>
      ))}
    </div>
  );
}

export function SectionTitle({ children, label }: { children: React.ReactNode; label?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <h2 className="text-sm font-semibold">{children}</h2>
      {label}
    </div>
  );
}
