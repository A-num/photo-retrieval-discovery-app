import Link from "next/link";
import { notFound } from "next/navigation";
import { getDataset } from "@/lib/store";
import { EvidenceCard } from "@/components/evidence-card";
import { AiAnalysisLabel, Chips } from "@/components/labels";

export const dynamic = "force-dynamic";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b py-3 last:border-b-0 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export default async function ConversationDetailPage({ params }: PageProps<"/conversations/[id]">) {
  const { id } = await params;
  const ds = await getDataset();
  const c = ds.conversations.find((x) => x.id === id);
  if (!c) notFound();
  const a = ds.analyses[id];
  const problem = a?.problemId ? ds.problems.find((p) => p.id === a.problemId) : undefined;

  return (
    <>
      <Link href="/conversations" className="text-sm text-muted-foreground hover:text-foreground">
        ← All conversations
      </Link>
      <h1 className="mt-3 mb-5 text-2xl font-semibold tracking-tight">{c.title ?? c.id}</h1>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <EvidenceCard conversation={c} note={c.id} />
        </div>

        <div className="rounded-xl border border-ai-border/60 bg-background p-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <AiAnalysisLabel by={a?.analyzedBy} />
            {a && <span className="text-xs text-muted-foreground tabular-nums">Confidence {Math.round(a.confidence * 100)}%</span>}
          </div>
          {!a ? (
            <p className="text-sm text-muted-foreground">This conversation has not been analyzed.</p>
          ) : !a.retrievalRelevant ? (
            <p className="py-3 text-sm">
              <span className="font-medium">Not retrieval-related.</span>{" "}
              <span className="text-muted-foreground">{a.userNeed}</span>
            </p>
          ) : (
            <dl>
              <Row label="Trying to find">
                {a.whatUserWants} <span className="text-muted-foreground">· {a.assetType}</span>
              </Row>
              <Row label="Remembers">
                <Chips variant="remember" items={a.rememberedCategories} />
                <div className="mt-1.5 text-muted-foreground">{a.remembered.join(" · ")}</div>
              </Row>
              <Row label="Doesn't remember">
                <Chips variant="forget" items={a.forgottenCategories} />
                <div className="mt-1.5 text-muted-foreground">{a.forgotten.join(" · ")}</div>
              </Row>
              <Row label="How they searched">
                {a.searchAttempt ? <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{a.searchAttempt}</code> : <span className="text-muted-foreground">No explicit search</span>}
              </Row>
              <Row label="Why it failed">
                <Chips variant="failure" items={a.failureCategories} />
                {a.analyzedBy === "claude" && <div className="mt-1.5">{a.retrievalFailure.join(" ")}</div>}
              </Row>
              <Row label="What they did instead">{a.workaround ?? "—"}</Row>
              <Row label="Outcome">{a.outcomeCategory}</Row>
              <Row label="Underlying need">{a.userNeed}</Row>
              <Row label="Problem cluster">
                {problem ? (
                  <Link href={`/problems/${problem.id}`} className="underline-offset-2 hover:underline">
                    {problem.title}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">Unassigned</span>
                )}
              </Row>
              {a.opportunityArea && <Row label="Opportunity area">{a.opportunityArea}</Row>}
            </dl>
          )}
        </div>
      </div>
    </>
  );
}
