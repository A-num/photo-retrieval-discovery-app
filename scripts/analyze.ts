/**
 * Runs one or more CSVs through the analysis pipeline and saves them to the local store,
 * the same as uploading on the Data page, without the 200-row upload limit or HTTP timeouts.
 *
 *   npm run analyze -- data/real/app-store-reviews.csv data/real/community-threads.csv
 *   npm run analyze -- data/real/reddit-posts.csv --limit 100     # try a sample first
 *
 * Uses Claude when ANTHROPIC_API_KEY is set in .env.local; otherwise the local keyword analyzer.
 * Rows are saved in batches, so progress survives an interruption (re-running re-imports the file).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseConversationsCsv } from "@/lib/csv";
import { analyzeConversations } from "@/lib/ai/pipeline";
import { hasClaude, MODEL } from "@/lib/ai/client";
import { heuristicAnalyze } from "@/lib/ai/heuristic";
import { addImport, getDataset } from "@/lib/store";

const BATCH = 50;

function arg(name: string) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function analyzeFile(file: string, limit?: number) {
  const base = path.basename(file);
  const batchRoot = `upload-${Date.now().toString(36)}`;
  let { conversations } = parseConversationsCsv(readFileSync(file, "utf8"), batchRoot);
  if (limit) conversations = conversations.slice(0, limit);
  const problems = (await getDataset()).problems;
  const claude = hasClaude();

  // With Claude, drop rows the local screen is confident about only when --prescreen is passed (saves cost).
  if (claude && process.argv.includes("--prescreen")) {
    const before = conversations.length;
    conversations = conversations.filter((c) => heuristicAnalyze(c).retrievalRelevant);
    console.log(`  pre-screen kept ${conversations.length} of ${before}`);
  }

  console.log(`\n${base}: ${conversations.length} rows · ${claude ? `Claude (${MODEL})` : "local keyword analysis"}`);
  let relevantTotal = 0;
  let errorTotal = 0;
  for (let i = 0; i < conversations.length; i += BATCH) {
    const part = conversations.slice(i, i + BATCH);
    const batchId = `${batchRoot}-${Math.floor(i / BATCH) + 1}`;
    const chunk = part.map((c) => ({ ...c, dataset: batchId }));
    const result = await analyzeConversations(chunk, problems);
    const relevant = result.analyses.filter((a) => a.retrievalRelevant).length;
    relevantTotal += relevant;
    errorTotal += result.errors.length;
    await addImport(
      {
        id: batchId,
        filename: `${base} (rows ${i + 1}–${i + part.length})`,
        createdAt: new Date().toISOString(),
        count: part.length,
        relevant,
        analyzedBy: result.mode,
      },
      chunk,
      result.analyses,
    );
    console.log(`  ${Math.min(i + BATCH, conversations.length)}/${conversations.length} analyzed · ${relevantTotal} retrieval-related`);
    if (result.errors.length) console.log(`  ⚠ ${result.errors.length} rows fell back to local analysis: ${result.errors[0].message}`);
  }
  console.log(`Done: ${relevantTotal} of ${conversations.length} retrieval-related${errorTotal ? `, ${errorTotal} Claude errors` : ""}.`);
}

async function main() {
  const files = process.argv.slice(2).filter((a, i, all) => a.endsWith(".csv") && all[i - 1] !== "--limit");
  if (!files.length) {
    console.error("Usage: npm run analyze -- <file.csv> [more.csv] [--limit N] [--prescreen]");
    process.exit(1);
  }
  const limit = arg("--limit") ? Number(arg("--limit")) : undefined;
  if (!hasClaude()) console.log("No ANTHROPIC_API_KEY found: using the local keyword analyzer (rough; see README).");
  for (const f of files) await analyzeFile(f, limit);
  console.log("\nOpen http://localhost:3000 (refresh) to see the results.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
