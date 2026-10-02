import type {
  Conversation,
  ConversationAnalysis,
  CountItem,
  Dataset,
  ProblemSummary,
} from "@/types";
import { FAILURE_TYPES, MEMORY_CUES } from "@/types";

/** Minimum evidence for a problem cluster to count as an opportunity area. */
export const MIN_EVIDENCE_FOR_OPPORTUNITY = 3;

export function countBy(values: string[], order?: readonly string[]): CountItem[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  if (order) {
    for (const o of order) if (!counts.has(o)) counts.set(o, 0);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function relevantAnalyses(ds: Dataset): ConversationAnalysis[] {
  return ds.conversations
    .map((c) => ds.analyses[c.id])
    .filter((a): a is ConversationAnalysis => !!a && a.retrievalRelevant);
}

export function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

export function summarizeProblem(ds: Dataset, problemId: string): ProblemSummary | null {
  const problem = ds.problems.find((p) => p.id === problemId);
  if (!problem) return null;
  const members = relevantAnalyses(ds)
    .filter((a) => a.problemId === problemId)
    .sort((a, b) => b.confidence - a.confidence);
  const convById = new Map(ds.conversations.map((c) => [c.id, c]));

  return {
    ...problem,
    evidenceCount: members.length,
    topRemembered: countBy(members.flatMap((a) => a.rememberedCategories)),
    topForgotten: countBy(members.flatMap((a) => a.forgottenCategories)),
    topFailures: countBy(members.flatMap((a) => a.failureCategories)),
    topWorkarounds: countBy(
      members.map((a) => a.workaroundCategory).filter((w) => w !== "None"),
    ),
    outcomes: countBy(members.map((a) => a.outcomeCategory)),
    exampleSearches: unique(
      members.map((a) => a.searchAttempt).filter((s): s is string => !!s),
    ).slice(0, 8),
    rememberedDetails: unique(members.flatMap((a) => a.remembered)).slice(0, 14),
    forgottenDetails: unique(members.flatMap((a) => a.forgotten)).slice(0, 12),
    evidenceIds: members.map((a) => a.conversationId),
    sources: countBy(
      members.map((a) => convById.get(a.conversationId)?.source ?? "Unknown"),
    ),
  };
}

export function summarizeAllProblems(ds: Dataset): ProblemSummary[] {
  return ds.problems
    .map((p) => summarizeProblem(ds, p.id))
    .filter((p): p is ProblemSummary => !!p)
    .sort((a, b) => b.evidenceCount - a.evidenceCount);
}

export interface DashboardStats {
  totalConversations: number;
  relevantConversations: number;
  problemClusters: number;
  opportunityAreas: number;
  remembered: CountItem[];
  forgotten: CountItem[];
  failures: CountItem[];
  workarounds: CountItem[];
  outcomes: CountItem[];
  sources: CountItem[];
}

export function dashboardStats(ds: Dataset): DashboardStats {
  const relevant = relevantAnalyses(ds);
  const problems = summarizeAllProblems(ds).filter((p) => p.evidenceCount > 0);
  return {
    totalConversations: ds.conversations.length,
    relevantConversations: relevant.length,
    problemClusters: problems.length,
    opportunityAreas: problems.filter(
      (p) => p.evidenceCount >= MIN_EVIDENCE_FOR_OPPORTUNITY,
    ).length,
    remembered: countBy(relevant.flatMap((a) => a.rememberedCategories), MEMORY_CUES),
    forgotten: countBy(relevant.flatMap((a) => a.forgottenCategories)),
    failures: countBy(relevant.flatMap((a) => a.failureCategories), FAILURE_TYPES),
    workarounds: countBy(
      relevant.map((a) => a.workaroundCategory).filter((w) => w !== "None"),
    ),
    outcomes: countBy(relevant.map((a) => a.outcomeCategory)),
    sources: countBy(ds.conversations.map((c) => c.source)),
  };
}

/** Flattened row for the Conversations table (serializable for client components). */
export interface ConversationRow {
  id: string;
  source: string;
  date?: string;
  title?: string;
  text: string;
  retrievalRelevant: boolean;
  scenario: string;
  assetType: string;
  memoryPattern: string[];
  forgotten: string[];
  failures: string[];
  workaround: string;
  outcome: string;
  confidence: number;
  problemId: string | null;
  problemTitle: string | null;
  analyzedBy: string;
}

export function conversationRows(ds: Dataset): ConversationRow[] {
  const titles = new Map(ds.problems.map((p) => [p.id, p.title]));
  return ds.conversations.map((c: Conversation) => {
    const a = ds.analyses[c.id];
    return {
      id: c.id,
      source: c.source,
      date: c.date,
      title: c.title,
      text: c.text,
      retrievalRelevant: a?.retrievalRelevant ?? false,
      scenario: a?.whatUserWants ?? "Not analyzed",
      assetType: a?.assetType ?? "Other",
      memoryPattern: a?.rememberedCategories ?? [],
      forgotten: a?.forgottenCategories ?? [],
      failures: a?.failureCategories ?? [],
      workaround: a?.workaroundCategory ?? "None",
      outcome: a?.outcomeCategory ?? "Unknown",
      confidence: a?.confidence ?? 0,
      problemId: a?.problemId ?? null,
      problemTitle: a?.problemId ? (titles.get(a.problemId) ?? null) : null,
      analyzedBy: a?.analyzedBy ?? "none",
    };
  });
}
