import Papa from "papaparse";
import type { Conversation } from "@/types";

export const EXPECTED_COLUMNS = ["source", "sourceUrl", "date", "title", "text", "rating"] as const;

const ALIASES: Record<string, (typeof EXPECTED_COLUMNS)[number]> = {
  source: "source",
  platform: "source",
  sourceurl: "sourceUrl",
  source_url: "sourceUrl",
  url: "sourceUrl",
  link: "sourceUrl",
  date: "date",
  created_at: "date",
  title: "title",
  subject: "title",
  text: "text",
  body: "text",
  content: "text",
  review: "text",
  comment: "text",
  rating: "rating",
  stars: "rating",
  score: "rating",
};

export interface CsvParseResult {
  conversations: Conversation[];
  skipped: { row: number; reason: string }[];
  missingColumns: string[];
}

export function parseConversationsCsv(csv: string, batchId: string): CsvParseResult {
  const parsed = Papa.parse<Record<string, string>>(csv.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => ALIASES[h.trim().toLowerCase()] ?? h.trim(),
  });
  const fields = parsed.meta.fields ?? [];
  const missingColumns = EXPECTED_COLUMNS.filter((c) => !fields.includes(c));
  const skipped: CsvParseResult["skipped"] = [];
  const conversations: Conversation[] = [];

  if (!fields.includes("text")) {
    return { conversations, skipped: [{ row: 0, reason: "No 'text' column found" }], missingColumns };
  }

  parsed.data.forEach((row, i) => {
    const text = row.text?.trim();
    if (!text) {
      skipped.push({ row: i + 2, reason: "Empty text" });
      return;
    }
    const rating = row.rating ? Number.parseFloat(row.rating) : undefined;
    const url = row.sourceUrl?.trim();
    conversations.push({
      id: `${batchId}-${String(conversations.length + 1).padStart(4, "0")}`,
      source: row.source?.trim() || "Uploaded",
      sourceUrl: url && /^https?:\/\//i.test(url) ? url : undefined,
      date: row.date?.trim() || undefined,
      title: row.title?.trim() || undefined,
      text,
      rating: rating !== undefined && Number.isFinite(rating) ? rating : undefined,
      dataset: batchId,
    });
  });

  return { conversations, skipped, missingColumns };
}
