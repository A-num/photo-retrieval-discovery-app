import type { ProblemCluster } from "@/types";

// Problem clusters the pipeline sorts conversations into. The first set began as hypotheses and the rest were
// added after reading the collected reviews; descriptions with evidence have been revised against it.
// Counts and evidence on every page are computed from the analyzed conversations.
export const PROBLEM_HYPOTHESES: ProblemCluster[] = [
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
    generatedBy: "hypothesis",
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
    generatedBy: "hypothesis",
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
    generatedBy: "hypothesis",
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
    generatedBy: "hypothesis",
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
    generatedBy: "hypothesis",
  },
  {
    id: "people-moment",
    title: "Users search by person, but face groups are incomplete or stop updating",
    surfaceComplaint: "“Searching their name only shows photos up to 2021.”",
    underlyingProblem:
      "Person search is how people find family photos, and it only works if face groups are complete and current. When grouping silently stops adding new photos, misses most photos of someone, or can't be corrected by hand, the most-used retrieval path fails without the user knowing why.",
    whyFails:
      "Face groups stop updating after a point in time, resetting them wipes every group, and there is no manual tagging to fill gaps. Users only discover the gap when the photo they want is missing.",
    opportunity: {
      title: "Trustworthy person search",
      description: "Make face groups complete, current and correctable, and tell users when grouping isn't working.",
      ideas: [
        "Manual tagging, plus merging and splitting of face groups",
        "A visible signal when face grouping stops processing new photos",
        "Combine people with time, place or event in one query",
      ],
    },
    generatedBy: "hypothesis",
  },
  {
    id: "too-many-results",
    title: "Search finds the category, not the photo",
    surfaceComplaint: "“It takes forever scrolling through photos to find the ones you want.”",
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
    generatedBy: "hypothesis",
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
    generatedBy: "hypothesis",
  },
  // Added after reading real App Store reviews and Community threads, which kept describing these.
  {
    id: "wrong-dates",
    title: "Users remember when they saved a photo, but it's filed under a different date",
    surfaceComplaint: "“I just saved it and now I can't find it.”",
    underlyingProblem:
      "The timeline is ordered by capture date, but users think of saved, shared, imported or re-uploaded photos by when they added them. Photos taken long ago, or whose dates were stripped or wrong, land somewhere unexpected in the timeline.",
    whyFails:
      "There is no fast way to see or select items by when they were added, so recently saved photos and fresh uploads scatter across years of timeline.",
    opportunity: {
      title: "Date-added as a first-class way in",
      description: "Let users find, sort and select by when something entered their library, and help fix wrong dates.",
      ideas: [
        "A 'Recently added' view with the same fast scrubbing as the main timeline",
        "Search and filters by date added, and bulk-select a recent upload batch",
        "Detect and suggest corrections for stripped or implausible dates",
      ],
    },
    generatedBy: "hypothesis",
  },
  {
    id: "browse-navigation",
    title: "When search fails, browsing is the fallback, and browsing is slow or broken",
    surfaceComplaint: "“I spend half a day scrolling to find one photo.”",
    underlyingProblem:
      "Scrolling the timeline is how users recover when search doesn't work, so its landmarks (months, highlights) and speed matter. Redesigns that remove time landmarks, scroll bugs, and search results that can't jump back into the timeline make the fallback fail too.",
    whyFails:
      "Results and the timeline are disconnected, scrubbing is coarse, and visual landmarks that helped people orient by time have been removed.",
    opportunity: {
      title: "A better fallback: navigable time",
      description: "Make the timeline a fast, landmark-rich way to navigate, and connect search results back to it.",
      ideas: [
        "Jump from any search result to its place in the timeline",
        "Restore strong time landmarks (month/event headers) while scrubbing",
        "Fast scrubbing in every view, including Recently added and albums",
      ],
    },
    generatedBy: "hypothesis",
  },
  {
    id: "search-regression",
    title: "Search got worse after updates, and users can't fall back to the old behavior",
    surfaceComplaint: "“Search used to be great. Now I can't find anything.”",
    underlyingProblem:
      "Users built habits around a search that worked. When updates change how search behaves (an AI assistant intercepting queries, wrong labels, removed manual organization), their trusted retrieval path breaks with no way back.",
    whyFails:
      "New search modes override plain keyword search, misclassifications are visible but can't be corrected, and there is no option to run a literal search.",
    opportunity: {
      title: "Predictable search users can control",
      description: "Keep a reliable literal search path alongside AI search, and let users correct what search gets wrong.",
      ideas: [
        "Always offer a plain keyword/text search, even when AI search is available",
        "Let users fix wrong labels and see why a photo matched",
        "Track retrieval success before and after search changes",
      ],
    },
    generatedBy: "hypothesis",
  },
];
