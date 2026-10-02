// Collects Reddit posts about finding photos, via Reddit's official Data API (app-only OAuth, read-only).
//
// Needs REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in .env.local (see data/sources/README.md).
//   npm run collect:reddit
//   npm run collect:reddit -- --subs googlephotos,photos   # choose subreddits
import { USER_AGENT, isoDate, looksRetrievalRelated, sleep, writeCsv } from "./lib.mjs";

const DEFAULT_SUBS = ["googlephotos"];
const QUERIES = [
  "can't find photo",
  "cant find picture",
  "find old photo",
  "search not finding",
  "search doesn't work",
  "looking for a photo",
  "find screenshot",
  "search by date",
  "search face",
  "lost photo",
];
// Site-wide queries that must mention Google Photos.
const GLOBAL_QUERIES = ['"google photos" search find', '"google photos" "can\'t find"'];
const PAGES_PER_QUERY = 3; // 100 results per page

async function getToken(id, secret) {
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Reddit auth failed: HTTP ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

export function parseListing(json) {
  return (json?.data?.children ?? [])
    .map((c) => c.data)
    .filter((p) => p && !p.over_18 && p.selftext !== "[removed]" && p.selftext !== "[deleted]")
    .map((p) => ({
      id: p.name,
      source: "Reddit",
      sourceUrl: `https://www.reddit.com${p.permalink}`,
      date: isoDate(p.created_utc * 1000),
      title: p.title,
      text: (p.selftext || "").trim() || p.title,
      subreddit: p.subreddit,
    }));
}

async function search(token, { sub, q }) {
  const results = [];
  let after = null;
  for (let page = 0; page < PAGES_PER_QUERY; page++) {
    const params = new URLSearchParams({ q, sort: "relevance", t: "all", limit: "100", raw_json: "1" });
    if (sub) params.set("restrict_sr", "1");
    if (after) params.set("after", after);
    const url = `https://oauth.reddit.com/${sub ? `r/${sub}/` : ""}search?${params}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, "User-Agent": USER_AGENT } });
    if (res.status === 429) {
      await sleep(10_000);
      page--;
      continue;
    }
    if (!res.ok) break;
    const json = await res.json();
    results.push(...parseListing(json));
    after = json?.data?.after;
    await sleep(1100); // stay under ~60 requests/minute
    if (!after) break;
  }
  return results;
}

async function main() {
  const { REDDIT_CLIENT_ID: id, REDDIT_CLIENT_SECRET: secret } = process.env;
  if (!id || !secret) {
    console.error("Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in .env.local (see data/sources/README.md).");
    process.exit(1);
  }
  const subsArg = process.argv.indexOf("--subs");
  const subs = subsArg > 0 ? process.argv[subsArg + 1].split(",") : DEFAULT_SUBS;
  const token = await getToken(id, secret);

  const byId = new Map();
  for (const sub of subs) {
    for (const q of QUERIES) {
      for (const p of await search(token, { sub, q })) byId.set(p.id, p);
      process.stdout.write(`  r/${sub} "${q}": ${byId.size} unique posts\n`);
    }
  }
  for (const q of GLOBAL_QUERIES) {
    for (const p of await search(token, { q })) byId.set(p.id, p);
    process.stdout.write(`  all of Reddit ${q}: ${byId.size} unique posts\n`);
  }

  const all = [...byId.values()];
  const rows = all.filter((p) => looksRetrievalRelated(`${p.title} ${p.text}`));
  const file = writeCsv("reddit-posts.csv", rows); // only the CSV columns are written
  console.log(`\nReddit: ${all.length} posts collected, ${rows.length} kept → ${file}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
