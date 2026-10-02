import type { ProblemCluster } from "@/types";

// Pre-computed problem clusters for the demo dataset.
// With an ANTHROPIC_API_KEY these can be regenerated from the evidence (Dashboard → "Regenerate insights").
export const DEMO_PROBLEMS: ProblemCluster[] = [
  {
    id: "event-not-metadata",
    title: "Users remember the event, but not the metadata",
    surfaceComplaint: "“Search can't find the photo from our trip / that dinner.”",
    underlyingProblem:
      "Users store memories as experiences (a trip, a dinner, who was there, what happened) while search indexes metadata (dates, place names, object labels). They cannot translate the experience into the exact date, place name or keyword the index expects.",
    whyFails:
      "Queries describe the story (“dinner after the concert”, “the day we got lost”) rather than indexable attributes. Location and date filters require precise values the user never knew or has forgotten, so the right photo exists but is unreachable by query.",
    opportunity: {
      title: "Context-first, story-based retrieval",
      description:
        "Let people search the way they remember: by describing the situation, and let the system infer candidate dates, places and people from that story.",
      ideas: [
        "Natural-language event queries that resolve to candidate time windows and places",
        "Auto-detected “moments” (trips, dinners, outings) as searchable units",
        "Follow-up clarification: “Was this before or after your Portugal trip?”",
      ],
    },
    generatedBy: "demo-precomputed",
  },
  {
    id: "life-event-time",
    title: "Users anchor time to life events, not calendar dates",
    surfaceComplaint: "“I don't know what year it was, so I can't find it.”",
    underlyingProblem:
      "People recall time relative to personal milestones (“before my son was born”, “the apartment on Oak St”, “when she was learning to walk”) rather than as dates. Date-based search and timeline scrolling both assume absolute time.",
    whyFails:
      "Date filters and year headings need an absolute value; the user has only a relative anchor. They fall back to scrolling years of timeline, often misjudging the range by a year or more.",
    opportunity: {
      title: "Personal-timeline anchors",
      description:
        "Build a personal timeline of life landmarks (moves, births, jobs, trips) so users can search relative to them.",
      ideas: [
        "Queries like “the winter after we moved” resolved against detected landmarks",
        "Age-based search for people (“Maya around age 2”) using face groups and birthdays",
        "Timeline scrubber labelled with life events instead of just months",
      ],
    },
    generatedBy: "demo-precomputed",
  },
  {
    id: "screenshot-buried",
    title: "Screenshots and text-in-image are buried in the camera roll",
    surfaceComplaint: "“I took a screenshot of it and now I can't find it.”",
    underlyingProblem:
      "Screenshots are captured as a quick external memory (a code, an address, a message, a recipe) but are stored and ranked like photos. Users remember roughly what the text said or which app it came from, not the exact words.",
    whyFails:
      "Text search requires exact words, and users paraphrase. Screenshots pile up in the thousands and are hard to tell apart as thumbnails, so scrolling the Screenshots folder is slow.",
    opportunity: {
      title: "Screenshots as searchable knowledge",
      description:
        "Treat screenshots as information to retrieve, not photos to browse: semantic text search, source-app awareness and intent grouping.",
      ideas: [
        "Fuzzy / semantic OCR search that matches paraphrases",
        "Filter screenshots by source app or content type (chat, map, ticket, code)",
        "Auto-surface time-sensitive screenshots (tickets, codes) near their relevant date",
      ],
    },
    generatedBy: "demo-precomputed",
  },
  {
    id: "docs-urgent",
    title: "Documents, receipts and medical images are needed urgently but look alike",
    surfaceComplaint: "“I need the photo of my insurance card / receipt NOW and can't find it.”",
    underlyingProblem:
      "Utility photos (IDs, receipts, prescriptions, X-rays, forms) are retrieved under time pressure for a task such as a claim, a return or an appointment. Users remember the purpose and roughly when, but these images are visually similar and mixed in with personal photos.",
    whyFails:
      "Generic labels (“document”, “receipt”) return hundreds of look-alikes. The key identifier (store name, amount, document type) is text the user doesn't remember exactly, and there is no notion of “the important one”.",
    opportunity: {
      title: "Task-aware document retrieval",
      description:
        "Recognize document types and key fields, and let users retrieve by purpose (“my car insurance card”, “the TV receipt for warranty”).",
      ideas: [
        "Document-type classification with extracted fields (merchant, amount, expiry)",
        "Purpose-based queries mapped to document types",
        "A pinned “important documents” space suggested automatically",
      ],
    },
    generatedBy: "demo-precomputed",
  },
  {
    id: "visual-hard-to-express",
    title: "Users can picture the photo but can't put it into keywords",
    surfaceComplaint: "“I know exactly what it looks like but search doesn't get it.”",
    underlyingProblem:
      "Visual memory is rich (composition, colors, mood, what someone was wearing) but search works best with single nouns. Users can recognize the photo instantly but cannot describe it in the vocabulary search understands.",
    whyFails:
      "Multi-attribute descriptions (“me in a yellow raincoat on a pier at sunset”) are reduced to one dominant label, or return results that match one attribute. Abstract qualities (mood, lighting, framing) are not searchable.",
    opportunity: {
      title: "Descriptive & example-based visual search",
      description:
        "Support rich visual descriptions and ‘find more like this’ so recognition can replace recall.",
      ideas: [
        "Compositional queries that honor all attributes (person + clothing + place + time of day)",
        "Search by similar photo or by rough sketch / color",
        "Iterative refinement: ‘more like this one, but at night’",
      ],
    },
    generatedBy: "demo-precomputed",
  },
  {
    id: "people-moment",
    title: "Finding a specific person at a specific moment",
    surfaceComplaint: "“Search by face shows every photo of them, not the one I want.”",
    underlyingProblem:
      "Users want the intersection of a person and a moment (grandpa at my graduation, my daughter's first steps). Face groups solve ‘who’ but not ‘when’ or ‘what was happening’, and some people aren't grouped or named at all.",
    whyFails:
      "People search returns thousands of results for close family. Combining a person with an event or age is unreliable, and unnamed or misgrouped faces (old scans, people who have passed away, friends' kids) aren't searchable by name.",
    opportunity: {
      title: "Person × moment retrieval",
      description:
        "Make people search combinable with events, ages and other people, and repair the face groups that matter most.",
      ideas: [
        "Queries combining people with events or ages (“Grandpa at Sam's graduation”)",
        "‘Together’ search for two or more people in the same photo",
        "Prompted face-group cleanup for high-value people",
      ],
    },
    generatedBy: "demo-precomputed",
  },
  {
    id: "too-many-results",
    title: "Search finds the category, not the photo",
    surfaceComplaint: "“Searching ‘beach’ gives me 4,000 photos.”",
    underlyingProblem:
      "Search reliably finds the broad category but has no way to narrow to the one photo the user means. Users have discriminating details in mind (the second beach day, the one where the dog is wet) but no way to add them.",
    whyFails:
      "Results are ranked by date with no relevance to the extra context the user has. Refining with more words often returns zero results, so users end up scrolling a huge, flat result list.",
    opportunity: {
      title: "Progressive narrowing",
      description:
        "Turn a broad result set into a conversation: suggest discriminating facets and let users refine instead of restarting.",
      ideas: [
        "Auto-suggested facets inside results (year, place, people, trip)",
        "Cluster large result sets into moments and show one representative per moment",
        "Additive refinement that never drops to zero results",
      ],
    },
    generatedBy: "demo-precomputed",
  },
  {
    id: "place-without-name",
    title: "Users remember the place, but not its name or where it was",
    surfaceComplaint: "“I can't find the photo of that little café / viewpoint.”",
    underlyingProblem:
      "Users remember what a place looked and felt like, and often that it was ‘near’ something, but not the business name, the town, or where on the map it was. Location search needs a named place or a precise map area.",
    whyFails:
      "Place names are missing, or location data is absent (location history off, older camera, screenshots from maps). Map browsing works only if the user knows roughly where to look.",
    opportunity: {
      title: "Fuzzy place recall",
      description:
        "Help users reach places through relative and descriptive cues: near a known place, along a route, or looks-like.",
      ideas: [
        "Queries like ‘the café near our hotel in Kyoto’",
        "Route and trip reconstruction from surrounding photos",
        "Place-type recognition (café, trailhead, market) without needing a name",
      ],
    },
    generatedBy: "demo-precomputed",
  },
];
