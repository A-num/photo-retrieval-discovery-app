import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { heuristicAnalyze, extractSearchAttempt } from "@/lib/ai/heuristic";
import { analyzeConversations } from "@/lib/ai/pipeline";
import { parseConversationsCsv } from "@/lib/csv";
import { DEMO_PROBLEMS } from "@/data/problem-clusters";
import type { Conversation } from "@/types";

const conv = (text: string, title?: string): Conversation => ({ id: "t1", source: "Test", text, title, dataset: "test" });

beforeEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_AUTH_TOKEN;
});

describe("heuristic analyzer", () => {
  it("screens out non-retrieval conversations", () => {
    const a = heuristicAnalyze(conv("Why is storage so expensive? I need more space."));
    expect(a.retrievalRelevant).toBe(false);
    expect(a.problemId).toBeNull();
  });

  it("extracts memory, failure and workaround from an event story", () => {
    const a = heuristicAnalyze(
      conv("I'm looking for the photo from our trip to Rome with my wife, I don't remember which year. Searched 'Rome dinner' and got hundreds of results, so I scrolled for ages and finally found it."),
    );
    expect(a.retrievalRelevant).toBe(true);
    expect(a.assetType).toBe("Travel photo");
    expect(a.rememberedCategories).toEqual(expect.arrayContaining(["Context / Event", "People"]));
    expect(a.forgottenCategories).toContain("Exact date");
    expect(a.failureCategories).toEqual(expect.arrayContaining(["Too many results", "Temporal uncertainty"]));
    expect(a.searchAttempt).toBe("Rome dinner");
    expect(a.workaroundCategory).toBe("Scrolled timeline");
    expect(a.outcomeCategory).toBe("Found with effort");
    expect(a.problemId).toBe("event-not-metadata");
    expect(a.confidence).toBeLessThanOrEqual(0.65);
  });

  it("routes screenshots and documents to their clusters", () => {
    expect(heuristicAnalyze(conv("Can't find the screenshot of my boarding pass, searched 'flight'.")).problemId).toBe("screenshot-buried");
    expect(heuristicAnalyze(conv("I can't find the photo of my insurance card, search shows nothing.")).problemId).toBe("docs-urgent");
  });

  it("extracts quoted search queries", () => {
    expect(extractSearchAttempt(`I searched "beach" and 'beach dog'`)).toBe("beach / beach dog");
    expect(extractSearchAttempt("I searched for red sled, nothing")).toBe("red sled");
    expect(extractSearchAttempt("no searching here")).toBeUndefined();
  });
});

describe("pipeline without API key", () => {
  it("analyzes every conversation with the local analyzer", async () => {
    const convs = [conv("Can't find the screenshot of my ticket, searched 'ticket'."), { ...conv("Love the editor!"), id: "t2" }];
    const res = await analyzeConversations(convs, DEMO_PROBLEMS);
    expect(res.mode).toBe("heuristic");
    expect(res.analyses.map((a) => a.conversationId)).toEqual(["t1", "t2"]);
    expect(res.analyses.map((a) => a.retrievalRelevant)).toEqual([true, false]);
  });
});

describe("CSV import", () => {
  it("parses the bundled sample CSV", () => {
    const csv = readFileSync(path.join(__dirname, "../public/sample-conversations.csv"), "utf8");
    const r = parseConversationsCsv(csv, "b1");
    expect(r.conversations).toHaveLength(4);
    expect(r.missingColumns).toEqual([]);
    expect(r.conversations[1].rating).toBe(2);
    expect(r.conversations[0].id).toBe("b1-0001");
  });

  it("accepts header aliases, skips empty text, and drops non-http links", () => {
    const csv = "Platform,URL,Body,Stars\nReddit,javascript:alert(1),can't find my photo,4\nReddit,https://x.test/1,,3\n";
    const r = parseConversationsCsv(csv, "b2");
    expect(r.conversations).toHaveLength(1);
    expect(r.conversations[0]).toMatchObject({ source: "Reddit", text: "can't find my photo", rating: 4 });
    expect(r.conversations[0].sourceUrl).toBeUndefined();
    expect(r.skipped).toEqual([{ row: 3, reason: "Empty text" }]);
    expect(r.missingColumns).toEqual(expect.arrayContaining(["date", "title"]));
  });

  it("rejects CSVs without a text column", () => {
    const r = parseConversationsCsv("source,date\nReddit,2025-01-01\n", "b3");
    expect(r.conversations).toHaveLength(0);
    expect(r.skipped[0].reason).toMatch(/text/);
  });
});
