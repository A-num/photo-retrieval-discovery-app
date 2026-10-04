# Discovery Engine: photo retrieval research

An internal research tool that analyzes user conversations about failing to find old photos. It traces each one through:

**what users remember → what they don't → how they search → why retrieval fails → what opportunity exists**

The engine focuses on the *underlying* retrieval problem (for example, "remembers the event and visual context but can't turn it into the metadata search needs"), not the surface complaint ("search can't find my photo").

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

The app contains only real, collected data. A fresh checkout starts empty: collect and analyze data (below) to populate it.

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

`npm run analyze` runs files of any size through the pipeline (the upload page caps Claude mode at 200 rows).

Without `ANTHROPIC_API_KEY`, real data is analyzed with keyword rules. In a hand-checked sample of App Store reviews, those rules were right only 35–40% of the time about which reviews describe a retrieval problem, and the app shows a warning while that's the case. Use Claude for findings you intend to present.

## Deploying (Vercel, free Hobby plan)

The deployed app is a read-only copy of the dataset. It reads `data/snapshot.json` (committed) instead of `.data/store.json` (local, git-ignored), hides import and remove controls, and refuses writes. Read-only mode switches on automatically on Vercel, or locally with `DISCOVERY_READ_ONLY=true`.

1. After analyzing new data locally, refresh the snapshot: `npm run snapshot`, then commit `data/snapshot.json`.
2. Push to GitHub.
3. On vercel.com: **Add New → Project**, import the repository, **Deploy**. No settings or environment variables are needed.

Leave `ANTHROPIC_API_KEY` unset on a public deployment: Ask AI then uses the built-in engine, and visitors' questions don't cost you anything.

## Pages

- **Dashboard**: headline metrics, what users remember, where retrieval breaks, top problems, and opportunity areas.
- **Problems**: each problem cluster with its surface complaint vs underlying problem, what users remember and forget, example searches, why retrieval fails, workarounds, and 3–5 pieces of original evidence.
- **Conversations**: a searchable table filterable by source, asset type, failure, outcome and problem. Each row opens the full analysis.
- **Ask AI**: a chat-style research analyst. Each answer is a few sentences of analysis with up to 4 key numbers, a confidence level, and how many conversations it rests on. Source quotes and the analysis steps are tucked behind toggles. Follow-up questions keep the context, and it says so when the evidence is insufficient.
- **Data**: a summary of the collected dataset, collection commands, CSV upload (`source, sourceUrl, date, title, text, rating`; only `text` is required), and removal of uploaded batches.

Content is labeled throughout as **USER EVIDENCE** (original text) or **AI ANALYSIS** (generated).

## Problem hypotheses

`data/problem-clusters.ts` holds 8 starting hypotheses for the problem clusters (for example, "users remember the event, but not the metadata"). They were written before any evidence was analyzed, and they're labeled **hypothesis** in the UI. Every count, chart and quote comes from collected data. With a Claude key, **Regenerate insights** on the Dashboard rewrites the clusters from the real evidence.

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
- Ask AI with a key is an agent (`lib/ai/research-agent.ts`, SDK tool runner). Claude calls deterministic query tools from `lib/ai/research-tools.ts` (`dataset_overview`, `count_conversations`, `search_conversations`, `get_conversations`), so every number comes from code rather than the model's arithmetic, then submits a structured brief answer. Citations are kept only if a tool actually returned that conversation. Without a key, `lib/ai/ask.ts` answers with a rules engine (topic, forgotten cue and intent) over the analyses, with no follow-up context.
- `lib/insights.ts` holds the pure aggregation behind every chart and problem page.
- `lib/store.ts` keeps uploads and regenerated insights in `.data/store.json`. It is the one module to swap for Supabase/Postgres.

Model: `claude-opus-5` by default (override with `ANTHROPIC_MODEL`). Refused requests automatically retry on Anthropic's recommended fallback model (`fallbacks: "default"`).

## Layout

```
app/          pages + API routes (/api/import, /api/ask, /api/synthesize)
components/   UI (shadcn/ui in components/ui, Recharts in components/charts)
data/         problem hypotheses, source lists and templates; collected CSVs in data/real/ (git-ignored)
lib/ai/       pipeline, Claude client, local analyzer, Ask AI, synthesis
prompts/      modular prompts, one per pipeline stage / research dimension
types/        data model
tests/        Vitest suites
```
