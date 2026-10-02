// Core data model for the Discovery Engine.
// Free-text fields (remembered, forgotten, ...) preserve the user's specifics;
// the *Categories fields map those specifics onto a fixed taxonomy so they can be counted.

export type Source =
  | "Reddit"
  | "Google Photos Community"
  | "Play Store"
  | "App Store"
  | string;

export interface Conversation {
  id: string;
  source: Source;
  sourceUrl?: string;
  date?: string;
  title?: string;
  text: string;
  rating?: number;
  /** Import batch id the conversation came from */
  dataset: string;
}

export const MEMORY_CUES = [
  "Context / Event",
  "Location",
  "Time",
  "People",
  "Visual appearance",
  "Text",
  "Object",
] as const;
export type MemoryCue = (typeof MEMORY_CUES)[number];

export const FORGOTTEN_CUES = [
  "Exact date",
  "Exact location",
  "Person's name",
  "Album",
  "Search keyword",
  "Text in image",
  "Place name",
] as const;
export type ForgottenCue = (typeof FORGOTTEN_CUES)[number];

export const FAILURE_TYPES = [
  "Context mismatch",
  "Temporal uncertainty",
  "Query mismatch",
  "Location uncertainty",
  "Too many results",
  "Screenshot/document retrieval",
  "Visual description gap",
  "Product change / regression",
] as const;
export type FailureType = (typeof FAILURE_TYPES)[number];

export const WORKAROUNDS = [
  "Scrolled timeline",
  "Checked albums",
  "Tried multiple searches",
  "Asked someone",
  "Used another app",
  "Searched by map",
  "Gave up",
  "None",
] as const;
export type Workaround = (typeof WORKAROUNDS)[number];

export const OUTCOMES = ["Found", "Found with effort", "Not found", "Unknown"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const ASSET_TYPES = [
  "Travel photo",
  "Screenshot",
  "Document",
  "Receipt",
  "Medical image",
  "Family photo",
  "Event photo",
  "Photo of a place",
  "Photo containing text",
  "Photo of a person",
  "Work photo",
  "School photo",
  "Other",
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

/** "hypothesis" marks the starting problem clusters, written before any evidence was analyzed. */
export type AnalyzedBy = "hypothesis" | "claude" | "heuristic";

export interface ConversationAnalysis {
  conversationId: string;
  retrievalRelevant: boolean;
  whatUserWants: string;
  assetType: AssetType;
  remembered: string[];
  forgotten: string[];
  searchAttempt?: string;
  retrievalFailure: string[];
  workaround?: string;
  outcome: string;
  userNeed: string;
  opportunityArea?: string;
  confidence: number;

  // Normalized categories used for aggregation.
  rememberedCategories: MemoryCue[];
  forgottenCategories: ForgottenCue[];
  failureCategories: FailureType[];
  workaroundCategory: Workaround;
  outcomeCategory: Outcome;
  /** Problem cluster this conversation is evidence for (null if none fits). */
  problemId: string | null;
  analyzedBy: AnalyzedBy;
}

export interface Opportunity {
  title: string;
  description: string;
  ideas: string[];
}

/** An AI-generated problem cluster: the underlying retrieval problem, not the surface complaint. */
export interface ProblemCluster {
  id: string;
  title: string;
  surfaceComplaint: string;
  underlyingProblem: string;
  whyFails: string;
  opportunity: Opportunity;
  generatedBy: AnalyzedBy;
}

export interface Dataset {
  conversations: Conversation[];
  analyses: Record<string, ConversationAnalysis>;
  problems: ProblemCluster[];
}

export interface CountItem {
  label: string;
  count: number;
}

export interface ProblemSummary extends ProblemCluster {
  evidenceCount: number;
  topRemembered: CountItem[];
  topForgotten: CountItem[];
  topFailures: CountItem[];
  topWorkarounds: CountItem[];
  outcomes: CountItem[];
  exampleSearches: string[];
  rememberedDetails: string[];
  forgottenDetails: string[];
  evidenceIds: string[];
  sources: CountItem[];
}

export interface KeyNumber {
  label: string;
  value: string;
}

/** A brief, analyzed answer from Ask AI. Quotes are available as evidence but not part of the answer. */
export interface AskAnswer {
  mode: "claude" | "local";
  sufficientEvidence: boolean;
  /** 1–4 sentences, answer first. */
  answer: string;
  keyNumbers: KeyNumber[];
  confidence: "high" | "medium" | "low";
  /** How many conversations the answer was computed over. */
  basedOn: number;
  /** Conversations the answer cites as examples (verified to exist and to have been retrieved). */
  evidenceIds: string[];
  sources: CountItem[];
  /** The analysis steps taken, in plain language. */
  steps: string[];
  caveats?: string;
}

/** A compact evidence item returned alongside an answer. */
export interface EvidenceSnippet {
  id: string;
  source: string;
  date?: string;
  rating?: number;
  title?: string;
  excerpt: string;
  sourceUrl?: string;
}

/** A previous question and answer, sent back for follow-up questions. */
export interface AskTurn {
  question: string;
  answer: string;
}
