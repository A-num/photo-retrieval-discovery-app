# Discovery Engine: photo retrieval research

An internal research tool that analyzes user conversations about failing to find old photos. It traces each one through:

**what users remember → what they don't → how they search → why retrieval fails → what opportunity exists**

The engine focuses on the *underlying* retrieval problem (for example, "remembers the event and visual context but can't turn it into the metadata search needs"), not the surface complaint ("search can't find my photo").

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

The app works immediately with no API key, using the bundled demo dataset.

To enable Claude analysis (for uploaded CSVs, open-ended Ask AI questions, and "Regenerate insights"):

```bash
cp .env.example .env.local   # then set ANTHROPIC_API_KEY
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 3000 |
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` / `npm run lint` | TypeScript and ESLint |
| `npm run build && npm start` | Production build |
| `npm run collect:*` / `npm run analyze` | Collect and analyze real data (see below) |

## Real data

Collectors in `scripts/collect/` pull real conversations into `data/real/` (git-ignored). Setup for each source is in [data/sources/README.md](data/sources/README.md).

```bash
npm run collect:appstore      # Apple's public reviews feed: works with no setup
npm run collect:community     # threads listed in data/sources/community-urls.txt
npm run collect:reddit        # needs REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET in .env.local
# Play Store: no public API, so copy reviews into data/sources/play-store-template.csv by hand

npm run analyze -- data/real/app-store-reviews.csv data/real/community-threads.csv
```

`npm run analyze` runs files of any size through the pipeline (the upload page caps Claude mode at 200 rows). Then uncheck **Include demo data** on the Data page so every page shows real data only.

Without `ANTHROPIC_API_KEY`, real data is analyzed with keyword rules. In a hand-checked sample of App Store reviews, those rules were right only 35–40% of the time about which reviews describe a retrieval problem, and the app shows a warning while that's the case. Use Claude for findings you intend to present.

## Pages

- **Dashboard**: headline metrics, what users remember, where retrieval breaks, top problems, and opportunity areas.
- **Problems**: each problem cluster with its surface complaint vs underlying problem, what users remember and forget, example searches, why retrieval fails, workarounds, and 3–5 pieces of original evidence.
- **Conversations**: a searchable table filterable by source, asset type, failure, outcome and problem. Each row opens the full analysis.
- **Ask AI**: a research assistant that answers only from the dataset, with supporting conversations and sources. It says so when the evidence is insufficient.
- **Data**: the demo dataset summary, CSV upload (`source, sourceUrl, date, title, text, rating`; only `text` is required), and removal of uploaded batches.

Content is labeled throughout as **USER EVIDENCE** (original text) or **AI ANALYSIS** (generated).

## Demo data

The 110 conversations in `data/demo-conversations.ts` are **synthetic**: written for this prototype, not real users, with no source links. 101 are retrieval-related and 9 are control cases that should be screened out. Each carries a hand-authored reference analysis so the app runs without an API key.

## How the analysis works

```
Raw conversation
  → screen: is it retrieval-related?            prompts/screen.ts
  → extract the research dimensions             prompts/dimensions.ts + prompts/extract.ts
    (wants, remembers, forgot, searched, why it failed, workaround, outcome, need)
  → group: assign to a problem cluster          (part of extraction)
  → synthesize problems and opportunity areas   prompts/synthesize.ts
```

- `lib/ai/pipeline.ts` runs these steps. With `ANTHROPIC_API_KEY`, each step is a Claude call with schema-validated structured output (`lib/ai/client.ts`). Without a key, or if a call fails, `lib/ai/heuristic.ts` runs the same steps with keyword rules at lower confidence.
- `lib/ai/ask.ts` handles Ask AI. With a key, Claude answers from the full dataset (prompt-cached), and any conversation IDs it cites that aren't in the dataset are dropped. Without a key, a local engine parses the question (topic, forgotten-cue, intent) and aggregates over the analyses.
- `lib/insights.ts` holds the pure aggregation behind every chart and problem page.
- `lib/store.ts` keeps uploads and regenerated insights in `.data/store.json`. It is the one module to swap for Supabase/Postgres.

Model: `claude-opus-5` by default (override with `ANTHROPIC_MODEL`). Refused requests automatically retry on Anthropic's recommended fallback model (`fallbacks: "default"`).

## Layout

```
app/          pages + API routes (/api/import, /api/ask, /api/synthesize)
components/   UI (shadcn/ui in components/ui, Recharts in components/charts)
data/         synthetic demo dataset + pre-computed problem clusters
lib/ai/       pipeline, Claude client, local analyzer, Ask AI, synthesis
prompts/      modular prompts, one per pipeline stage / research dimension
types/        data model
tests/        Vitest suites
```
