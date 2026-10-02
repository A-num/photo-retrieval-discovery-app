"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import type { ConversationRow } from "@/lib/insights";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface Props {
  rows: ConversationRow[];
  problems: { id: string; title: string }[];
  initialProblem?: string;
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 min-w-36 rounded-md border bg-background px-2 text-sm text-foreground"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const OUTCOME_STYLE: Record<string, string> = {
  Found: "text-emerald-700 dark:text-emerald-300",
  "Found with effort": "text-amber-700 dark:text-amber-300",
  "Not found": "text-rose-700 dark:text-rose-300",
};

const uniqSorted = (xs: string[]) => [...new Set(xs)].sort().map((v) => ({ value: v, label: v }));

export function ConversationsTable({ rows, problems, initialProblem = "" }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [source, setSource] = useState("");
  const [asset, setAsset] = useState("");
  const [failure, setFailure] = useState("");
  const [outcome, setOutcome] = useState("");
  const [problem, setProblem] = useState(initialProblem);
  const [scope, setScope] = useState<"relevant" | "all">("relevant");

  const options = useMemo(
    () => ({
      source: uniqSorted(rows.map((r) => r.source)),
      asset: uniqSorted(rows.filter((r) => r.retrievalRelevant).map((r) => r.assetType)),
      failure: uniqSorted(rows.flatMap((r) => r.failures)),
      outcome: uniqSorted(rows.filter((r) => r.retrievalRelevant).map((r) => r.outcome)),
    }),
    [rows],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (scope === "all" || r.retrievalRelevant) &&
        (!source || r.source === source) &&
        (!asset || r.assetType === asset) &&
        (!failure || r.failures.includes(failure)) &&
        (!outcome || r.outcome === outcome) &&
        (!problem || r.problemId === problem) &&
        (!needle ||
          `${r.title ?? ""} ${r.text} ${r.scenario} ${r.memoryPattern.join(" ")}`.toLowerCase().includes(needle)),
    );
  }, [rows, q, source, asset, failure, outcome, problem, scope]);

  const active = [q, source, asset, failure, outcome, problem].some(Boolean);
  const reset = () => {
    setQ("");
    setSource("");
    setAsset("");
    setFailure("");
    setOutcome("");
    setProblem("");
  };

  return (
    <div className="rounded-xl border bg-background">
      <div className="flex flex-wrap items-end gap-3 border-b p-4">
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-xs text-muted-foreground">
          Search
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Text, scenario, memory…" className="h-8 pl-8" />
          </div>
        </label>
        <FilterSelect label="Source" value={source} onChange={setSource} options={options.source} />
        <FilterSelect label="Asset type" value={asset} onChange={setAsset} options={options.asset} />
        <FilterSelect label="Failure type" value={failure} onChange={setFailure} options={options.failure} />
        <FilterSelect label="Outcome" value={outcome} onChange={setOutcome} options={options.outcome} />
        <FilterSelect label="Problem" value={problem} onChange={setProblem} options={problems.map((p) => ({ value: p.id, label: p.title }))} />
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Scope
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as "relevant" | "all")}
            className="h-8 rounded-md border bg-background px-2 text-sm text-foreground"
          >
            <option value="relevant">Retrieval-related</option>
            <option value="all">All conversations</option>
          </select>
        </label>
        {active && (
          <Button variant="ghost" size="sm" onClick={reset}>
            <X /> Clear
          </Button>
        )}
      </div>
      <div className="px-4 py-2 text-xs text-muted-foreground">
        {filtered.length} of {rows.length} conversations{scope === "relevant" ? " (retrieval-related only)" : ""}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Source</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="min-w-64">Retrieval scenario</TableHead>
            <TableHead>Asset type</TableHead>
            <TableHead>Memory pattern</TableHead>
            <TableHead>Failure</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead className="text-right">Confidence</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((r) => (
            <TableRow
              key={r.id}
              className="cursor-pointer align-top"
              onClick={() => router.push(`/conversations/${r.id}`)}
              onKeyDown={(e) => e.key === "Enter" && router.push(`/conversations/${r.id}`)}
              tabIndex={0}
            >
              <TableCell className="text-xs whitespace-nowrap">{r.source}</TableCell>
              <TableCell className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">{r.date ?? "—"}</TableCell>
              <TableCell className="max-w-80 whitespace-normal">
                <div className="text-sm font-medium">{r.scenario}</div>
                <div className="line-clamp-1 text-xs text-muted-foreground">“{r.text}”</div>
              </TableCell>
              <TableCell className="text-xs whitespace-nowrap">{r.retrievalRelevant ? r.assetType : "—"}</TableCell>
              <TableCell className="max-w-48 text-xs whitespace-normal">{r.memoryPattern.join(", ") || "—"}</TableCell>
              <TableCell className="max-w-48 text-xs whitespace-normal">{r.failures.join(", ") || "—"}</TableCell>
              <TableCell className={cn("text-xs whitespace-nowrap", OUTCOME_STYLE[r.outcome])}>
                {r.retrievalRelevant ? r.outcome : "Not retrieval"}
              </TableCell>
              <TableCell className="text-right text-xs tabular-nums">{Math.round(r.confidence * 100)}%</TableCell>
            </TableRow>
          ))}
          {!filtered.length && (
            <TableRow>
              <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                No conversations match these filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
