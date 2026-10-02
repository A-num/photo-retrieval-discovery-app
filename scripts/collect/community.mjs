// Collects the original question from Google Photos Community threads.
//
// support.google.com's robots.txt disallows automated *search* (/*/search) and APIs, but allows thread pages.
// So you find threads yourself in a browser, paste their URLs into data/sources/community-urls.txt
// (one per line), and this script fetches only those pages, one every few seconds.
//
//   npm run collect:community
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { USER_AGENT, isoDate, sleep, stripHtml, writeCsv } from "./lib.mjs";

const URL_FILE = path.join(process.cwd(), "data", "sources", "community-urls.txt");
const DELAY_MS = 3000;
const MAX_THREADS = 150;

/** Decodes one level of JS string-literal escaping (\x22, \\u003c, \\ ...) as used in the page's inline data. */
function unescapeJs(s) {
  const simple = { n: "\n", t: "\t", r: "" };
  return s.replace(/\\(x[0-9a-f]{2}|u[0-9a-f]{4}|[\s\S])/gi, (_, e) => {
    if (e.length > 1) return String.fromCharCode(parseInt(e.slice(1), 16));
    return simple[e] ?? e;
  });
}

/**
 * Extracts the thread's original post from the page HTML.
 * The post lives in an inline data array: [[<threadId>, ...], ..., "<title>", <id>, null, [...], "<body html>", "<lang>", ...
 * Returns null if the structure isn't found (Google may change the markup).
 */
export function parseThread(html, threadId) {
  const start = html.indexOf(`[[${threadId},\\x22`);
  if (start < 0) return null;
  const segment = html.slice(start, start + 60000);
  // The post body is the first string in the thread record that is immediately followed by its language code.
  const m = segment.match(/\\x22((?:[^\\]|\\(?!x22))*?)\\x22,\\x22([a-z]{2}(?:-[A-Za-z]+)?)\\x22,\d+,/);
  if (!m) return null;
  const body = stripHtml(unescapeJs(unescapeJs(m[1])));
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/);
  const title = titleMatch ? stripHtml(titleMatch[1]).replace(/\s*-\s*Google Photos Community\s*$/, "") : undefined;
  const after = segment.slice(m.index + m[0].length);
  const micros = after.match(/\b(1\d{15})\b/);
  const date = micros ? isoDate(Number(micros[1]) / 1000) : undefined;
  return body ? { title, text: body, date } : null;
}

export function threadIdFromUrl(url) {
  const m = url.match(/support\.google\.com\/photos\/thread\/(\d+)/);
  return m ? m[1] : null;
}

async function main() {
  if (!existsSync(URL_FILE)) {
    console.error(`Create ${URL_FILE} with one Community thread URL per line (see data/sources/README.md).`);
    process.exit(1);
  }
  const urls = [
    ...new Set(
      readFileSync(URL_FILE, "utf8")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#")),
    ),
  ].slice(0, MAX_THREADS);

  const rows = [];
  const failed = [];
  for (const [i, url] of urls.entries()) {
    const id = threadIdFromUrl(url);
    if (!id) {
      failed.push(`${url} (not a photos thread URL)`);
      continue;
    }
    const canonical = `https://support.google.com/photos/thread/${id}?hl=en`;
    try {
      const res = await fetch(canonical, { headers: { "User-Agent": USER_AGENT } });
      const post = res.ok ? parseThread(await res.text(), id) : null;
      if (post) rows.push({ source: "Google Photos Community", sourceUrl: canonical, ...post });
      else failed.push(`${url} (HTTP ${res.status} or post not found)`);
    } catch (err) {
      failed.push(`${url} (${err.message})`);
    }
    process.stdout.write(`  ${i + 1}/${urls.length}\r`);
    await sleep(DELAY_MS);
  }
  const file = writeCsv("community-threads.csv", rows);
  console.log(`\nCommunity: ${rows.length} threads collected → ${file}`);
  if (failed.length) console.log(`Skipped ${failed.length}:\n  ${failed.join("\n  ")}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
