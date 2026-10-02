import type {
  AssetType,
  Conversation,
  ConversationAnalysis,
  FailureType,
  ForgottenCue,
  MemoryCue,
  Outcome,
  Workaround,
} from "@/types";

// Rule-based fallback for the analysis pipeline, used when no Claude API key is configured.
// It follows the same steps and output shape as the Claude pipeline, with lower confidence.

const has = (text: string, re: RegExp) => re.test(text);

// A retrieval struggle needs a retrieval action *and* a sign it went wrong, within one sentence.
// "Makes it easy to find a photo" or "lost photos after sync" (a backup problem) don't qualify.
const RETRIEVAL_ACTION = /\b(find|finding|search(es|ed|ing)?|look(ing)? for|locate|scroll(ed|ing)? (through|back|for)|dig(ging)? through|track down)\b/i;
const STRUGGLE =
  /\b(can'?t|cannot|can ?not|couldn'?t|could not|unable|impossible|hard|difficult|struggl\w*|frustrat\w*|useless|doesn'?t|does not|don'?t|won'?t|never|no way|zero results|no results|nothing|wish|tried|trying|takes? forever|ages|hours|not (work|find|show)\w*|stopped|broke\w*|worse|any way to|how (do|can) i)\b/i;

// Looking for a setting, button or storage space isn't photo retrieval.
const NOT_A_PHOTO_TARGET = /\b(settings?|option|button|menu|toggle|widget|storage|space|subscription|unsync\w*)\b/i;

export function isRetrievalRelevant(text: string): boolean {
  const media = /\b(photos?|pics?|pictures?|screenshots?|images?|videos?|selfies?|receipts?|search\w*)\b/i;
  if (!has(text, media)) return false;
  return text
    .split(/(?<=[.!?\n])\s+/)
    .some((s) => RETRIEVAL_ACTION.test(s) && STRUGGLE.test(s) && !NOT_A_PHOTO_TARGET.test(s));
}

const ASSET_RULES: [RegExp, AssetType][] = [
  [/\bscreenshot/i, "Screenshot"],
  [/\breceipts?\b/i, "Receipt"],
  [/\b(x-?ray|mri|scan results?|rash|prescription|lab results?|blood test|vaccin|medical|dermatolog|doctor)/i, "Medical image"],
  [/\b(passport|licen[cs]e|insurance card|id card|registration|document|form|certificate|serial number|bill)\b/i, "Document"],
  [/\b(whiteboard|sign|menu|note|recipe|password|text in)\b/i, "Photo containing text"],
  [/\b(wedding|birthday|party|concert|graduation|reunion|festival|ceremony|christmas|thanksgiving)\b/i, "Event photo"],
  [/\b(trip|vacation|holiday|travel|honeymoon|road trip|hotel)\b/i, "Travel photo"],
  [/\b(office|work|coworker|colleague|meeting|offsite)\b/i, "Work photo"],
  [/\b(school|class(room)?|teacher)\b/i, "School photo"],
  [/\b(mom|dad|grandma|grandpa|grandmother|grandfather|son|daughter|kids?|baby|family|wife|husband|sister|brother)\b/i, "Family photo"],
  [/\b(restaurant|caf[eé]|beach|mountain|park|museum|lake|garden|viewpoint)\b/i, "Photo of a place"],
  [/\b(selfie|portrait|face)\b/i, "Photo of a person"],
];

const MEMORY_RULES: [RegExp, MemoryCue][] = [
  [/\b(trip|dinner|party|wedding|birthday|concert|holiday|vacation|meeting|hike|hiking|picnic|graduation|reunion|christmas|anniversary|event|day we|night we)\b/i, "Context / Event"],
  [/\b(in|at|near) (the )?[A-Z][a-z]+|\b(restaurant|caf[eé]|beach|park|lake|museum|city|town|house|apartment|hotel|garden)\b/, "Location"],
  [/\b(summer|winter|spring|fall|autumn|last (year|month|week)|years? ago|months? ago|(19|20)\d\d|before|after|when (we|i|she|he)|around|age \d)\b/i, "Time"],
  [/\b(my (wife|husband|partner|mom|dad|son|daughter|sister|brother|friend|kids?|grandma|grandpa|family)|with [A-Z][a-z]+|friends?|coworker)\b/i, "People"],
  [/\b(red|blue|green|yellow|purple|orange|pink|white|black|wearing|looked like|sunset|foggy|dark|bright|silhouette|colou?r)\b/i, "Visual appearance"],
  [/\b(text|said|code|password|number|address|written|word|title)\b/i, "Text"],
  [/\b(car|dog|cat|cake|card|bottle|sled|tent|balloon|bridge|medal|desk|tv)\b/i, "Object"],
];

const FORGOT_RULES: [RegExp, ForgottenCue][] = [
  [/\b(don'?t|do not|can'?t|cannot|no idea|not sure)\b[^.]*\b(when|date|year|month|which (year|trip|month|summer|winter))\b|\bor was it\b|\b(19|20)\d\d or (19|20)\d\d\b/i, "Exact date"],
  [/\b(don'?t|can'?t|no idea|not sure)\b[^.]*\b(where|location|which (city|town|street))\b|\blocation (was )?(off|missing)\b/i, "Exact location"],
  [/\b(don'?t|can'?t|no idea)\b[^.]*\b(name of|their name|his name|her name|last name|who)\b|\bnot named\b|\bunnamed\b/i, "Person's name"],
  [/\b(album)\b/i, "Album"],
  [/\b(what to (type|search)|no idea what to type|can'?t (describe|figure out a query)|right (word|keyword))\b/i, "Search keyword"],
  [/\b(don'?t|can'?t) remember the (code|number|text|words?|title)|exact (word|text)\b/i, "Text in image"],
  [/\b(the name (escapes|of the)|don'?t (remember|know) the (name|restaurant|place|town|trail|shop))\b/i, "Place name"],
];

const WORKAROUND_RULES: [RegExp, Workaround][] = [
  [/\bgave up\b|\bnever found\b/i, "Gave up"],
  [/\bscroll/i, "Scrolled timeline"],
  [/\balbums?\b[^.]*(one by one|through|checked)|\bdug through\b/i, "Checked albums"],
  [/\b(asked|texted|called|messaged)\b/i, "Asked someone"],
  [/\b(another app|other app|google drive|whatsapp|email|gmail|airline app|instagram)\b/i, "Used another app"],
  [/\bmap\b/i, "Searched by map"],
  [/\btried\b|\bsearched\b[^.]*,[^.]*,/i, "Tried multiple searches"],
];

export function extractSearchAttempt(text: string): string | undefined {
  // Quotes must open at a word start so apostrophes ("don't") aren't read as quote marks.
  const quoted = [...text.matchAll(/(?:^|[\s(,:])['"‘“]([^'"’”\n]{2,60}?)['"’”](?=[\s.,;:!?)]|$)/g)].map((m) => m[1].trim());
  if (quoted.length) return [...new Set(quoted)].slice(0, 4).join(" / ");
  const m = text.match(/\b(?:searched(?: for)?|search(?:ing)? for) ([^.,;!?]{3,50})/i);
  return m ? m[1].trim() : undefined;
}

function detectFailures(
  text: string,
  asset: AssetType,
  remembered: MemoryCue[],
  forgotten: ForgottenCue[],
  searched: boolean,
): FailureType[] {
  const f = new Set<FailureType>();
  if (/\b(thousands?|hundreds?|\d{3,}|so many|too many|every (one|year)|all of them)\b/i.test(text)) f.add("Too many results");
  if (forgotten.includes("Exact date") || /\bwhich year\b|\bnot sure (when|what year)\b/i.test(text)) f.add("Temporal uncertainty");
  if (forgotten.includes("Exact location") || forgotten.includes("Place name")) f.add("Location uncertainty");
  if (asset === "Screenshot" || asset === "Document" || asset === "Receipt" || asset === "Medical image" || asset === "Photo containing text") f.add("Screenshot/document retrieval");
  if (remembered.includes("Visual appearance") && /\b(describe|looks? like|know it when|specific image|combination|together)\b/i.test(text)) f.add("Visual description gap");
  if (searched && /\b(nothing|no results|zero|useless|doesn'?t (find|understand|get)|random|shows? (me )?(every|all))\b/i.test(text)) f.add("Query mismatch");
  if (remembered.includes("Context / Event") && searched) f.add("Context mismatch");
  return [...f];
}

function detectOutcome(text: string): Outcome {
  if (/\b(never found|gave up|still can'?t|couldn'?t find|nothing useful|no luck)\b/i.test(text)) return "Not found";
  if (/\b(finally found|found it (by|after)|found (it|them) only|eventually|ended up finding|after scrolling)\b/i.test(text)) return "Found with effort";
  if (/\bfound (it|them)\b/i.test(text)) return "Found";
  return "Unknown";
}

function assignProblem(
  asset: AssetType,
  rem: MemoryCue[],
  forg: ForgottenCue[],
  fail: FailureType[],
  text: string,
): string | null {
  if (asset === "Screenshot" || asset === "Photo containing text") return "screenshot-buried";
  if (asset === "Document" || asset === "Receipt" || asset === "Medical image") return "docs-urgent";
  if (/\b(before|after) (my|our|the) (son|daughter|baby|move|wedding)|\bwhen (we|i) lived\b|\bat age\b|\bwhen .* was (little|a baby|in)\b/i.test(text)) return "life-event-time";
  if (forg.includes("Place name") || (fail.includes("Location uncertainty") && rem.includes("Location"))) return "place-without-name";
  if (fail.includes("Visual description gap")) return "visual-hard-to-express";
  if (rem.includes("People") && /\b(face|together|both|group)\b/i.test(text)) return "people-moment";
  if (rem.includes("Context / Event")) return "event-not-metadata";
  if (fail.includes("Too many results")) return "too-many-results";
  if (rem.includes("People")) return "people-moment";
  return null;
}

export function heuristicAnalyze(conv: Conversation): ConversationAnalysis {
  const text = `${conv.title ?? ""}. ${conv.text}`;
  const base = {
    conversationId: conv.id,
    analyzedBy: "heuristic" as const,
  };
  if (!isRetrievalRelevant(text)) {
    return {
      ...base,
      retrievalRelevant: false,
      whatUserWants: "Not a retrieval problem",
      assetType: "Other",
      remembered: [],
      forgotten: [],
      retrievalFailure: [],
      outcome: "Not applicable",
      userNeed: "Not retrieval-related (screened out)",
      confidence: 0.5,
      rememberedCategories: [],
      forgottenCategories: [],
      failureCategories: [],
      workaroundCategory: "None",
      outcomeCategory: "Unknown",
      problemId: null,
    };
  }

  const assetType = ASSET_RULES.find(([re]) => re.test(text))?.[1] ?? "Other";
  const rememberedCategories = MEMORY_RULES.filter(([re]) => re.test(text)).map(([, c]) => c);
  const forgottenCategories = FORGOT_RULES.filter(([re]) => re.test(text)).map(([, c]) => c);
  const searchAttempt = extractSearchAttempt(conv.text);
  const failureCategories = detectFailures(text, assetType, rememberedCategories, forgottenCategories, !!searchAttempt || /\bsearch/i.test(text));
  const workaroundCategory = WORKAROUND_RULES.find(([re]) => re.test(conv.text))?.[1] ?? "None";
  const outcomeCategory = detectOutcome(conv.text);
  const problemId = assignProblem(assetType, rememberedCategories, forgottenCategories, failureCategories, text);
  const signals = rememberedCategories.length + forgottenCategories.length + failureCategories.length;

  return {
    ...base,
    retrievalRelevant: true,
    whatUserWants: conv.title?.trim() || conv.text.split(/(?<=[.!?])\s/)[0].slice(0, 120),
    assetType,
    remembered: rememberedCategories,
    forgotten: forgottenCategories,
    searchAttempt,
    retrievalFailure: failureCategories,
    workaround: workaroundCategory,
    outcome: outcomeCategory,
    userNeed: "Needs AI analysis for a precise need statement (keyword-based analysis)",
    confidence: Math.min(0.65, 0.3 + signals * 0.05),
    rememberedCategories,
    forgottenCategories,
    failureCategories,
    workaroundCategory,
    outcomeCategory,
    problemId,
  };
}
