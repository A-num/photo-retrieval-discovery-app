// Shared helpers for the data collectors. Every collector writes the CSV format the Data page imports:
// source, sourceUrl, date, title, text, rating
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export const USER_AGENT = "photo-retrieval-discovery-research/0.1 (personal non-commercial research project)";
export const OUT_DIR = path.join(process.cwd(), "data", "real");

// Loose pre-filter: keeps text that could be about finding/retrieving a photo.
// The analysis pipeline does the real screening; this only avoids analyzing obvious non-matches.
const RETRIEVAL_HINT =
  /\b(find|finding|found|search\w*|look(ing)? for|lost|missing|locate|scroll\w*|screenshots?|where (is|are|did)|disappear\w*|dig(ging)? through)\b/i;

export function looksRetrievalRelated(text) {
  return RETRIEVAL_HINT.test(text);
}

export function stripHtml(html) {
  return decodeEntities(
    html
      .replace(/<(br|\/?(p|div|li))\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

export function decodeEntities(s) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return named[e.toLowerCase()] ?? m;
  });
}

const COLUMNS = ["source", "sourceUrl", "date", "title", "text", "rating"];

function csvCell(v) {
  if (v === undefined || v === null) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows) {
  return [COLUMNS.join(","), ...rows.map((r) => COLUMNS.map((c) => csvCell(r[c])).join(","))].join("\n") + "\n";
}

export function writeCsv(filename, rows) {
  mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, filename);
  writeFileSync(file, toCsv(rows));
  return file;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function isoDate(d) {
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}
