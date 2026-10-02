import Link from "next/link";
import { notFound } from "next/navigation";
import { getDataset } from "@/lib/store";
import { summarizeProblem } from "@/lib/insights";
import { EvidenceCard } from "@/components/evidence-card";
import { AiAnalysisLabel, Chips, SectionTitle, UserEvidenceLabel } from "@/components/labels";

export const dynamic = "force-dynamic";

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border bg-background p-5 ${className}`}>{children}</div>;
}

export default async function ProblemDetailPage({ params }: PageProps<"/problems/[id]">) {
  const { id } = await params;
  const ds = await getDataset();
  const p = summarizeProblem(ds, id);
  if (!p) notFound();

  const convById = new Map(ds.conversations.map((c) => [c.id, c]));
  const evidence = p.evidenceIds.slice(0, 5).map((cid) => convById.get(cid)!).filter(Boolean);
  const pct = (n: number) => (p.evidenceCount ? Math.round((n / p.evidenceCount) * 100) : 0);

  return (
    <>
      <Link href="/problems" className="text-sm text-muted-foreground hover:text-foreground">
        ← All problems
      </Link>

      <header className="mt-3 mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <AiAnalysisLabel by={p.generatedBy} />
          <span className="text-sm text-muted-foreground">
            Evidence: <span className="font-medium text-foreground tabular-nums">{p.evidenceCount}</span> conversations
            {p.sources.length > 0 && ` · ${p.sources.map((s) => `${s.label} ${s.count}`).join(" · ")}`}
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{p.title}</h1>
      </header>

      <section className="mb-4 grid gap-4 lg:grid-cols-2">
        <Panel>
          <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Surface complaint</div>
          <p className="mt-1 text-sm italic">{p.surfaceComplaint}</p>
          <div className="mt-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">Underlying retrieval problem</div>
          <p className="mt-1 text-sm leading-relaxed">{p.underlyingProblem}</p>
        </Panel>
        <Panel>
          <SectionTitle>Why retrieval fails</SectionTitle>
          <p className="text-sm leading-relaxed">{p.whyFails}</p>
          <div className="mt-3">
            <Chips variant="failure" counts items={p.topFailures} />
          </div>
        </Panel>
      </section>

      <section className="mb-4 grid gap-4 lg:grid-cols-2">
        <Panel>
          <SectionTitle>What users remember</SectionTitle>
          <Chips variant="remember" counts items={p.topRemembered} />
          <div className="mt-3 text-xs text-muted-foreground">Specific details mentioned</div>
          <div className="mt-1.5">
            <Chips items={p.rememberedDetails} />
          </div>
        </Panel>
        <Panel>
          <SectionTitle>What users forget</SectionTitle>
          <Chips variant="forget" counts items={p.topForgotten} />
          <div className="mt-3 text-xs text-muted-foreground">Specific gaps mentioned</div>
          <div className="mt-1.5">
            <Chips items={p.forgottenDetails} />
          </div>
        </Panel>
      </section>

      <section className="mb-4 grid gap-4 lg:grid-cols-2">
        <Panel>
          <SectionTitle label={<UserEvidenceLabel />}>Search behavior</SectionTitle>
          {p.exampleSearches.length ? (
            <ul className="space-y-1.5">
              {p.exampleSearches.map((s) => (
                <li key={s} className="rounded-md bg-muted px-3 py-1.5 font-mono text-xs">
                  {s}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No explicit searches quoted.</p>
          )}
        </Panel>
        <Panel>
          <SectionTitle>Workarounds</SectionTitle>
          <ul className="space-y-1.5 text-sm">
            {p.topWorkarounds.map((w) => (
              <li key={w.label} className="flex justify-between gap-2">
                <span>{w.label}</span>
                <span className="text-muted-foreground tabular-nums">
                  {w.count} · {pct(w.count)}%
                </span>
              </li>
            ))}
            {!p.topWorkarounds.length && <li className="text-muted-foreground">No workarounds described.</li>}
          </ul>
          <div className="mt-3 border-t pt-3 text-xs text-muted-foreground">
            Outcomes: {p.outcomes.map((o) => `${o.label} ${o.count}`).join(" · ")}
          </div>
        </Panel>
      </section>

      <section className="mb-8">
        <Panel className="border-ai-border/60">
          <SectionTitle>Opportunity area: {p.opportunity.title}</SectionTitle>
          <p className="text-sm text-muted-foreground">{p.opportunity.description}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {p.opportunity.ideas.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </Panel>
      </section>

      <section>
        <SectionTitle label={<UserEvidenceLabel />}>
          Evidence ({evidence.length} of {p.evidenceCount}, highest confidence first)
        </SectionTitle>
        <div className="grid gap-3">
          {evidence.map((c) => (
            <EvidenceCard key={c.id} conversation={c} />
          ))}
        </div>
        {p.evidenceCount > evidence.length && (
          <Link href={`/conversations?problem=${p.id}`} className="mt-3 inline-block text-sm text-muted-foreground hover:text-foreground">
            See all {p.evidenceCount} conversations →
          </Link>
        )}
      </section>
    </>
  );
}
