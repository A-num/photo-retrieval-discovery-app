import Link from "next/link";
import { getDataset, isReadOnly } from "@/lib/store";
import { dashboardStats, summarizeAllProblems, MIN_EVIDENCE_FOR_OPPORTUNITY } from "@/lib/insights";
import { hasClaude } from "@/lib/ai/client";
import { BarListChart } from "@/components/charts/bar-list-chart";
import { ProblemCard } from "@/components/problem-card";
import { AiAnalysisLabel, DatasetBanner, EmptyDataset, SectionTitle } from "@/components/labels";
import { RegenerateInsights } from "@/components/regenerate-insights";

export const dynamic = "force-dynamic";

function Metric({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export default async function DashboardPage() {
  const ds = await getDataset();
  const stats = dashboardStats(ds);
  const problems = summarizeAllProblems(ds).filter((p) => p.evidenceCount > 0);
  const opportunities = problems.filter((p) => p.evidenceCount >= MIN_EVIDENCE_FOR_OPPORTUNITY);
  const generatedBy = ds.problems.some((p) => p.generatedBy === "claude") ? "claude" : "hypothesis";

  if (ds.conversations.length === 0) {
    return (
      <>
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">What are users struggling with?</h1>
        <EmptyDataset />
      </>
    );
  }

  return (
    <>
      <DatasetBanner ds={ds} />

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">What are users struggling with?</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          What users remember → what they don&apos;t → how they search → why retrieval fails → where the opportunity is.
        </p>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Conversations analyzed" value={stats.totalConversations} />
        <Metric
          label="Retrieval-related"
          value={stats.relevantConversations}
          hint={`${Math.round((stats.relevantConversations / Math.max(1, stats.totalConversations)) * 100)}% of analyzed`}
        />
        <Metric label="Problem clusters" value={stats.problemClusters} />
        <Metric label="Opportunity areas" value={stats.opportunityAreas} hint={`≥ ${MIN_EVIDENCE_FOR_OPPORTUNITY} conversations of evidence`} />
      </section>

      <section className="mb-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-background p-5">
          <SectionTitle label={<AiAnalysisLabel />}>A. What users remember</SectionTitle>
          <p className="-mt-1 mb-3 text-xs text-muted-foreground">
            Memory cues mentioned in {stats.relevantConversations} retrieval conversations (one conversation can mention several).
          </p>
          <BarListChart data={stats.remembered} total={stats.relevantConversations} />
        </div>
        <div className="rounded-xl border bg-background p-5">
          <SectionTitle label={<AiAnalysisLabel />}>B. Where retrieval breaks</SectionTitle>
          <p className="-mt-1 mb-3 text-xs text-muted-foreground">
            Underlying failure types, not the surface complaint “search can&apos;t find it”.
          </p>
          <BarListChart data={stats.failures} total={stats.relevantConversations} />
        </div>
      </section>

      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle label={<AiAnalysisLabel by={generatedBy} />}>C. Top problems</SectionTitle>
          <Link href="/problems" className="text-sm text-muted-foreground hover:text-foreground">
            All problems →
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {problems.slice(0, 6).map((p) => (
            <ProblemCard key={p.id} problem={p} />
          ))}
        </div>
      </section>

      <section className="mb-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-background p-5">
          <SectionTitle label={<AiAnalysisLabel />}>What users don&apos;t remember</SectionTitle>
          <BarListChart data={stats.forgotten} total={stats.relevantConversations} />
        </div>
        <div className="rounded-xl border bg-background p-5">
          <SectionTitle label={<AiAnalysisLabel />}>What they do instead</SectionTitle>
          <BarListChart data={stats.workarounds} total={stats.relevantConversations} />
        </div>
      </section>

      <section className="mb-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle label={<AiAnalysisLabel by={generatedBy} />}>Opportunity areas</SectionTitle>
          <RegenerateInsights enabled={hasClaude() && !isReadOnly()} regenerated={generatedBy === "claude"} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {opportunities.map((p) => (
            <Link key={p.id} href={`/problems/${p.id}`} className="rounded-xl border border-ai-border/60 bg-background p-5 hover:shadow-md">
              <div className="text-xs text-muted-foreground">
                From: {p.title} · {p.evidenceCount} conversations
              </div>
              <h3 className="mt-1 font-semibold">{p.opportunity.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.opportunity.description}</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                {p.opportunity.ideas.map((idea) => (
                  <li key={idea}>{idea}</li>
                ))}
              </ul>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
