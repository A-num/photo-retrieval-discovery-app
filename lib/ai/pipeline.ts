import { z } from "zod";
import type { Conversation, ConversationAnalysis, ProblemCluster } from "@/types";
import {
  ASSET_TYPES,
  FAILURE_TYPES,
  FORGOTTEN_CUES,
  MEMORY_CUES,
  OUTCOMES,
  WORKAROUNDS,
} from "@/types";
import { callStructured, hasClaude } from "./client";
import { heuristicAnalyze } from "./heuristic";
import { SCREEN_SYSTEM, screenUserPrompt } from "@/prompts/screen";
import { extractSystemPrompt, extractUserPrompt } from "@/prompts/extract";

/*
 * Analysis pipeline
 *   Raw conversation
 *     → 1. screen: is it retrieval-related?
 *     → 2–7. extract: what they want / remember / forgot / how they searched / why it failed / workaround
 *     → 8. group: assign to a problem cluster
 *   (9. opportunity areas are synthesized across clusters in ./synthesize.ts)
 */

const ScreenSchema = z.object({
  retrievalRelevant: z.boolean(),
  reason: z.string(),
});

const ExtractSchema = z.object({
  whatUserWants: z.string(),
  assetType: z.enum(ASSET_TYPES),
  remembered: z.array(z.string()),
  rememberedCategories: z.array(z.enum(MEMORY_CUES)),
  forgotten: z.array(z.string()),
  forgottenCategories: z.array(z.enum(FORGOTTEN_CUES)),
  searchAttempt: z.string().nullable(),
  retrievalFailureExplanation: z.string(),
  failureCategories: z.array(z.enum(FAILURE_TYPES)),
  workaround: z.string().nullable(),
  workaroundCategory: z.enum(WORKAROUNDS),
  outcomeCategory: z.enum(OUTCOMES),
  userNeed: z.string(),
  problemId: z.string().nullable(),
  confidence: z.number(),
});

export async function screen(conv: Conversation) {
  return callStructured({
    system: SCREEN_SYSTEM,
    user: screenUserPrompt(conv.text, conv.title),
    schema: ScreenSchema,
    effort: "low",
    maxTokens: 2000,
  });
}

export async function extract(conv: Conversation, problems: ProblemCluster[]) {
  return callStructured({
    system: extractSystemPrompt(problems),
    user: extractUserPrompt(conv.text, { title: conv.title, source: conv.source }),
    schema: ExtractSchema,
    effort: "medium",
    maxTokens: 8000,
  });
}

async function analyzeWithClaude(
  conv: Conversation,
  problems: ProblemCluster[],
): Promise<ConversationAnalysis> {
  const screened = await screen(conv);
  if (!screened.retrievalRelevant) {
    return {
      ...heuristicAnalyze({ ...conv, text: "" }),
      userNeed: `Screened out: ${screened.reason}`,
      confidence: 0.8,
      analyzedBy: "claude",
    };
  }
  const x = await extract(conv, problems);
  const validProblem = problems.some((p) => p.id === x.problemId) ? x.problemId : null;
  const uniq = <T>(xs: T[]) => [...new Set(xs)];
  return {
    conversationId: conv.id,
    retrievalRelevant: true,
    whatUserWants: x.whatUserWants,
    assetType: x.assetType,
    remembered: x.remembered,
    forgotten: x.forgotten,
    searchAttempt: x.searchAttempt ?? undefined,
    retrievalFailure: [x.retrievalFailureExplanation],
    workaround: x.workaround ?? undefined,
    outcome: x.outcomeCategory,
    userNeed: x.userNeed,
    confidence: Math.max(0, Math.min(1, x.confidence)),
    rememberedCategories: uniq(x.rememberedCategories),
    forgottenCategories: uniq(x.forgottenCategories),
    failureCategories: uniq(x.failureCategories),
    workaroundCategory: x.workaroundCategory,
    outcomeCategory: x.outcomeCategory,
    problemId: validProblem,
    analyzedBy: "claude",
  };
}

export interface PipelineResult {
  analyses: ConversationAnalysis[];
  mode: "claude" | "heuristic";
  errors: { id: string; message: string }[];
}

/** Runs every conversation through the pipeline. Claude failures fall back to local analysis per item. */
export async function analyzeConversations(
  convs: Conversation[],
  problems: ProblemCluster[],
  { concurrency = 4 }: { concurrency?: number } = {},
): Promise<PipelineResult> {
  if (!hasClaude()) {
    return { analyses: convs.map(heuristicAnalyze), mode: "heuristic", errors: [] };
  }
  const analyses: ConversationAnalysis[] = new Array(convs.length);
  const errors: PipelineResult["errors"] = [];
  let next = 0;
  async function worker() {
    while (next < convs.length) {
      const i = next++;
      try {
        analyses[i] = await analyzeWithClaude(convs[i], problems);
      } catch (err) {
        errors.push({ id: convs[i].id, message: (err as Error).message });
        analyses[i] = heuristicAnalyze(convs[i]);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, convs.length) }, worker));
  return { analyses, mode: "claude", errors };
}
