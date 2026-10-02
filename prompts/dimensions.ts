// One module per research dimension. The extraction prompt is assembled from these,
// so a dimension can be refined (or a new one added) without rewriting the whole prompt.

export interface ResearchDimension {
  field: string;
  question: string;
  guidance: string;
}

export const DIMENSIONS: ResearchDimension[] = [
  {
    field: "whatUserWants / assetType",
    question: "What are they trying to find?",
    guidance:
      "Describe the specific photo or video in one line (who/what/where), not the category. Then pick the closest assetType.",
  },
  {
    field: "remembered / rememberedCategories",
    question: "What do they remember?",
    guidance:
      "List the concrete details the user can recall (e.g. 'honeymoon dinner', 'wife laughing', 'Lisbon'). Map each to a memory cue: Context / Event, Location, Time (including relative time like 'before my son was born'), People, Visual appearance, Text, Object.",
  },
  {
    field: "forgotten / forgottenCategories",
    question: "What don't they remember?",
    guidance:
      "List what is missing that search would need: exact date, exact location, a person's name, album, the right keyword, the text in the image, the place/business name. Only include what the user states or clearly implies.",
  },
  {
    field: "searchAttempt",
    question: "How did they search?",
    guidance:
      "Quote the actual query or queries if given, separated by ' / '. Otherwise describe the strategy briefly. Omit if they didn't search.",
  },
  {
    field: "retrievalFailure / failureCategories",
    question: "Why did retrieval fail?",
    guidance:
      "Explain the underlying mismatch between the user's memory and what search can use. Categories: Context mismatch (remembers the story, search needs metadata), Temporal uncertainty, Query mismatch (words don't match the index), Location uncertainty, Too many results, Screenshot/document retrieval, Visual description gap.",
  },
  {
    field: "workaround / workaroundCategory",
    question: "What did they do instead?",
    guidance:
      "What they did after search failed: scrolled the timeline, checked albums, tried multiple searches, asked someone, used another app, searched by map, gave up. Use 'None' if not stated.",
  },
  {
    field: "outcome / userNeed",
    question: "What happened, and what do they fundamentally need?",
    guidance:
      "Outcome: Found, Found with effort, Not found, Unknown. userNeed: the underlying retrieval capability they are missing, phrased as a need, not a feature request.",
  },
];
