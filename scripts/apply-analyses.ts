/**
 * Merges hand-produced analyses (e.g. done by Claude in a Claude Code session) into the local store.
 * Every entry is validated against the app's taxonomy before anything is written.
 *
 *   npm run apply-analyses -- path/to/analyses.json
 *
 * The file is a JSON array. Not about retrieval:  { "id": "...", "relevant": false, "reason": "..." }
 * About retrieval: see RelevantSchema below.
 */
import { readFileSync } from "node:fs";
import { z } from "zod";
import { ASSET_TYPES, FAILURE_TYPES, FORGOTTEN_CUES, MEMORY_CUES, OUTCOMES, WORKAROUNDS } from "@/types";
import type { ConversationAnalysis } from "@/types";
import { PROBLEM_HYPOTHESES } from "@/data/problem-clusters";
import { updateAnalyses } from "@/lib/store";

const problemIds = PROBLEM_HYPOTHESES.map((p) => p.id) as [string, ...string[]];

const NotRelevantSchema = z.object({ id: z.string(), relevant: z.literal(false), reason: z.string() }).strict();
const RelevantSchema = z
  .object({
    id: z.string(),
    relevant: z.literal(true),
    want: z.string(),
    asset: z.enum(ASSET_TYPES),
    remembered: z.array(z.string()),
    rememberedCategories: z.array(z.enum(MEMORY_CUES)),
    forgotten: z.array(z.string()),
    forgottenCategories: z.array(z.enum(FORGOTTEN_CUES)),
    search: z.string().optional(),
    why: z.string(),
    failureCategories: z.array(z.enum(FAILURE_TYPES)).min(1),
    workaround: z.string().optional(),
    workaroundCategory: z.enum(WORKAROUNDS),
    outcome: z.enum(OUTCOMES),
    need: z.string(),
    problem: z.enum(problemIds).nullable(),
    confidence: z.number().min(0).max(1),
  })
  .strict();
const EntrySchema = z.union([NotRelevantSchema, RelevantSchema]);

function toAnalysis(e: z.infer<typeof EntrySchema>): ConversationAnalysis {
  const base = { conversationId: e.id, analyzedBy: "claude" as const };
  if (!e.relevant) {
    return {
      ...base,
      retrievalRelevant: false,
      whatUserWants: "Not a retrieval problem",
      assetType: "Other",
      remembered: [],
      forgotten: [],
      retrievalFailure: [],
      outcome: "Not applicable",
      userNeed: `Screened out: ${e.reason}`,
      confidence: 0.85,
      rememberedCategories: [],
      forgottenCategories: [],
      failureCategories: [],
      workaroundCategory: "None",
      outcomeCategory: "Unknown",
      problemId: null,
    };
  }
  return {
    ...base,
    retrievalRelevant: true,
    whatUserWants: e.want,
    assetType: e.asset,
    remembered: e.remembered,
    forgotten: e.forgotten,
    searchAttempt: e.search,
    retrievalFailure: [e.why],
    workaround: e.workaround,
    outcome: e.outcome,
    userNeed: e.need,
    confidence: e.confidence,
    rememberedCategories: [...new Set(e.rememberedCategories)],
    forgottenCategories: [...new Set(e.forgottenCategories)],
    failureCategories: [...new Set(e.failureCategories)],
    workaroundCategory: e.workaroundCategory,
    outcomeCategory: e.outcome,
    problemId: e.problem,
  };
}

async function main() {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error("Usage: npm run apply-analyses -- <analyses.json> [more.json]");
    process.exit(1);
  }
  const entries = files.flatMap((f) => JSON.parse(readFileSync(f, "utf8")) as unknown[]);
  const errors: string[] = [];
  const analyses = entries.flatMap((raw, i) => {
    const r = EntrySchema.safeParse(raw);
    if (r.success) return [toAnalysis(r.data)];
    errors.push(`#${i} ${(raw as { id?: string })?.id ?? "?"}: ${r.error.issues.map((x) => `${x.path.join(".")} ${x.message}`).join("; ")}`);
    return [];
  });
  if (errors.length) {
    console.error(`${errors.length} invalid entries, nothing written:\n  ${errors.join("\n  ")}`);
    process.exit(1);
  }
  await updateAnalyses(analyses);
  const relevant = analyses.filter((a) => a.retrievalRelevant).length;
  console.log(`Applied ${analyses.length} analyses (${relevant} about retrieval, ${analyses.length - relevant} screened out).`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
