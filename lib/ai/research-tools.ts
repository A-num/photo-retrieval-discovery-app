import { z } from "zod";
import type { ConversationAnalysis, Conversation, Dataset } from "@/types";
import { ASSET_TYPES, FAILURE_TYPES, FORGOTTEN_CUES, MEMORY_CUES, OUTCOMES, WORKAROUNDS } from "@/types";
import { countBy } from "@/lib/insights";

// Deterministic queries over the analyzed dataset. The Ask AI agent calls these as tools,
// so every number in an answer is computed here rather than estimated by the model.

export const FiltersSchema = z
  .object({
    assetType: z.enum(ASSET_TYPES).optional().describe("What the user was trying to find"),
    remembered: z.enum(MEMORY_CUES).optional().describe("Only conversations where the user remembered this"),
    forgotten: z.enum(FORGOTTEN_CUES).optional().describe("Only conversations where the user didn't remember this"),
    failure: z.enum(FAILURE_TYPES).optional().describe("Only conversations with this retrieval failure"),
    workaround: z.enum(WORKAROUNDS).optional(),
    outcome: z.enum(OUTCOMES).optional(),
    problemId: z.string().optional().describe("Problem cluster id from dataset_overview"),
    source: z.string().optional().describe('e.g. "App Store", "Google Photos Community", "Reddit", "Play Store"'),
    keyword: z
      .string()
      .optional()
      .describe("Word or phrase that must appear in the user's own text (case-insensitive), e.g. 'screenshot' or 'date'"),
    minRating: z.number().optional(),
    maxRating: z.number().optional(),
    includeNonRetrieval: z
      .boolean()
      .optional()
      .describe("Include conversations screened as not about retrieval (default false)"),
  })
  .describe("All filters are combined with AND. Omit a filter to not restrict on it.");
export type Filters = z.infer<typeof FiltersSchema>;

export const GROUP_BY = [
  "remembered",
  "forgotten",
  "failure",
  "workaround",
  "outcome",
  "assetType",
  "problem",
  "source",
  "rating",
  "year",
] as const;
export type GroupBy = (typeof GROUP_BY)[number];

interface Row {
  c: Conversation;
  a: ConversationAnalysis;
}

function rows(ds: Dataset): Row[] {
  return ds.conversations.flatMap((c) => (ds.analyses[c.id] ? [{ c, a: ds.analyses[c.id] }] : []));
}

const textOf = (r: Row) => `${r.c.title ?? ""} ${r.c.text}`.toLowerCase();

export function applyFilters(ds: Dataset, f: Filters = {}): Row[] {
  const kw = f.keyword?.trim().toLowerCase();
  return rows(ds).filter(({ c, a }) => {
    if (!f.includeNonRetrieval && !a.retrievalRelevant) return false;
    if (f.assetType && a.assetType !== f.assetType) return false;
    if (f.remembered && !a.rememberedCategories.includes(f.remembered)) return false;
    if (f.forgotten && !a.forgottenCategories.includes(f.forgotten)) return false;
    if (f.failure && !a.failureCategories.includes(f.failure)) return false;
    if (f.workaround && a.workaroundCategory !== f.workaround) return false;
    if (f.outcome && a.outcomeCategory !== f.outcome) return false;
    if (f.problemId && a.problemId !== f.problemId) return false;
    if (f.source && c.source.toLowerCase() !== f.source.toLowerCase()) return false;
    if (f.minRating !== undefined && (c.rating === undefined || c.rating < f.minRating)) return false;
    if (f.maxRating !== undefined && (c.rating === undefined || c.rating > f.maxRating)) return false;
    if (kw && !textOf({ c, a }).includes(kw)) return false;
    return true;
  });
}

/** Plain-language description of a filter set, for answer provenance. */
export function describeFilters(f: Filters = {}): string {
  const parts = Object.entries(f)
    .filter(([, v]) => v !== undefined && v !== false)
    .map(([k, v]) => (k === "includeNonRetrieval" ? "including non-retrieval" : `${k}=${v}`));
  return parts.length ? parts.join(", ") : "all retrieval conversations";
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

export function datasetOverview(ds: Dataset) {
  const all = rows(ds);
  const relevant = all.filter((r) => r.a.retrievalRelevant);
  const dates = ds.conversations.map((c) => c.date).filter((d): d is string => !!d).sort();
  return {
    totalConversations: ds.conversations.length,
    retrievalRelated: relevant.length,
    sources: countBy(ds.conversations.map((c) => c.source)),
    analyzedBy: countBy(all.map((r) => r.a.analyzedBy)),
    dateRange: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null,
    problemClusters: ds.problems
      .map((p) => ({ id: p.id, title: p.title, conversations: relevant.filter((r) => r.a.problemId === p.id).length }))
      .sort((a, b) => b.conversations - a.conversations),
    note:
      analyzedNote(all) +
      " Multi-valued fields (remembered, forgotten, failure) can count one conversation under several labels.",
  };
}

function analyzedNote(all: Row[]) {
  const heuristic = all.filter((r) => r.a.analyzedBy === "heuristic").length;
  if (!heuristic) return "All conversations were analyzed by an LLM.";
  return `${heuristic} of ${all.length} conversations were tagged by keyword rules (low accuracy, roughly 35–40% precision on retrieval relevance); treat their category counts as rough.`;
}

function groupValues(r: Row, by: GroupBy, ds: Dataset): string[] {
  const { a, c } = r;
  switch (by) {
    case "remembered":
      return a.rememberedCategories;
    case "forgotten":
      return a.forgottenCategories;
    case "failure":
      return a.failureCategories;
    case "workaround":
      return [a.workaroundCategory];
    case "outcome":
      return [a.outcomeCategory];
    case "assetType":
      return [a.assetType];
    case "problem":
      return [a.problemId ? (ds.problems.find((p) => p.id === a.problemId)?.title ?? a.problemId) : "Unassigned"];
    case "source":
      return [c.source];
    case "rating":
      return [c.rating === undefined ? "No rating" : `${c.rating}★`];
    case "year":
      return [c.date?.slice(0, 4) ?? "Unknown"];
  }
}

export function countConversations(ds: Dataset, groupBy: GroupBy, filters: Filters = {}) {
  const matched = applyFilters(ds, filters);
  const counts = countBy(matched.flatMap((r) => groupValues(r, groupBy, ds)))
    .slice(0, 15)
    .map((c) => ({ ...c, percentOfMatching: pct(c.count, matched.length) }));
  return { matchingConversations: matched.length, groupBy, counts };
}

const excerpt = (text: string, max = 280) => (text.length > max ? `${text.slice(0, max).trimEnd()}…` : text);

export function searchConversations(ds: Dataset, query: string | undefined, filters: Filters = {}, limit = 8) {
  const matched = applyFilters(ds, filters);
  const terms = (query ?? "")
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2);
  const scored = matched
    .map((r) => {
      const t = textOf(r);
      return { r, hits: terms.filter((term) => t.includes(term)).length };
    })
    .filter((x) => !terms.length || x.hits > 0)
    .sort((x, y) => y.hits - x.hits || y.r.a.confidence - x.r.a.confidence);
  return {
    matchingConversations: scored.length,
    results: scored.slice(0, Math.max(1, Math.min(limit, 15))).map(({ r }) => ({
      id: r.c.id,
      source: r.c.source,
      date: r.c.date,
      rating: r.c.rating,
      title: r.c.title,
      excerpt: excerpt(r.c.text),
      wants: r.a.whatUserWants,
      remembered: r.a.rememberedCategories,
      forgotten: r.a.forgottenCategories,
      failures: r.a.failureCategories,
      workaround: r.a.workaroundCategory,
      outcome: r.a.outcomeCategory,
    })),
  };
}

export function getConversations(ds: Dataset, ids: string[]) {
  const byId = new Map(ds.conversations.map((c) => [c.id, c]));
  return ids.slice(0, 10).map((id) => {
    const c = byId.get(id);
    if (!c) return { id, error: "not found" };
    const a = ds.analyses[id];
    return {
      id,
      source: c.source,
      date: c.date,
      rating: c.rating,
      title: c.title,
      text: c.text,
      analysis: a && {
        retrievalRelevant: a.retrievalRelevant,
        wants: a.whatUserWants,
        assetType: a.assetType,
        remembered: a.remembered,
        forgotten: a.forgotten,
        searchAttempt: a.searchAttempt,
        failures: a.failureCategories,
        workaround: a.workaround,
        outcome: a.outcomeCategory,
        userNeed: a.userNeed,
        analyzedBy: a.analyzedBy,
      },
    };
  });
}
