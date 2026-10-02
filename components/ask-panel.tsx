"use client";

import { useState } from "react";
import { ArrowUp, AlertTriangle, Loader2 } from "lucide-react";
import type { AskAnswer, Conversation } from "@/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EvidenceCard } from "@/components/evidence-card";
import { AiAnalysisLabel, SectionTitle, UserEvidenceLabel } from "@/components/labels";

const EXAMPLES = [
  "What do users remember most often when they can't find a photo?",
  "Show me examples where users remember a trip but not the date.",
  "What are the biggest retrieval problems involving screenshots?",
  "What workarounds do users use?",
];

type Result = AskAnswer & { evidence: Conversation[]; question: string };

export function AskPanel() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function submit(q: string) {
    const text = q.trim();
    if (!text || loading) return;
    setQuestion(text);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Request failed");
      setResult({ ...body, question: text });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(question);
        }}
        className="rounded-xl border bg-background p-3"
      >
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(question);
            }
          }}
          placeholder="Ask a question about the research data…"
          className="min-h-20 resize-none border-0 shadow-none focus-visible:ring-0"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => submit(ex)}
                className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {ex}
              </button>
            ))}
          </div>
          <Button type="submit" size="sm" disabled={loading || !question.trim()}>
            {loading ? <Loader2 className="animate-spin" /> : <ArrowUp />} Ask
          </Button>
        </div>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && !loading && (
        <div className="space-y-5">
          <section className="rounded-xl border border-ai-border/60 bg-background p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <AiAnalysisLabel by={result.mode === "local" ? "local" : "claude"} />
              <span className="text-xs text-muted-foreground">“{result.question}”</span>
            </div>
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Finding</h2>
            {!result.sufficientEvidence && (
              <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-300">
                <AlertTriangle className="size-4" /> Insufficient evidence
              </p>
            )}
            <p className="mt-1 text-base leading-relaxed">{result.finding}</p>
            {result.keyPoints.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                {result.keyPoints.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ul>
            )}
            <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2">
              <div>
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Evidence</h3>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {result.evidenceCount} <span className="text-sm font-normal text-muted-foreground">conversations</span>
                </p>
              </div>
              <div>
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Sources</h3>
                <ul className="mt-1 text-sm">
                  {result.sources.map((s) => (
                    <li key={s.label} className="flex justify-between gap-2">
                      <span>{s.label}</span>
                      <span className="text-muted-foreground tabular-nums">{s.count}</span>
                    </li>
                  ))}
                  {!result.sources.length && <li className="text-muted-foreground">None</li>}
                </ul>
              </div>
            </div>
            {result.caveats && <p className="mt-4 text-xs text-muted-foreground">{result.caveats}</p>}
          </section>

          {result.evidence.length > 0 && (
            <section>
              <SectionTitle label={<UserEvidenceLabel />}>
                Supporting conversations
                {result.evidenceCount > result.evidence.length && ` (showing ${result.evidence.length} of ${result.evidenceCount})`}
              </SectionTitle>
              <div className="grid gap-3">
                {result.evidence.map((c) => (
                  <EvidenceCard key={c.id} conversation={c} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
