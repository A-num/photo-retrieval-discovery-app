import { z } from "zod";
import type { Dataset, ProblemCluster } from "@/types";
import { summarizeAllProblems } from "@/lib/insights";
import { callStructured } from "./client";
import { SYNTHESIZE_SYSTEM } from "@/prompts/synthesize";

const SynthSchema = z.object({
  problems: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      surfaceComplaint: z.string(),
      underlyingProblem: z.string(),
      whyFails: z.string(),
      opportunity: z.object({
        title: z.string(),
        description: z.string(),
        ideas: z.array(z.string()),
      }),
    }),
  ),
});

/** Regenerates problem statements and opportunity areas from the current evidence. */
export async function synthesizeProblems(ds: Dataset): Promise<ProblemCluster[]> {
  const summaries = summarizeAllProblems(ds).filter((p) => p.evidenceCount > 0);
  const convText = new Map(ds.conversations.map((c) => [c.id, c.text]));
  const payload = summaries.map((p) => ({
    id: p.id,
    currentTitle: p.title,
    currentUnderlyingProblem: p.underlyingProblem,
    evidenceCount: p.evidenceCount,
    remembered: p.topRemembered,
    forgotten: p.topForgotten,
    failures: p.topFailures,
    workarounds: p.topWorkarounds,
    outcomes: p.outcomes,
    exampleSearches: p.exampleSearches,
    sampleQuotes: p.evidenceIds.slice(0, 5).map((id) => convText.get(id)),
  }));

  const out = await callStructured({
    system: SYNTHESIZE_SYSTEM,
    user: `<clusters>\n${JSON.stringify(payload, null, 2)}\n</clusters>`,
    schema: SynthSchema,
    effort: "high",
    maxTokens: 32000,
  });

  const byId = new Map(out.problems.map((p) => [p.id, p]));
  // Keep every existing cluster (including empty ones) and only replace those Claude rewrote.
  return ds.problems.map((existing) => {
    const next = byId.get(existing.id);
    return next ? { ...next, id: existing.id, generatedBy: "claude" as const } : existing;
  });
}
