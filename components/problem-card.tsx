import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ProblemSummary } from "@/types";

export function ProblemCard({ problem }: { problem: ProblemSummary }) {
  const top = (xs: { label: string }[], n = 3) => xs.slice(0, n).map((x) => x.label).join(", ") || "—";
  return (
    <Link
      href={`/problems/${problem.id}`}
      className="group flex flex-col rounded-xl border bg-background p-5 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="leading-snug font-semibold">{problem.title}</h3>
        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Evidence: <span className="font-medium text-foreground tabular-nums">{problem.evidenceCount}</span> conversations
      </p>
      <dl className="mt-4 grid gap-2 text-sm">
        <div>
          <dt className="text-xs font-medium tracking-wide text-emerald-700 uppercase dark:text-emerald-300">Remember</dt>
          <dd>{problem.rememberedDetails.slice(0, 3).join(", ") || top(problem.topRemembered)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium tracking-wide text-rose-700 uppercase dark:text-rose-300">Forgot</dt>
          <dd>{top(problem.topForgotten, 2)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium tracking-wide text-amber-800 uppercase dark:text-amber-300">Common failure</dt>
          <dd>{top(problem.topFailures, 2)}</dd>
        </div>
      </dl>
    </Link>
  );
}
