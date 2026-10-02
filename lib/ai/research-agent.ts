import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { AskAnswer, AskTurn, CountItem, Dataset } from "@/types";
import { countBy } from "@/lib/insights";
import { ASK_SYSTEM } from "@/prompts/ask";
import { MODEL } from "./client";
import {
  FiltersSchema,
  GROUP_BY,
  countConversations,
  datasetOverview,
  describeFilters,
  getConversations,
  searchConversations,
} from "./research-tools";

const MAX_ITERATIONS = 10;
const MIN_EVIDENCE = 3;

export const SubmitAnswerSchema = z.object({
  answer: z.string().describe("1–4 sentences, answer first, in your own words"),
  keyNumbers: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .max(4)
    .describe("Up to 4 supporting figures taken from tool results"),
  basedOnConversations: z.number().describe("How many conversations the answer is computed over"),
  citedConversationIds: z.array(z.string()).max(6).describe("Ids from search results that illustrate the answer"),
  confidence: z.enum(["high", "medium", "low"]),
  insufficientEvidence: z.boolean().describe("True if the data can't support an answer"),
  caveat: z.string().optional().describe("One sentence on limits of the data, if relevant"),
});
export type SubmittedAnswer = z.infer<typeof SubmitAnswerSchema>;

/** State the tools record while the agent works, used to verify the final answer. */
export interface AgentTrace {
  steps: string[];
  /** Conversation ids the agent actually saw in tool results; only these may be cited. */
  seenIds: Set<string>;
}

function sourcesFor(ds: Dataset, ids: string[]): CountItem[] {
  const byId = new Map(ds.conversations.map((c) => [c.id, c.source]));
  return countBy(ids.map((id) => byId.get(id) ?? "Unknown"));
}

/** Turns the agent's submission into an AskAnswer, dropping anything it can't back up. */
export function groundAnswer(submitted: SubmittedAnswer, trace: AgentTrace, ds: Dataset): AskAnswer {
  const known = new Set(ds.conversations.map((c) => c.id));
  const cited = [...new Set(submitted.citedConversationIds)];
  const verified = cited.filter((id) => known.has(id) && trace.seenIds.has(id));
  const caveats = [submitted.caveat];
  if (verified.length < cited.length) {
    caveats.push(`${cited.length - verified.length} cited conversation(s) couldn't be verified and were removed.`);
  }
  const sufficient = !submitted.insufficientEvidence && submitted.basedOnConversations >= MIN_EVIDENCE;
  return {
    mode: "claude",
    sufficientEvidence: sufficient,
    answer: submitted.answer.trim(),
    keyNumbers: submitted.keyNumbers.slice(0, 4),
    confidence: sufficient ? submitted.confidence : "low",
    basedOn: Math.max(0, Math.round(submitted.basedOnConversations)),
    evidenceIds: verified,
    sources: sourcesFor(ds, verified),
    steps: trace.steps,
    caveats: caveats.filter(Boolean).join(" ") || undefined,
  };
}

export function buildTools(ds: Dataset, trace: AgentTrace) {
  const json = (v: unknown) => JSON.stringify(v);

  return [
    betaZodTool({
      name: "dataset_overview",
      description:
        "Size and makeup of the dataset: totals, sources, date range, how conversations were analyzed, and the problem clusters (with ids) and their sizes. Call this first if you haven't.",
      inputSchema: z.object({}),
      run: async () => {
        const o = datasetOverview(ds);
        trace.steps.push(`Reviewed the dataset (${o.totalConversations} conversations, ${o.retrievalRelated} about retrieval)`);
        return json(o);
      },
    }),
    betaZodTool({
      name: "count_conversations",
      description:
        "Count matching conversations grouped by a field, e.g. what users remembered, what they forgot, failure types, workarounds, outcomes, asset type, problem cluster, source, rating or year. Returns counts and percentages of the matching set. Use filters to segment (e.g. only screenshots, only 1–2 star reviews).",
      inputSchema: z.object({
        groupBy: z.enum(GROUP_BY),
        filters: FiltersSchema.optional(),
      }),
      run: async ({ groupBy, filters }) => {
        const r = countConversations(ds, groupBy, filters);
        trace.steps.push(`Counted ${groupBy} across ${r.matchingConversations} conversations (${describeFilters(filters)})`);
        return json(r);
      },
    }),
    betaZodTool({
      name: "search_conversations",
      description:
        "Find conversations matching filters, ranked by how many query words they contain. Returns excerpts plus their analysis. Use it to understand what is behind a pattern and to pick examples to cite.",
      inputSchema: z.object({
        query: z.string().optional().describe("Words to rank by, e.g. 'date search zero results'"),
        filters: FiltersSchema.optional(),
        limit: z.number().int().min(1).max(15).optional(),
      }),
      run: async ({ query, filters, limit }) => {
        const r = searchConversations(ds, query, filters, limit ?? 8);
        r.results.forEach((x) => trace.seenIds.add(x.id));
        trace.steps.push(
          `Read ${r.results.length} of ${r.matchingConversations} matching conversations${query ? ` for "${query}"` : ""} (${describeFilters(filters)})`,
        );
        return json(r);
      },
    }),
    betaZodTool({
      name: "get_conversations",
      description: "Full text and analysis for specific conversation ids (max 10).",
      inputSchema: z.object({ ids: z.array(z.string()).min(1).max(10) }),
      run: async ({ ids }) => {
        const r = getConversations(ds, ids);
        r.forEach((x) => !("error" in x) && trace.seenIds.add(x.id));
        trace.steps.push(`Read ${r.length} conversation(s) in full`);
        return json(r);
      },
    }),
    betaZodTool({
      name: "submit_answer",
      description: "Submit the final answer. Call exactly once, after your analysis.",
      inputSchema: SubmitAnswerSchema,
      run: async () => "Answer recorded.",
    }),
  ];
}

let client: Anthropic | null = null;

export async function askAgent(question: string, ds: Dataset, history: AskTurn[] = []): Promise<AskAnswer> {
  client ??= new Anthropic();
  const trace: AgentTrace = { steps: [], seenIds: new Set() };

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...history.flatMap((t): Anthropic.Beta.BetaMessageParam[] => [
      { role: "user", content: t.question },
      { role: "assistant", content: t.answer },
    ]),
    { role: "user", content: question },
  ];

  const runner = client.beta.messages.toolRunner({
    model: MODEL,
    max_tokens: 16000,
    max_iterations: MAX_ITERATIONS,
    // Re-run declined requests on Anthropic's recommended fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system: [{ type: "text", text: ASK_SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: buildTools(ds, trace),
    messages,
  });

  let lastText = "";
  for await (const message of runner) {
    if (message.stop_reason === "refusal") throw new Error("Claude declined to answer this question");
    lastText = message.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    const submit = message.content.find(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === "submit_answer",
    );
    if (submit) {
      const parsed = SubmitAnswerSchema.safeParse(submit.input);
      if (!parsed.success) throw new Error("Claude returned a malformed answer");
      return groundAnswer(parsed.data, trace, ds);
    }
  }
  // The model answered in prose instead of submitting: show it, but without unverifiable numbers or citations.
  if (lastText) {
    return groundAnswer(
      { answer: lastText, keyNumbers: [], basedOnConversations: 0, citedConversationIds: [], confidence: "low", insufficientEvidence: true, caveat: "This answer wasn't submitted in the structured format, so its numbers couldn't be checked." },
      trace,
      ds,
    );
  }
  throw new Error(`No answer after ${MAX_ITERATIONS} analysis steps`);
}
