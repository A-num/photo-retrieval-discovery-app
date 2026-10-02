import { getDataset } from "@/lib/store";
import { summarizeAllProblems } from "@/lib/insights";
import { ProblemCard } from "@/components/problem-card";
import { AiAnalysisLabel, DatasetBanner, EmptyDataset } from "@/components/labels";

export const dynamic = "force-dynamic";

export default async function ProblemsPage() {
  const ds = await getDataset();
  const problems = summarizeAllProblems(ds);
  const unassigned = Object.values(ds.analyses).filter((a) => a.retrievalRelevant && !a.problemId).length;

  if (ds.conversations.length === 0) {
    return (
      <>
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Retrieval problems</h1>
        <EmptyDataset />
      </>
    );
  }

  return (
    <>
      <DatasetBanner ds={ds} />
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Retrieval problems</h1>
          <AiAnalysisLabel />
        </div>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Retrieval conversations grouped by their underlying problem: the gap between how people remember a photo and what search can use.
          {unassigned > 0 && ` ${unassigned} retrieval conversations didn't fit any cluster.`}
        </p>
      </header>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {problems.map((p) => (
          <ProblemCard key={p.id} problem={p} />
        ))}
      </div>
    </>
  );
}
