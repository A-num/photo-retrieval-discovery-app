"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUp, ChevronRight, Loader2, RotateCcw, Star } from "lucide-react";
import type { AskAnswer, AskTurn, EvidenceSnippet } from "@/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  "What do users remember when they can't find a photo?",
  "Why does search fail for screenshots and documents?",
  "What do people do when search doesn't work?",
  "Which retrieval problems come up most in 1–2 star reviews?",
];

type Result = AskAnswer & { evidence: EvidenceSnippet[] };
interface Turn {
  question: string;
  result?: Result;
  error?: string;
}

const CONFIDENCE_STYLE: Record<AskAnswer["confidence"], string> = {
  high: "bg-remember-bg text-remember-fg ring-remember-border",
  medium: "bg-muted text-foreground ring-border",
  low: "bg-forget-bg text-forget-fg ring-forget-border",
};

function Disclosure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
        {label}
      </summary>
      <div className="mt-2 pl-4.5">{children}</div>
    </details>
  );
}

function AnswerCard({ result }: { result: Result }) {
  return (
    <div className="rounded-xl border border-ai-border/60 bg-background p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {result.sufficientEvidence ? (
          <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-medium ring-1", CONFIDENCE_STYLE[result.confidence])}>
            {result.confidence} confidence
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-forget-fg">
            <AlertTriangle className="size-3.5" /> Not enough evidence
          </span>
        )}
      </div>

      <p className="text-[15px] leading-relaxed">{result.answer}</p>

      {result.keyNumbers.length > 0 && (
        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {result.keyNumbers.map((k) => (
            <div key={k.label} className="rounded-lg bg-muted/60 px-3 py-2">
              <dd className="text-lg font-semibold tabular-nums">{k.value}</dd>
              <dt className="text-xs leading-snug text-muted-foreground">{k.label}</dt>
            </div>
          ))}
        </dl>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        {result.basedOn > 0 && <>Based on {result.basedOn} conversations</>}
        {result.basedOn > 0 && result.sources.length > 0 && " · "}
        {result.sources.length > 0 && <>examples from {result.sources.map((s) => s.label).join(", ")}</>}
      </p>
      {result.caveats && <p className="mt-1 text-xs text-muted-foreground italic">{result.caveats}</p>}

      {(result.evidence.length > 0 || result.steps.length > 0) && (
        <div className="mt-4 space-y-2 border-t pt-3">
          {result.evidence.length > 0 && (
            <Disclosure label={`Sources (${result.evidence.length})`}>
              <ul className="space-y-2">
                {result.evidence.map((e) => (
                  <li key={e.id} className="text-xs">
                    <Link href={`/conversations/${e.id}`} className="group/link block rounded-md p-1.5 hover:bg-muted">
                      <span className="text-muted-foreground">
                        {e.source}
                        {e.date && ` · ${e.date}`}
                        {e.rating !== undefined && (
                          <>
                            {" · "}
                            {e.rating}
                            <Star className="mb-0.5 inline size-3" />
                          </>
                        )}
                      </span>
                      {e.title && <span className="ml-1.5 font-medium">{e.title}</span>}
                      <span className="mt-0.5 line-clamp-2 block text-muted-foreground">“{e.excerpt}”</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Disclosure>
          )}
          {result.steps.length > 0 && (
            <Disclosure label="How this was answered">
              <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
                {result.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </Disclosure>
          )}
        </div>
      )}
    </div>
  );
}

export function AskPanel({ conversationCount }: { conversationCount: number }) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, loading]);

  async function submit(q: string) {
    const text = q.trim();
    if (!text || loading) return;
    const history: AskTurn[] = turns
      .filter((t) => t.result)
      .map((t) => ({ question: t.question, answer: t.result!.answer }));
    setTurns((prev) => [...prev, { question: text }]);
    setQuestion("");
    setLoading(true);
    let update: Partial<Turn>;
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, history }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Request failed");
      update = { result: body as Result };
    } catch (err) {
      update = { error: (err as Error).message };
    }
    setTurns((prev) => prev.map((t, i) => (i === prev.length - 1 ? { ...t, ...update } : t)));
    setLoading(false);
  }

  return (
    <div className="space-y-5">
      {turns.length === 0 && (
        <div className="rounded-xl border border-dashed bg-background p-5">
          <p className="text-sm text-muted-foreground">Try a question:</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
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
        </div>
      )}

      {turns.map((t, i) => (
        <div key={i} className="space-y-3">
          <div className="flex justify-end">
            <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-foreground px-4 py-2 text-sm text-background">{t.question}</p>
          </div>
          {t.result && <AnswerCard result={t.result} />}
          {t.error && <p className="text-sm text-destructive">Couldn&apos;t answer: {t.error}</p>}
          {!t.result && !t.error && loading && i === turns.length - 1 && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Analyzing {conversationCount} conversations…
            </p>
          )}
        </div>
      ))}
      <div ref={endRef} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(question);
        }}
        className="sticky bottom-4 rounded-xl border bg-background p-2 shadow-sm"
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
          placeholder={turns.length ? "Ask a follow-up…" : "Ask a question about Google Photos retrieval…"}
          className="min-h-12 resize-none border-0 shadow-none focus-visible:ring-0"
        />
        <div className="flex items-center justify-between gap-2 px-1 pt-1">
          {turns.length > 0 ? (
            <Button type="button" variant="ghost" size="sm" disabled={loading} onClick={() => setTurns([])}>
              <RotateCcw /> New conversation
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" size="sm" disabled={loading || !question.trim()}>
            {loading ? <Loader2 className="animate-spin" /> : <ArrowUp />} Ask
          </Button>
        </div>
      </form>
    </div>
  );
}
