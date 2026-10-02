// Collects Google Photos reviews from Apple's public customer-reviews RSS feed.
// The feed returns up to 10 pages × 50 reviews per country and sort order.
//
//   npm run collect:appstore            # retrieval-related reviews only
//   npm run collect:appstore -- --all   # keep every review
import { USER_AGENT, looksRetrievalRelated, isoDate, sleep, writeCsv } from "./lib.mjs";

const APP_ID = "962194608"; // Google Photos: Backup & Edit (Google LLC)
const COUNTRIES = ["us", "gb", "ca", "au", "in", "ie", "nz"];
const SORTS = ["mostrecent", "mosthelpful"];
const PAGES = 10;

export function parseFeed(json) {
  const entries = json?.feed?.entry ?? [];
  const list = Array.isArray(entries) ? entries : [entries];
  // Reviews carry a rating; an app-metadata entry (on some pages) does not.
  return list
    .filter((e) => e?.["im:rating"])
    .map((e) => ({
      id: e.id?.label,
      source: "App Store",
      date: isoDate(e.updated?.label),
      title: e.title?.label,
      text: e.content?.label ?? "",
      rating: Number(e["im:rating"].label),
    }));
}

async function fetchPage(country, sort, page) {
  const url = `https://itunes.apple.com/${country}/rss/customerreviews/page=${page}/id=${APP_ID}/sortby=${sort}/json`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];
  return parseFeed(await res.json().catch(() => null));
}

async function main() {
  const keepAll = process.argv.includes("--all");
  const byId = new Map();
  for (const country of COUNTRIES) {
    for (const sort of SORTS) {
      for (let page = 1; page <= PAGES; page++) {
        const reviews = await fetchPage(country, sort, page);
        if (!reviews.length) break;
        for (const r of reviews) if (r.id) byId.set(r.id, r);
        await sleep(500);
      }
    }
    process.stdout.write(`  ${country}: ${byId.size} unique reviews so far\n`);
  }
  const all = [...byId.values()];
  const rows = keepAll ? all : all.filter((r) => looksRetrievalRelated(`${r.title} ${r.text}`));
  const file = writeCsv("app-store-reviews.csv", rows); // only the CSV columns are written
  console.log(`\nApp Store: ${all.length} reviews collected, ${rows.length} kept → ${file}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
