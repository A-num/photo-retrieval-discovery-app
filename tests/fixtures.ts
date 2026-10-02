// Minimal hand-built dataset for unit tests. Not loaded by the app.
import type { ConversationAnalysis, Dataset, FailureType, ForgottenCue, MemoryCue, Workaround, AssetType, Outcome } from "@/types";
import { PROBLEM_HYPOTHESES } from "@/data/problem-clusters";

interface Row {
  id: string;
  source: string;
  text: string;
  title?: string;
  asset?: AssetType;
  rem?: MemoryCue[];
  forg?: ForgottenCue[];
  fail?: FailureType[];
  work?: Workaround;
  out?: Outcome;
  q?: string;
  problem?: string;
  relevant?: boolean;
}

const rows: Row[] = [
  { id: "t-01", source: "Reddit", title: "Trip photos", text: "Looking for a photo from our trip to Rome. I think it was 2019 but I don't remember the month.", asset: "Travel photo", rem: ["Context / Event", "Location"], forg: ["Exact date"], fail: ["Temporal uncertainty", "Too many results"], work: "Scrolled timeline", out: "Found with effort", q: "rome", problem: "event-not-metadata" },
  { id: "t-02", source: "App Store", title: "Vacation", text: "Can't find the vacation picture with my sister, no idea which year.", asset: "Travel photo", rem: ["Context / Event", "People"], forg: ["Exact date"], fail: ["Context mismatch"], work: "Asked someone", out: "Found", q: "vacation sister", problem: "event-not-metadata" },
  { id: "t-03", source: "Google Photos Community", title: "Wedding", text: "Searching wedding shows every wedding I have been to. I think the one I want had a horse.", asset: "Event photo", rem: ["Context / Event", "Visual appearance"], forg: ["Album"], fail: ["Too many results"], work: "Tried multiple searches", out: "Unknown", q: "wedding", problem: "event-not-metadata" },
  { id: "t-04", source: "Reddit", title: "Screenshot", text: "I screenshotted a recipe and can't find it, text search returns nothing.", asset: "Screenshot", rem: ["Text"], forg: ["Text in image"], fail: ["Screenshot/document retrieval", "Query mismatch"], work: "Gave up", out: "Not found", q: "recipe", problem: "screenshot-buried" },
  { id: "t-05", source: "App Store", title: "Boarding pass", text: "Couldn't find my boarding pass screenshot at the airport.", asset: "Screenshot", rem: ["Text", "Time"], forg: ["Text in image"], fail: ["Screenshot/document retrieval"], work: "Scrolled timeline", out: "Found with effort", problem: "screenshot-buried" },
  { id: "t-06", source: "Reddit", title: "Receipt", text: "Need the receipt photo for a warranty claim.", asset: "Receipt", rem: ["Time"], forg: ["Text in image"], fail: ["Screenshot/document retrieval", "Too many results"], work: "Scrolled timeline", out: "Found with effort", q: "receipt", problem: "docs-urgent" },
  { id: "t-07", source: "App Store", title: "Grandpa", text: "Face search shows 2000 photos of grandpa, I want the one at graduation.", asset: "Photo of a person", rem: ["People", "Context / Event"], forg: [], fail: ["Too many results"], work: "Scrolled timeline", out: "Unknown", problem: "people-moment" },
  { id: "t-08", source: "Google Photos Community", title: "Storage", text: "Why is storage so expensive?", relevant: false },
];

function analysis(r: Row): ConversationAnalysis {
  const relevant = r.relevant ?? true;
  return {
    conversationId: r.id,
    retrievalRelevant: relevant,
    whatUserWants: relevant ? (r.title ?? "") : "Not a retrieval problem",
    assetType: r.asset ?? "Other",
    remembered: r.rem ?? [],
    forgotten: r.forg ?? [],
    searchAttempt: r.q,
    retrievalFailure: r.fail ?? [],
    workaround: r.work,
    outcome: r.out ?? "Unknown",
    userNeed: "",
    confidence: 0.8,
    rememberedCategories: r.rem ?? [],
    forgottenCategories: r.forg ?? [],
    failureCategories: r.fail ?? [],
    workaroundCategory: r.work ?? "None",
    outcomeCategory: r.out ?? "Unknown",
    problemId: relevant ? (r.problem ?? null) : null,
    analyzedBy: "claude",
  };
}

export const fixture: Dataset = {
  conversations: rows.map((r) => ({ id: r.id, source: r.source, title: r.title, text: r.text, dataset: "fixture" })),
  analyses: Object.fromEntries(rows.map((r) => [r.id, analysis(r)])),
  problems: PROBLEM_HYPOTHESES,
};
