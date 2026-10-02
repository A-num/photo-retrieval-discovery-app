import type { AskAnswer, AskTurn, ConversationAnalysis, CountItem, Dataset } from "@/types";
import { countBy, relevantAnalyses } from "@/lib/insights";
import { hasClaude } from "./client";
import { askAgent } from "./research-agent";

const MIN_EVIDENCE = 2;
const MAX_EVIDENCE_SHOWN = 8;

function sourcesFor(ds: Dataset, ids: string[]): CountItem[] {
  const byId = new Map(ds.conversations.map((c) => [c.id, c.source]));
  return countBy(ids.map((id) => byId.get(id) ?? "Unknown"));
}

function insufficient(mode: AskAnswer["mode"], reason: string, ids: string[] = [], ds?: Dataset, steps: string[] = []): AskAnswer {
  return {
    mode,
    sufficientEvidence: false,
    answer: `The dataset doesn't contain enough evidence to answer this. ${reason}`,
    keyNumbers: [],
    confidence: "low",
    basedOn: ids.length,
    evidenceIds: ids.slice(0, MAX_EVIDENCE_SHOWN),
    sources: ds ? sourcesFor(ds, ids) : [],
    steps,
  };
}

// ─── Local (no API key) research engine ────────────────────────────────────

type Pred = (a: ConversationAnalysis, text: string) => boolean;
interface Filter {
  label: string;
  pred: Pred;
}

const TOPIC_FILTERS: [RegExp, Filter][] = [
  [/screenshot/i, { label: "screenshots", pred: (a) => a.assetType === "Screenshot" || a.assetType === "Photo containing text" }],
  [/receipt/i, { label: "receipts", pred: (a) => a.assetType === "Receipt" }],
  [/document|passport|licen[cs]e|\bids?\b|insurance/i, { label: "documents", pred: (a) => a.assetType === "Document" || a.assetType === "Receipt" }],
  [/medical|x-?ray|doctor|health|prescription/i, { label: "medical images", pred: (a) => a.assetType === "Medical image" }],
  [/\b(trips?|travel|vacation|holiday)\b/i, { label: "trips", pred: (a, t) => a.assetType === "Travel photo" || /\b(trip|vacation|holiday|honeymoon|travel)/i.test(t) }],
  [/restaurant|dinner|caf[eé]/i, { label: "restaurants", pred: (_a, t) => /\b(restaurant|dinner|caf[eé]|ramen|ate)\b/i.test(t) }],
  [/\b(family|kids?|children|parents?)\b/i, { label: "family photos", pred: (a) => a.assetType === "Family photo" }],
  [/\b(events?|weddings?|birthdays?|party|parties|concerts?)\b/i, { label: "events", pred: (a) => a.assetType === "Event photo" || a.rememberedCategories.includes("Context / Event") }],
  [/\bschool\b/i, { label: "school", pred: (a, t) => a.assetType === "School photo" || /\bschool|class\b/i.test(t) }],
  // Bare "work" / "people" are too common in questions ("when search doesn't work", "what do people do") to act as topics.
  [/\b(at work|work (photos?|pictures?|events?)|office|coworkers?|colleagues?)\b/i, { label: "work", pred: (a) => a.assetType === "Work photo" }],
  [/\b(photos? of (people|a person|someone)|specific (people|person)|faces?|face (search|groups?))\b/i, { label: "people", pred: (a) => a.rememberedCategories.includes("People") }],
  [/\b(places?|locations?)\b/i, { label: "places", pred: (a) => a.rememberedCategories.includes("Location") || a.assetType === "Photo of a place" }],
];

const FORGOT_PHRASES: [RegExp, Filter][] = [
  [/not (remember )?(the )?(date|when|year|time)|forg[eo]t(ten)? (the )?(date|when|year)/i, { label: "forgot the date", pred: (a) => a.forgottenCategories.includes("Exact date") }],
  [/not (remember )?(the )?(location|where|place)|forg[eo]t(ten)? (the )?(location|where|place)/i, { label: "forgot the location", pred: (a) => a.forgottenCategories.includes("Exact location") || a.forgottenCategories.includes("Place name") }],
  [/not (remember )?(the |their )?name|forg[eo]t(ten)? (the |their )?name/i, { label: "forgot a name", pred: (a) => a.forgottenCategories.includes("Person's name") || a.forgottenCategories.includes("Place name") }],
];

type Intent = "remember" | "forget" | "workaround" | "failure" | "outcome" | "problems" | null;

function detectIntent(q: string): Intent {
  if (/workaround|instead|what do (users|they|people) do|alternative|cope/i.test(q)) return "workaround";
  if (/(don'?t|not|never|can'?t) remember|forget|forgot|missing/i.test(q) && !/remember (a|the|an) \w+ but/i.test(q)) return "forget";
  if (/remember/i.test(q)) return "remember";
  if (/fail|break|why|problem|struggl|issue|pain/i.test(q)) return "failure";
  if (/outcome|give up|gave up|find it in the end|success/i.test(q)) return "outcome";
  if (/opportunit|cluster|theme/i.test(q)) return "problems";
  return null;
}

const STOP = new Set("the a an and or of to in on for with what which who how why when where do does did is are was were users user people their them they photos photo pictures picture show me examples example find can cant that this most often about from have has think say says said feel like want tell there any some more much many".split(" "));

function searchText(ds: Dataset, a: ConversationAnalysis) {
  const c = ds.conversations.find((x) => x.id === a.conversationId);
  return `${c?.title ?? ""} ${c?.text ?? ""} ${a.whatUserWants} ${a.remembered.join(" ")} ${a.searchAttempt ?? ""}`;
}

function pct(n: number, d: number) {
  return d ? Math.round((n / d) * 100) : 0;
}

export function askLocal(question: string, ds: Dataset): AskAnswer {
  const relevant = relevantAnalyses(ds);
  const q = question.trim();
  // Topics combine with OR ("screenshots and documents" means both groups); forgotten cues narrow with AND.
  const topics = TOPIC_FILTERS.filter(([re]) => re.test(q)).map(([, f]) => f);
  const forgot = FORGOT_PHRASES.filter(([re]) => re.test(q)).map(([, f]) => f);
  const filters = [...topics, ...forgot];
  let intent = detectIntent(q);

  let subset = relevant.filter((a) => {
    const t = searchText(ds, a);
    return (!topics.length || topics.some((f) => f.pred(a, t))) && forgot.every((f) => f.pred(a, t));
  });

  // No recognised topic or intent: fall back to keyword matching over the original text.
  let keywordMode = false;
  if (!filters.length && !intent) {
    const terms = (q.toLowerCase().match(/[a-z][a-z-]{2,}/g) ?? []).filter((w) => !STOP.has(w));
    if (!terms.length) return insufficient("local", "Try asking about what users remember, forget, search for, or do instead.");
    keywordMode = true;
    // Require most terms to match so one incidental word can't pass as evidence.
    const needed = Math.ceil(terms.length / 2);
    subset = relevant.filter((a) => {
      const t = searchText(ds, a).toLowerCase();
      return terms.filter((term) => new RegExp(`\\b${term.replace(/s$/, "")}`).test(t)).length >= needed;
    });
    intent = "failure";
  }

  const scope = filters.length
    ? ` about ${topics.map((f) => f.label).join(" or ")}${topics.length && forgot.length ? " where users " : ""}${forgot.map((f) => f.label).join(" and ")}`
    : keywordMode
      ? " matching your keywords"
      : "";
  if (subset.length < MIN_EVIDENCE) {
    return insufficient(
      "local",
      `Only ${subset.length} analyzed conversation${subset.length === 1 ? "" : "s"}${keywordMode ? " matched your keywords" : `${scope} matched`} (minimum ${MIN_EVIDENCE}).`,
      subset.map((a) => a.conversationId),
      ds,
      [`Searched ${relevant.length} retrieval conversations${scope}: ${subset.length} matched`],
    );
  }

  const n = subset.length;
  let counts: CountItem[];
  let pick: (a: ConversationAnalysis, top: string) => boolean;
  let finding: string;
  const problemTitle = (id: string) => ds.problems.find((p) => p.id === id)?.title ?? id;

  switch (intent) {
    case "remember":
    case null: {
      counts = countBy(subset.flatMap((a) => a.rememberedCategories));
      pick = (a, top) => a.rememberedCategories.includes(top as never);
      const [t1, t2, t3] = counts;
      finding = `In ${n} conversations${scope}, users most often remember ${t1.label.toLowerCase()} (${t1.count}, ${pct(t1.count, n)}%)${t2 ? `, then ${t2.label.toLowerCase()} (${t2.count})` : ""}${t3 ? ` and ${t3.label.toLowerCase()} (${t3.count})` : ""}.`;
      const forgotDate = subset.filter((a) => a.forgottenCategories.includes("Exact date")).length;
      if (forgotDate) finding += ` ${forgotDate} of them couldn't recall the exact date, so what they remember is context, not the metadata search depends on.`;
      break;
    }
    case "forget": {
      counts = countBy(subset.flatMap((a) => a.forgottenCategories));
      pick = (a, top) => a.forgottenCategories.includes(top as never);
      const [t1, t2] = counts;
      finding = `In ${n} conversations${scope}, the most commonly missing piece is ${t1.label.toLowerCase()} (${t1.count}, ${pct(t1.count, n)}%)${t2 ? `, followed by ${t2.label.toLowerCase()} (${t2.count})` : ""}.`;
      break;
    }
    case "workaround": {
      const withWork = subset.filter((a) => a.workaroundCategory !== "None");
      counts = countBy(withWork.map((a) => a.workaroundCategory));
      pick = (a, top) => a.workaroundCategory === top;
      if (!counts.length) return insufficient("local", `None of the ${n} conversations${scope} describe a workaround.`);
      const [t1, t2] = counts;
      finding = `${withWork.length} of ${n} conversations${scope} describe a workaround. The most common is “${t1.label}” (${t1.count})${t2 ? `, then “${t2.label}” (${t2.count})` : ""}. ${counts.find((c) => c.label === "Gave up")?.count ?? 0} gave up entirely.`;
      break;
    }
    case "outcome": {
      counts = countBy(subset.map((a) => a.outcomeCategory));
      pick = (a, top) => a.outcomeCategory === top;
      finding = `Outcomes across ${n} conversations${scope}: ${counts.map((c) => `${c.label} ${c.count}`).join(", ")}.`;
      break;
    }
    case "problems": {
      counts = countBy(subset.map((a) => a.problemId).filter((p): p is string => !!p)).map((c) => ({ ...c, label: problemTitle(c.label) }));
      pick = (a, top) => !!a.problemId && problemTitle(a.problemId) === top;
      finding = `The largest problem cluster${scope} is “${counts[0].label}” (${counts[0].count} of ${n} conversations).`;
      break;
    }
    default: {
      counts = countBy(subset.flatMap((a) => a.failureCategories));
      pick = (a, top) => a.failureCategories.includes(top as never);
      const [t1, t2] = counts;
      finding = `In ${n} conversations${scope}, retrieval most often breaks because of ${t1.label.toLowerCase()} (${t1.count}, ${pct(t1.count, n)}%)${t2 ? `, then ${t2.label.toLowerCase()} (${t2.count})` : ""}.`;
      const topProblem = countBy(subset.map((a) => a.problemId).filter((p): p is string => !!p))[0];
      if (topProblem) finding += ` The dominant underlying problem is: ${problemTitle(topProblem.label).toLowerCase()}.`;
    }
  }

  // "Show me examples…" wants every match; other questions cite the conversations behind the top pattern.
  const wantsExamples = /\b(show|examples?|list)\b/i.test(q);
  if (wantsExamples) {
    const rest = finding.replace(/^In \d+ conversations[^,]*, /, "");
    finding = `Found ${n} conversations${scope}. ${rest.charAt(0).toUpperCase()}${rest.slice(1)}`;
  }
  const top = counts[0]?.label;
  const evidence = subset
    .filter((a) => (wantsExamples || !top ? true : pick(a, top)))
    .sort((a, b) => b.confidence - a.confidence)
    .map((a) => a.conversationId);

  const keywordTagged = subset.filter((a) => a.analyzedBy === "heuristic").length;
  return {
    mode: "local",
    sufficientEvidence: true,
    answer: finding,
    keyNumbers: counts.slice(0, 3).map((c) => ({ label: c.label, value: `${c.count} (${pct(c.count, n)}%)` })),
    confidence: keywordMode || keywordTagged > n / 2 ? "low" : "medium",
    basedOn: n,
    evidenceIds: evidence.slice(0, MAX_EVIDENCE_SHOWN),
    sources: sourcesFor(ds, evidence),
    steps: [
      `Matched ${n} retrieval conversations${scope || ""}`,
      `Counted ${intent === "remember" || intent === null ? "what users remembered" : intent === "forget" ? "what users forgot" : intent === "workaround" ? "workarounds" : intent === "outcome" ? "outcomes" : intent === "problems" ? "problem clusters" : "failure types"}`,
    ],
    caveats: keywordMode
      ? "Answered by keyword match without an LLM (no API key). Results may include loosely related conversations."
      : "Computed with fixed rules, without an LLM (no API key). Follow-up questions and open-ended analysis need ANTHROPIC_API_KEY.",
  };
}

// ─── Entry point ───────────────────────────────────────────────────────────

/** Answers with the Claude research agent when a key is set, otherwise with the local rules engine. */
export async function ask(question: string, ds: Dataset, history: AskTurn[] = []): Promise<AskAnswer> {
  if (!hasClaude()) return askLocal(question, ds);
  try {
    return await askAgent(question, ds, history);
  } catch (err) {
    const local = askLocal(question, ds);
    return { ...local, caveats: `Claude request failed (${(err as Error).message}); answered with local rules instead. ${local.caveats ?? ""}` };
  }
}
